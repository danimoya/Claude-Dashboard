/**
 * CLI Output Parser Service
 * Parses and structures CLI output for frontend consumption
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface ParsedOutput {
  type: 'command' | 'response' | 'error' | 'tool' | 'thinking' | 'code' | 'file' | 'unknown';
  content: string;
  metadata?: {
    language?: string;
    filePath?: string;
    toolName?: string;
    severity?: 'info' | 'warning' | 'error';
    timestamp?: Date;
  };
}

export interface StreamChunk {
  sessionId: string;
  chunks: ParsedOutput[];
  raw: string;
  timestamp: Date;
}

export class CLIOutputParserService extends EventEmitter {
  private buffers: Map<string, string> = new Map();

  /**
   * Parse CLI output and emit structured chunks
   */
  parseOutput(sessionId: string, rawOutput: string): StreamChunk {
    // Append to buffer for this session
    const currentBuffer = this.buffers.get(sessionId) || '';
    const fullOutput = currentBuffer + rawOutput;

    // Parse into structured chunks
    const chunks = this.parseIntoChunks(fullOutput);

    // Check if we have incomplete chunks at the end
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk && this.isIncomplete(lastChunk)) {
      // Store incomplete chunk in buffer
      this.buffers.set(sessionId, lastChunk.content);
      chunks.pop(); // Remove incomplete chunk
    } else {
      // Clear buffer if all chunks are complete
      this.buffers.set(sessionId, '');
    }

    const streamChunk: StreamChunk = {
      sessionId,
      chunks,
      raw: rawOutput,
      timestamp: new Date(),
    };

    this.emit('parsed', streamChunk);

    return streamChunk;
  }

  /**
   * Parse output into structured chunks
   */
  private parseIntoChunks(output: string): ParsedOutput[] {
    const chunks: ParsedOutput[] = [];
    const lines = output.split('\n');

    let currentChunk: ParsedOutput | null = null;
    let codeBlockBuffer: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';

    for (const line of lines) {
      // Detect code blocks (```language or ```)
      const codeBlockMatch = line.match(/^```(\w+)?/);
      if (codeBlockMatch) {
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          codeLanguage = codeBlockMatch[1] || '';
          codeBlockBuffer = [];
        } else {
          // End of code block
          inCodeBlock = false;
          chunks.push({
            type: 'code',
            content: codeBlockBuffer.join('\n'),
            metadata: {
              language: codeLanguage,
              timestamp: new Date(),
            },
          });
          codeBlockBuffer = [];
        }
        continue;
      }

      // If in code block, accumulate lines
      if (inCodeBlock) {
        codeBlockBuffer.push(line);
        continue;
      }

      // Detect tool usage (Tool: or Using tool:)
      if (line.match(/^(Tool:|Using tool:)/i)) {
        const toolMatch = line.match(/^(?:Tool:|Using tool:)\s*(\w+)/i);
        chunks.push({
          type: 'tool',
          content: line,
          metadata: {
            toolName: toolMatch?.[1],
            timestamp: new Date(),
          },
        });
        continue;
      }

      // Detect file paths (common patterns)
      if (line.match(/^(File:|Reading|Writing|Created|Updated):\s*([^\s]+)/i)) {
        const fileMatch = line.match(/^(?:File:|Reading|Writing|Created|Updated):\s*([^\s]+)/i);
        chunks.push({
          type: 'file',
          content: line,
          metadata: {
            filePath: fileMatch?.[1],
            timestamp: new Date(),
          },
        });
        continue;
      }

      // Detect errors
      if (line.match(/^(Error|ERROR|Failed|FAILED):/i) || line.includes('✗')) {
        chunks.push({
          type: 'error',
          content: line,
          metadata: {
            severity: 'error',
            timestamp: new Date(),
          },
        });
        continue;
      }

      // Detect thinking/reasoning
      if (line.match(/^(Thinking|Analyzing|Planning):/i) || line.includes('🤔')) {
        chunks.push({
          type: 'thinking',
          content: line,
          metadata: {
            timestamp: new Date(),
          },
        });
        continue;
      }

      // Detect commands (usually start with $ or >)
      if (line.match(/^[\$>]\s+/)) {
        chunks.push({
          type: 'command',
          content: line.replace(/^[\$>]\s+/, ''),
          metadata: {
            timestamp: new Date(),
          },
        });
        continue;
      }

      // Default: treat as response
      if (line.trim()) {
        chunks.push({
          type: 'response',
          content: line,
          metadata: {
            timestamp: new Date(),
          },
        });
      }
    }

    // Handle any remaining code block
    if (inCodeBlock && codeBlockBuffer.length > 0) {
      chunks.push({
        type: 'code',
        content: codeBlockBuffer.join('\n'),
        metadata: {
          language: codeLanguage,
          timestamp: new Date(),
        },
      });
    }

    return chunks;
  }

  /**
   * Check if a chunk is incomplete (for buffering)
   */
  private isIncomplete(chunk: ParsedOutput): boolean {
    // Code blocks without closing ``` are incomplete
    if (chunk.type === 'code' && !chunk.content.includes('```')) {
      return true;
    }

    // Very short chunks might be incomplete
    if (chunk.content.length < 3) {
      return true;
    }

    return false;
  }

  /**
   * Clear buffer for a session
   */
  clearBuffer(sessionId: string): void {
    this.buffers.delete(sessionId);
    logger.debug(`Cleared output buffer for session ${sessionId}`);
  }

  /**
   * Extract file operations from output
   */
  extractFileOperations(output: string): Array<{
    operation: 'read' | 'write' | 'create' | 'update' | 'delete';
    path: string;
  }> {
    const operations: Array<{
      operation: 'read' | 'write' | 'create' | 'update' | 'delete';
      path: string;
    }> = [];

    const patterns = [
      { regex: /Reading:\s*([^\s]+)/gi, operation: 'read' as const },
      { regex: /Writing:\s*([^\s]+)/gi, operation: 'write' as const },
      { regex: /Created:\s*([^\s]+)/gi, operation: 'create' as const },
      { regex: /Updated:\s*([^\s]+)/gi, operation: 'update' as const },
      { regex: /Deleted:\s*([^\s]+)/gi, operation: 'delete' as const },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(output)) !== null) {
        operations.push({
          operation: pattern.operation,
          path: match[1],
        });
      }
    }

    return operations;
  }

  /**
   * Extract tool calls from output
   */
  extractToolCalls(output: string): Array<{
    tool: string;
    context: string;
  }> {
    const toolCalls: Array<{ tool: string; context: string }> = [];

    const toolPattern = /(?:Tool:|Using tool:)\s*(\w+)([^\n]*)/gi;
    let match;

    while ((match = toolPattern.exec(output)) !== null) {
      toolCalls.push({
        tool: match[1],
        context: match[2].trim(),
      });
    }

    return toolCalls;
  }

  /**
   * Summarize output for quick preview
   */
  summarizeOutput(output: string, maxLength: number = 200): string {
    // Remove ANSI color codes
    const cleaned = output.replace(/\x1b\[[0-9;]*m/g, '');

    // Get first meaningful line
    const lines = cleaned.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      return 'No output';
    }

    const firstLine = lines[0];

    if (firstLine.length <= maxLength) {
      return firstLine;
    }

    return firstLine.substring(0, maxLength - 3) + '...';
  }
}
