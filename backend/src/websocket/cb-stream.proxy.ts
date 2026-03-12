/**
 * Claude-B WebSocket Stream Proxy
 * Proxies browser WebSocket connections to the Claude-B daemon,
 * handling JWT authentication for both dashboard users and CB sessions.
 */

import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { AuthService } from '../services/auth.service.js';
import { ClaudeBService } from '../services/claudeB.service.js';
import { logger } from '../utils/logger.js';

const authService = new AuthService();
const cbService = new ClaudeBService();

/**
 * Register the CB stream WebSocket proxy on the HTTP server.
 * Listens for upgrade requests matching /api/v1/cb/sessions/:id/stream
 */
export function registerCBStreamProxy(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    // Only handle our specific path pattern
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/api\/v1\/cb\/sessions\/([^/]+)\/stream$/);
    if (!match) return; // Let socket.io or other handlers deal with it

    const sessionId = match[1];

    // Authenticate the dashboard user via query param token
    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      authService.verifyAccessToken(token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Get CB daemon token and stream URL
    let cbToken: string;
    let streamUrl: string;
    try {
      cbToken = await cbService.getClientToken();
      streamUrl = cbService.getStreamUrl(sessionId);
    } catch (err) {
      logger.error('Failed to get CB stream credentials', err);
      socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
      return;
    }

    // Accept the browser's WebSocket connection
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      // Connect to the CB daemon WebSocket
      const daemonWs = new WebSocket(streamUrl, {
        headers: { Authorization: `Bearer ${cbToken}` },
      });

      let daemonReady = false;

      daemonWs.on('open', () => {
        daemonReady = true;
        logger.info(`CB stream proxy: connected to daemon for session ${sessionId}`);
      });

      // Pipe daemon → client
      daemonWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      // Pipe client → daemon
      clientWs.on('message', (data) => {
        if (daemonReady && daemonWs.readyState === WebSocket.OPEN) {
          daemonWs.send(data);
        }
      });

      // Close propagation
      daemonWs.on('close', (code, reason) => {
        logger.info(`CB stream proxy: daemon closed for session ${sessionId} (${code})`);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(code, reason);
        }
      });

      clientWs.on('close', () => {
        if (daemonWs.readyState === WebSocket.OPEN || daemonWs.readyState === WebSocket.CONNECTING) {
          daemonWs.close();
        }
      });

      // Error handling
      daemonWs.on('error', (err) => {
        logger.error(`CB stream proxy: daemon WS error for session ${sessionId}`, err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, 'Upstream error');
        }
      });

      clientWs.on('error', (err) => {
        logger.error(`CB stream proxy: client WS error for session ${sessionId}`, err);
        if (daemonWs.readyState === WebSocket.OPEN) {
          daemonWs.close();
        }
      });
    });
  });

  logger.info('CB WebSocket stream proxy registered');
}
