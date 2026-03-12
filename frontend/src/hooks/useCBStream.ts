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

    ws.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : '';
      setOutput((prev) => prev + data);
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
