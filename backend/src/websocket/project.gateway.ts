/**
 * Project WebSocket Gateway
 * Real-time project updates and collaboration
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { ProjectService } from '../services/project.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export interface ProjectUpdateEvent {
  projectId: string;
  type: 'created' | 'updated' | 'deleted';
  project?: any;
  timestamp: Date;
}

export interface UserPresence {
  userId: string;
  username: string;
  projectId: string;
  status: 'active' | 'idle' | 'away';
  lastActivity: Date;
}

export class ProjectGateway {
  private projectService: ProjectService;
  private userPresence: Map<string, UserPresence> = new Map();

  constructor(
    private io: SocketIOServer,
    projectService: ProjectService
  ) {
    this.projectService = projectService;
    this.setupGateway();
  }

  /**
   * Setup WebSocket gateway
   */
  private setupGateway(): void {
    // Create project namespace
    const projectNamespace = this.io.of('/projects');

    // Authentication middleware
    projectNamespace.use(async (socket: Socket, next) => {
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
    projectNamespace.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;

      logger.info(`Project WebSocket client connected: ${socket.id}`, { userId });

      // Handle project subscription
      socket.on('subscribe:project', async (projectId: string) => {
        try {
          // Verify user has access to project
          const project = await this.projectService.getProject(projectId, userId);

          // Join project room
          socket.join(`project:${projectId}`);

          // Update user presence
          this.updatePresence(userId, socket.id, projectId, 'active');

          // Broadcast presence to other users
          this.broadcastPresence(projectId);

          logger.info(`Client ${socket.id} subscribed to project ${projectId}`);

          socket.emit('subscribed', { projectId });
        } catch (error) {
          logger.error(`Failed to subscribe to project ${projectId}`, error);
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Failed to subscribe',
          });
        }
      });

      // Handle unsubscribe
      socket.on('unsubscribe:project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
        this.removePresence(socket.id);
        this.broadcastPresence(projectId);

        logger.info(`Client ${socket.id} unsubscribed from project ${projectId}`);
      });

      // Handle activity updates
      socket.on('activity:update', ({ projectId, action, data }: any) => {
        this.updatePresence(userId, socket.id, projectId, 'active');

        // Broadcast activity to other users in project
        socket.to(`project:${projectId}`).emit('activity:broadcast', {
          userId,
          action,
          data,
          timestamp: new Date(),
        });
      });

      // Handle status updates
      socket.on('status:update', ({ projectId, status }: { projectId: string; status: 'active' | 'idle' | 'away' }) => {
        this.updatePresence(userId, socket.id, projectId, status);
        this.broadcastPresence(projectId);
      });

      // Handle file changes
      socket.on('file:change', ({ projectId, path, type }: any) => {
        socket.to(`project:${projectId}`).emit('file:changed', {
          userId,
          path,
          type, // 'created' | 'modified' | 'deleted'
          timestamp: new Date(),
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const presence = Array.from(this.userPresence.values()).find(
          (p) => (p as any).socketId === socket.id
        );

        if (presence) {
          this.removePresence(socket.id);
          this.broadcastPresence(presence.projectId);
        }

        logger.info(`Project WebSocket client disconnected: ${socket.id}`);
      });
    });

    logger.info('Project WebSocket gateway initialized');
  }

  /**
   * Update user presence
   */
  private updatePresence(
    userId: string,
    socketId: string,
    projectId: string,
    status: 'active' | 'idle' | 'away'
  ): void {
    this.userPresence.set(socketId, {
      userId,
      username: '', // TODO: Get from user service
      projectId,
      status,
      lastActivity: new Date(),
      socketId,
    } as any);
  }

  /**
   * Remove user presence
   */
  private removePresence(socketId: string): void {
    this.userPresence.delete(socketId);
  }

  /**
   * Broadcast presence updates to project
   */
  private broadcastPresence(projectId: string): void {
    const projectUsers = Array.from(this.userPresence.values())
      .filter((p) => p.projectId === projectId)
      .map(({ userId, username, status, lastActivity }) => ({
        userId,
        username,
        status,
        lastActivity,
      }));

    this.io.of('/projects').to(`project:${projectId}`).emit('presence:update', {
      users: projectUsers,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast project update
   */
  broadcastProjectUpdate(event: ProjectUpdateEvent): void {
    const { projectId, type, project } = event;

    this.io.of('/projects').to(`project:${projectId}`).emit('project:update', {
      type,
      project,
      timestamp: event.timestamp,
    });

    logger.info(`Broadcasted project ${type} event for ${projectId}`);
  }

  /**
   * Broadcast file system change
   */
  broadcastFileChange(projectId: string, path: string, type: 'created' | 'modified' | 'deleted'): void {
    this.io.of('/projects').to(`project:${projectId}`).emit('file:changed', {
      path,
      type,
      timestamp: new Date(),
    });
  }
}

/**
 * Initialize Project Gateway
 */
export function initializeProjectGateway(
  io: SocketIOServer,
  projectService: ProjectService
): ProjectGateway {
  return new ProjectGateway(io, projectService);
}
