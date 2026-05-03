/**
 * useCBStream Hook
 * Connects to the backend's CB WebSocket proxy for live session output.
 * Falls back gracefully when the WS connection is unavailable.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

interface UseCBStreamResult {
  /** Accumulated output lines */
  output: string;
  /** Whether the WebSocket is connected */
  connected: boolean;
  /** Manually reconnect */
  reconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export function useCBStream(sessionId: string | null): UseCBStreamResult {
  const [output, setOutput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = useCallback(() => {
    // Get the dashboard JWT from auth store
    return useAuthStore.getState().accessToken;
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const token = getToken();
    if (!token) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/v1/cb/sessions/${sessionId}/stream?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      attemptsRef.current = 0;
    };

    // The cb daemon sends JSON envelopes:
    //   { type: 'connected', sessionId, status }
    //   { type: 'output',    data: { content: string, buffered?: boolean } }
    //   { type: 'prompt.completed', promptId, exitCode }
    //   { type: 'status',    status: '...' }
    //   { type: 'error',     error: string }
    // Pluck `data.content` from `output` events and accumulate; render
    // anything else inline as a small annotation so the user can see the
    // stream is alive.
    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw) return;
      try {
        const msg = JSON.parse(raw);
        if (msg?.type === 'output' && typeof msg?.data?.content === 'string') {
          setOutput((prev) => prev + msg.data.content);
        } else if (msg?.type === 'prompt.completed') {
          setOutput((prev) => prev + `\n[prompt completed · exit ${msg.exitCode ?? 0}]\n`);
        } else if (msg?.type === 'connected') {
          setOutput((prev) => prev + `[stream connected · status: ${msg.status ?? '?'}]\n`);
        } else if (msg?.type === 'error') {
          setOutput((prev) => prev + `[stream error: ${msg.error ?? 'unknown'}]\n`);
        }
        // status / unknown — ignore
      } catch {
        // Not JSON — fall back to raw append (defensive).
        setOutput((prev) => prev + raw);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      // Auto-reconnect
      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [sessionId, getToken]);

  const reconnect = useCallback(() => {
    attemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount / sessionId change
  useEffect(() => {
    setOutput('');
    attemptsRef.current = 0;
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, connect]);

  return { output, connected, reconnect };
}
