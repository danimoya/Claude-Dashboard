/**
 * CLI WebSocket Gateway
 * Real-time CLI output streaming via WebSocket
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { ClaudeWrapperService } from '../services/claude-wrapper.service.js';
import { CLIOutputParserService } from '../services/cli-output-parser.service.js';
import { CLISessionService } from '../services/cli-session.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export class CLIGateway {
  private claudeWrapper: ClaudeWrapperService;
  private outputParser: CLIOutputParserService;
  private sessionService: CLISessionService;

  constructor(
    private io: SocketIOServer,
    claudeWrapper: ClaudeWrapperService,
    outputParser: CLIOutputParserService,
    sessionService: CLISessionService
  ) {
    this.claudeWrapper = claudeWrapper;
    this.outputParser = outputParser;
    this.sessionService = sessionService;

    this.setupGateway();
  }

  /**
   * Setup WebSocket gateway
   */
  private setupGateway(): void {
    // Create CLI namespace
    const cliNamespace = this.io.of('/cli');

    // Authentication middleware
    cliNamespace.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
        (socket as any).userId = payload.userId;

        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Handle connections
    cliNamespace.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;

      logger.info(`CLI WebSocket client connected: ${socket.id}`, { userId });

      // Handle session subscription
      socket.on('subscribe:session', async (sessionId: string) => {
        try {
          // Verify session belongs to user
          const session = await this.sessionService.getSession(sessionId, userId);

          // Join session room
          socket.join(`session:${sessionId}`);

          logger.info(`Client ${socket.id} subscribed to session ${sessionId}`);

          socket.emit('subscribed', { sessionId });
        } catch (error) {
          logger.error(`Failed to subscribe to session ${sessionId}`, error);
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Failed to subscribe',
          });
        }
      });

      // Handle session unsubscription
      socket.on('unsubscribe:session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`);
        logger.info(`Client ${socket.id} unsubscribed from session ${sessionId}`);
      });

      // Handle project subscription (for all sessions in a project)
      socket.on('subscribe:project', async (projectId: string) => {
        try {
          // Get all sessions for the project
          const sessions = await this.sessionService.getProjectSessions(projectId, userId);

          // Join all session rooms
          for (const session of sessions) {
            socket.join(`session:${session.id}`);
          }

          // Also join project room for new sessions
          socket.join(`project:${projectId}`);

          logger.info(`Client ${socket.id} subscribed to project ${projectId}`);

          socket.emit('subscribed', { projectId, sessionCount: sessions.length });
        } catch (error) {
          logger.error(`Failed to subscribe to project ${projectId}`, error);
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Failed to subscribe',
          });
        }
      });

      // Handle input sending
      socket.on('send:input', async (data: { sessionId: string; input: string }) => {
        try {
          const { sessionId, input } = data;

          // Verify session belongs to user
          await this.sessionService.getSession(sessionId, userId);

          // Send input to CLI
          await this.claudeWrapper.sendInput(sessionId, input);

          // Record command
          await this.sessionService.recordCommand(sessionId, input);

          socket.emit('input:sent', { sessionId });
        } catch (error) {
          logger.error('Failed to send input', error);
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Failed to send input',
          });
        }
      });

      // Handle session stop
      socket.on('stop:session', async (sessionId: string) => {
        try {
          // Verify session belongs to user
          await this.sessionService.getSession(sessionId, userId);

          // Stop the CLI session
          await this.claudeWrapper.stopSession(sessionId);

          // Update session status
          await this.sessionService.updateSessionStatus(sessionId, 'stopped');

          socket.emit('session:stopped', { sessionId });
        } catch (error) {
          logger.error(`Failed to stop session ${sessionId}`, error);
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Failed to stop session',
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`CLI WebSocket client disconnected: ${socket.id}`);
      });
    });

    // Setup output streaming
    this.setupOutputStreaming(cliNamespace);

    logger.info('CLI WebSocket gateway initialized');
  }

  /**
   * Setup output streaming from CLI wrapper
   */
  private setupOutputStreaming(namespace: any): void {
    // Stream parsed output
    this.outputParser.on('parsed', (streamChunk) => {
      const { sessionId, chunks } = streamChunk;

      // Emit to all clients subscribed to this session
      namespace.to(`session:${sessionId}`).emit('output', {
        sessionId,
        chunks,
        timestamp: streamChunk.timestamp,
      });
    });

    // Stream raw output (for debugging)
    this.claudeWrapper.on('output', (output) => {
      const { sessionId, type, data } = output;

      namespace.to(`session:${sessionId}`).emit('output:raw', {
        sessionId,
        type,
        data,
        timestamp: new Date(),
      });
    });

    // Handle session exit
    this.claudeWrapper.on('exit', ({ sessionId, code, signal }) => {
      namespace.to(`session:${sessionId}`).emit('session:exit', {
        sessionId,
        code,
        signal,
        timestamp: new Date(),
      });

      logger.info(`Session ${sessionId} exited, notified clients`);
    });

    // Handle session errors
    this.claudeWrapper.on('error', ({ sessionId, error }) => {
      namespace.to(`session:${sessionId}`).emit('session:error', {
        sessionId,
        error: error.message,
        timestamp: new Date(),
      });

      logger.error(`Session ${sessionId} errored, notified clients`);
    });
  }

  /**
   * Broadcast session event to project subscribers
   */
  broadcastToProject(projectId: string, event: string, data: any): void {
    this.io.of('/cli').to(`project:${projectId}`).emit(event, data);
  }

  /**
   * Broadcast to specific session
   */
  broadcastToSession(sessionId: string, event: string, data: any): void {
    this.io.of('/cli').to(`session:${sessionId}`).emit(event, data);
  }
}

/**
 * Initialize CLI Gateway
 */
export function initializeCLIGateway(
  io: SocketIOServer,
  claudeWrapper: ClaudeWrapperService,
  outputParser: CLIOutputParserService,
  sessionService: CLISessionService
): CLIGateway {
  return new CLIGateway(io, claudeWrapper, outputParser, sessionService);
}
