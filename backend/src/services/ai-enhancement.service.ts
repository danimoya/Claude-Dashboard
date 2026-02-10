/**
 * AI Enhancement Service
 * Enhances prompts using Claude/GPT APIs
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import fetch from 'node-fetch';

export interface EnhancementResult {
  originalPrompt: string;
  enhancedPrompt: string;
  suggestions?: string[];
  tokensUsed?: number;
}

export class AIEnhancementService {
  /**
   * Enhance prompt using Claude API
   */
  async enhanceWithClaude(prompt: string, context?: string): Promise<EnhancementResult> {
    const apiKey = config.anthropic?.apiKey;

    if (!apiKey) {
      logger.warn('Anthropic API key not configured, returning original prompt');
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
      };
    }

    try {
      const systemPrompt = `You are a prompt enhancement assistant. Your task is to take user prompts and make them more clear, specific, and effective for development tasks.

${context ? `Context: ${context}` : ''}

Rules:
- Maintain the user's intent
- Add helpful context and constraints
- Make requirements more explicit
- Structure the prompt for better results
- Keep it concise but complete`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: `Enhance this development prompt:\n\n${prompt}`,
            },
          ],
          system: systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const result: any = await response.json();
      const enhancedPrompt = result.content?.[0]?.text || prompt;

      logger.info('Prompt enhanced successfully with Claude');

      return {
        originalPrompt: prompt,
        enhancedPrompt,
        tokensUsed: result.usage?.total_tokens,
      };
    } catch (error) {
      logger.error('Claude enhancement error', error);
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
      };
    }
  }

  /**
   * Enhance prompt using OpenAI API
   */
  async enhanceWithOpenAI(prompt: string, context?: string): Promise<EnhancementResult> {
    const apiKey = config.openai?.apiKey;

    if (!apiKey) {
      logger.warn('OpenAI API key not configured, returning original prompt');
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
      };
    }

    try {
      const systemPrompt = `You are a prompt enhancement assistant. Make development prompts more clear, specific, and effective.

${context ? `Context: ${context}` : ''}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `Enhance this development prompt:\n\n${prompt}`,
            },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result: any = await response.json();
      const enhancedPrompt = result.choices?.[0]?.message?.content || prompt;

      logger.info('Prompt enhanced successfully with OpenAI');

      return {
        originalPrompt: prompt,
        enhancedPrompt,
        tokensUsed: result.usage?.total_tokens,
      };
    } catch (error) {
      logger.error('OpenAI enhancement error', error);
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
      };
    }
  }

  /**
   * Auto-enhance prompt with available provider
   */
  async enhance(prompt: string, context?: string, provider?: 'claude' | 'openai'): Promise<EnhancementResult> {
    if (provider === 'openai') {
      return this.enhanceWithOpenAI(prompt, context);
    }

    // Default to Claude
    return this.enhanceWithClaude(prompt, context);
  }
}
