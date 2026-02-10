/**
 * Voice Service
 * Voice transcription using Speechmatics API
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import fetch from 'node-fetch';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class VoiceService {
  private apiKey: string;
  private apiUrl = 'https://asr.api.speechmatics.com/v2';

  constructor() {
    this.apiKey = config.apiKeys.speechmatics || '';
  }

  /**
   * Transcribe audio file
   */
  async transcribe(audioBuffer: Buffer, language: string = 'en'): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('Speechmatics API key not configured');
    }

    try {
      const formData = new FormData();
      formData.append('data_file', new Blob([audioBuffer]), 'audio.wav');
      formData.append('config', JSON.stringify({
        type: 'transcription',
        transcription_config: {
          language,
          operating_point: 'enhanced',
          enable_partials: false,
          max_delay: 3,
        },
      }));

      const response = await fetch(`${this.apiUrl}/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData as any,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result: any = await response.json();

      // Extract transcription
      const transcript = result.results?.map((r: any) => r.alternatives?.[0]?.content).join(' ') || '';

      logger.info('Audio transcribed successfully', {
        duration: result.metadata?.duration,
        confidence: result.results?.[0]?.alternatives?.[0]?.confidence,
      });

      return {
        text: transcript,
        confidence: result.results?.[0]?.alternatives?.[0]?.confidence || 0,
        duration: result.metadata?.duration || 0,
        words: result.results?.[0]?.alternatives?.[0]?.words,
      };
    } catch (error) {
      logger.error('Voice transcription error', error);
      throw error;
    }
  }

  /**
   * Transcribe audio stream (real-time)
   */
  async transcribeStream(audioStream: ReadableStream): Promise<AsyncGenerator<string>> {
    // Placeholder for real-time streaming transcription
    // Would require WebSocket connection to Speechmatics
    throw new Error('Stream transcription not implemented');
  }
}
