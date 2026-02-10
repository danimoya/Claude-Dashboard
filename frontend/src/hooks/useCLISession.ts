/**
 * CLI Session Hook
 * React hook for managing CLI sessions with WebSocket
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { cliService } from '../services/cli.service';

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

export interface OutputChunk {
  sessionId: string;
  chunks: ParsedOutput[];
  timestamp: Date;
}

export interface SessionExitEvent {
  sessionId: string;
  code: number | null;
  signal: string | null;
  timestamp: Date;
}

export interface SessionErrorEvent {
  sessionId: string;
  error: string;
  timestamp: Date;
}

export function useCLISession(sessionId?: string) {
  const { socket, isConnected, emit, on, off } = useWebSocket({
    namespace: '/cli',
    autoConnect: !!sessionId,
  });

  const [output, setOutput] = useState<ParsedOutput[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Subscribe to session on mount
  useEffect(() => {
    if (!sessionId || !isConnected) return;

    emit('subscribe:session', sessionId);

    const handleSubscribed = (data: { sessionId: string }) => {
      console.log('Subscribed to session:', data.sessionId);
      setIsSessionActive(true);
    };

    const handleOutput = (data: OutputChunk) => {
      if (data.sessionId === sessionId) {
        setOutput((prev) => [...prev, ...data.chunks]);
      }
    };

    const handleExit = (data: SessionExitEvent) => {
      if (data.sessionId === sessionId) {
        console.log('Session exited:', data);
        setIsSessionActive(false);
      }
    };

    const handleError = (data: SessionErrorEvent) => {
      if (data.sessionId === sessionId) {
        console.error('Session error:', data.error);
        setSessionError(data.error);
        setIsSessionActive(false);
      }
    };

    on('subscribed', handleSubscribed);
    on('output', handleOutput);
    on('session:exit', handleExit);
    on('session:error', handleError);

    return () => {
      emit('unsubscribe:session', sessionId);
      off('subscribed', handleSubscribed);
      off('output', handleOutput);
      off('session:exit', handleExit);
      off('session:error', handleError);
    };
  }, [sessionId, isConnected, emit, on, off]);

  // Send input to session
  const sendInput = useCallback(
    async (input: string) => {
      if (!sessionId) return;

      try {
        await cliService.sendInput(sessionId, input);
      } catch (error) {
        console.error('Failed to send input:', error);
        throw error;
      }
    },
    [sessionId]
  );

  // Stop session
  const stopSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await cliService.stopSession(sessionId);
      setIsSessionActive(false);
    } catch (error) {
      console.error('Failed to stop session:', error);
      throw error;
    }
  }, [sessionId]);

  // Clear output
  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  return {
    output,
    isSessionActive,
    sessionError,
    isConnected,
    sendInput,
    stopSession,
    clearOutput,
  };
}
