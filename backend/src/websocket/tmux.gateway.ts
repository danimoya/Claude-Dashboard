/**
 * Tmux WebSocket Gateway
 * Streams `tmux capture-pane` snapshots to subscribed clients on a tick.
 *
 * Protocol (namespace: /tmux):
 *   client → emit('subscribe', { session, intervalMs? }) → starts polling
 *   client → emit('unsubscribe')                         → stops polling
 *   client → emit('keys', { tokens, literal? })          → tmux send-keys
 *   server → emit('snapshot', { session, text, ts })
 *   server → emit('error', { message })
 *
 * Auth: same JWT-in-handshake pattern as the existing CLI gateway.
 */

import type { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { tmuxService } from '../services/tmux.service.js';

const MIN_INTERVAL = 500;
const MAX_INTERVAL = 10_000;
const DEFAULT_INTERVAL = 1500;

interface SubState {
  session: string;
  window?: number;
  pane?: number;
  timer: NodeJS.Timeout | null;
  lastText: string;
}

export function initializeTmuxGateway(io: SocketIOServer): void {
  const ns = io.of('/tmux');

  ns.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Unauthorized: missing token'));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
      (socket.data as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Unauthorized: invalid token'));
    }
  });

  ns.on('connection', (socket: Socket) => {
    const state: SubState = { session: '', timer: null, lastText: '' };

    const stop = () => {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
    };

    const tick = async () => {
      if (!state.session) return;
      try {
        const snap = await tmuxService.capturePane(state.session, {
          window: state.window,
          pane: state.pane,
          scrollback: 200,
        });
        if (snap.text !== state.lastText) {
          state.lastText = snap.text;
          socket.emit('snapshot', {
            session: snap.session,
            window: state.window,
            pane: state.pane,
            text: snap.text,
            ts: snap.capturedAt,
          });
        }
      } catch (err: any) {
        socket.emit('error', { message: err?.message || 'capture-pane failed' });
        stop();
      }
    };

    socket.on(
      'subscribe',
      async (payload: { session?: string; window?: number; pane?: number; intervalMs?: number } = {}) => {
        const { session, window, pane, intervalMs } = payload;
        if (!session || typeof session !== 'string') {
          socket.emit('error', { message: 'session required' });
          return;
        }
        stop();
        state.session = session;
        state.window = typeof window === 'number' ? window : undefined;
        state.pane = typeof pane === 'number' ? pane : undefined;
        state.lastText = '';
        const ms = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, intervalMs ?? DEFAULT_INTERVAL));
        void tick();
        state.timer = setInterval(tick, ms);
      }
    );

    socket.on('unsubscribe', () => stop());

    socket.on('keys', async (payload: { tokens?: string[]; literal?: boolean } = {}) => {
      if (!state.session) {
        socket.emit('error', { message: 'subscribe before sending keys' });
        return;
      }
      const tokens = payload.tokens || [];
      try {
        // Send keys to the currently-focused pane of the active window.
        const target =
          state.window !== undefined
            ? `${state.session}:${state.window}${state.pane !== undefined ? '.' + state.pane : ''}`
            : state.session;
        await tmuxService.sendKeysToTarget(target, tokens, { literal: payload.literal });
      } catch (err: any) {
        socket.emit('error', { message: err?.message || 'send-keys failed' });
      }
    });

    socket.on('disconnect', () => {
      stop();
      logger.debug(`tmux ws disconnect: ${socket.id}`);
    });
  });

  logger.info('Tmux WebSocket gateway initialized');
}
