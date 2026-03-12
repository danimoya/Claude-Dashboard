/**
 * CLI Terminal Component
 * Real-time CLI output terminal with input
 */

import { useState, useEffect, useRef } from 'react';
import { useCLISession, type ParsedOutput } from '../../hooks/useCLISession';

interface CLITerminalProps {
  sessionId: string;
  className?: string;
}

export default function CLITerminal({ sessionId, className = '' }: CLITerminalProps) {
  const {
    output,
    isSessionActive,
    sessionError,
    isConnected,
    sendInput,
    stopSession,
    clearOutput,
  } = useCLISession(sessionId);

  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    try {
      await sendInput(input);
      setCommandHistory((prev) => [...prev, input]);
      setInput('');
      setHistoryIndex(-1);
    } catch (error) {
      console.error('Failed to send input:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex + 1;
        if (newIndex < commandHistory.length) {
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const getOutputClassName = (chunk: ParsedOutput): string => {
    switch (chunk.type) {
      case 'error':
        return 'text-red-400';
      case 'command':
        return 'text-blue-400 font-semibold';
      case 'tool':
        return 'text-purple-400';
      case 'thinking':
        return 'text-yellow-400 italic';
      case 'code':
        return 'text-green-400 font-mono bg-zinc-900 p-2 rounded';
      case 'file':
        return 'text-cyan-400';
      default:
        return 'text-zinc-200';
    }
  };

  const renderOutput = (chunk: ParsedOutput, index: number) => {
    const className = getOutputClassName(chunk);

    if (chunk.type === 'code') {
      return (
        <pre key={index} className={className}>
          <code>{chunk.content}</code>
        </pre>
      );
    }

    return (
      <div key={index} className={className}>
        {chunk.content}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-zinc-950 text-zinc-100 ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-zinc-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={clearOutput}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            Clear
          </button>
          {isSessionActive && (
            <button
              onClick={stopSession}
              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1"
      >
        {output.length === 0 ? (
          <div className="text-muted-foreground italic">Waiting for output...</div>
        ) : (
          output.map((chunk, index) => renderOutput(chunk, index))
        )}

        {sessionError && (
          <div className="text-red-400 font-semibold mt-4">
            Error: {sessionError}
          </div>
        )}

        {!isSessionActive && output.length > 0 && (
          <div className="text-muted-foreground italic mt-4">
            Session ended
          </div>
        )}
      </div>

      {/* Terminal Input */}
      {isSessionActive && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-800">
          <div className="flex items-center px-4 py-2">
            <span className="text-green-400 mr-2">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-white font-mono"
              placeholder="Type command..."
              disabled={!isConnected}
            />
          </div>
        </form>
      )}
    </div>
  );
}
