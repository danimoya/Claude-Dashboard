/**
 * useTmuxStream
 * Subscribes to a live tmux pane snapshot stream over the /tmux Socket.IO
 * namespace. Returns the latest captured text plus a sendKeys helper.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export interface UseTmuxStream {
  text: string;
  connected: boolean;
  error: string | null;
  sendKeys: (tokens: string[], literal?: boolean) => void;
  reconnect: () => void;
}

export interface TmuxStreamTarget {
  session: string | null;
  window?: number;
  pane?: number;
}

export function useTmuxStream(
  target: TmuxStreamTarget | string | null,
  intervalMs = 1500
): UseTmuxStream {
  const session = typeof target === 'string' ? target : target?.session ?? null;
  const window = typeof target === 'string' ? undefined : target?.window;
  const pane = typeof target === 'string' ? undefined : target?.pane;
  const tokens = useAuthStore((s) => s.tokens);
  const accessToken = tokens?.accessToken;
  const socketRef = useRef<Socket | null>(null);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!session || !accessToken) return;

    socketRef.current?.disconnect();
    setText('');
    setError(null);

    const socket = io(`${WS_URL}/tmux`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('subscribe', { session, window, pane, intervalMs });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err: any) => setError(err?.message || 'connection failed'));
    socket.on('snapshot', (data: { session: string; text: string; ts: string }) => {
      setText(data.text || '');
    });
    socket.on('error', (data: { message: string }) => setError(data?.message || 'error'));
  }, [session, window, pane, accessToken, intervalMs]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.emit('unsubscribe');
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  const sendKeys = useCallback((tokens: string[], literal = false) => {
    socketRef.current?.emit('keys', { tokens, literal });
  }, []);

  return { text, connected, error, sendKeys, reconnect: connect };
}
