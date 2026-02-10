/**
 * CLI Session Management Service
 * Tracks and persists CLI session metadata
 */

import { AppDataSource } from '../config/database.js';
import { CLISession as CLISessionEntity } from '../entities/CLISession.entity.js';
import { Project } from '../entities/Project.entity.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { ProjectType } from '@shared/types';

export interface CreateSessionDto {
  projectId: string;
  type: ProjectType;
  command: string;
  args?: string[];
}

export interface SessionMetadata {
  totalCommands: number;
  lastCommand?: string;
  outputSize: number;
  errors: number;
}

export class CLISessionService {
  private sessionRepository = AppDataSource.getRepository(CLISessionEntity);
  private projectRepository = AppDataSource.getRepository(Project);

  /**
   * Create a new CLI session record
   */
  async createSession(userId: string, data: CreateSessionDto): Promise<CLISessionEntity> {
    // Verify project exists and belongs to user
    const project = await this.projectRepository.findOne({
      where: { id: data.projectId, userId },
    });

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    // Create session
    const session = this.sessionRepository.create({
      projectId: data.projectId,
      type: data.type,
      command: data.command,
      args: data.args || [],
      status: 'running',
      metadata: {
        totalCommands: 0,
        outputSize: 0,
        errors: 0,
      },
    });

    await this.sessionRepository.save(session);

    logger.info(`Created CLI session ${session.id}`, {
      projectId: data.projectId,
      type: data.type,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string, userId: string): Promise<CLISessionEntity> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['project'],
    });

    if (!session) {
      throw AppError.notFound('Session not found');
    }

    // Verify user owns the project
    if (session.project.userId !== userId) {
      throw AppError.forbidden('Access denied');
    }

    return session;
  }

  /**
   * Get all sessions for a project
   */
  async getProjectSessions(
    projectId: string,
    userId: string,
    options?: { limit?: number; status?: 'running' | 'stopped' | 'error' }
  ): Promise<CLISessionEntity[]> {
    // Verify project exists and belongs to user
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.projectId = :projectId', { projectId })
      .orderBy('session.startedAt', 'DESC');

    if (options?.status) {
      queryBuilder.andWhere('session.status = :status', { status: options.status });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    return queryBuilder.getMany();
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<CLISessionEntity[]> {
    return this.sessionRepository
      .createQueryBuilder('session')
      .innerJoin('session.project', 'project')
      .where('project.userId = :userId', { userId })
      .andWhere('session.status = :status', { status: 'running' })
      .orderBy('session.lastActivity', 'DESC')
      .getMany();
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: 'running' | 'stopped' | 'error'
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw AppError.notFound('Session not found');
    }

    session.status = status;
    session.lastActivity = new Date();

    if (status !== 'running') {
      session.endedAt = new Date();
    }

    await this.sessionRepository.save(session);

    logger.info(`Updated session ${sessionId} status to ${status}`);
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionId: string,
    metadata: Partial<SessionMetadata>
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw AppError.notFound('Session not found');
    }

    session.metadata = {
      ...session.metadata,
      ...metadata,
    };
    session.lastActivity = new Date();

    await this.sessionRepository.save(session);
  }

  /**
   * Record session output
   */
  async recordOutput(
    sessionId: string,
    output: string,
    type: 'stdout' | 'stderr'
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      return; // Session might have been deleted
    }

    // Update metadata
    const metadata = session.metadata as SessionMetadata;
    metadata.outputSize = (metadata.outputSize || 0) + output.length;

    if (type === 'stderr') {
      metadata.errors = (metadata.errors || 0) + 1;
    }

    session.metadata = metadata;
    session.lastActivity = new Date();

    await this.sessionRepository.save(session);
  }

  /**
   * Record command execution
   */
  async recordCommand(sessionId: string, command: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      return;
    }

    const metadata = session.metadata as SessionMetadata;
    metadata.totalCommands = (metadata.totalCommands || 0) + 1;
    metadata.lastCommand = command;

    session.metadata = metadata;
    session.lastActivity = new Date();

    await this.sessionRepository.save(session);
  }

  /**
   * Delete old sessions
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('endedAt < :cutoffDate', { cutoffDate })
      .andWhere('status != :status', { status: 'running' })
      .execute();

    logger.info(`Cleaned up ${result.affected} old sessions`);

    return result.affected || 0;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(userId: string): Promise<{
    total: number;
    running: number;
    stopped: number;
    error: number;
    averageDuration: number;
  }> {
    const sessions = await this.sessionRepository
      .createQueryBuilder('session')
      .innerJoin('session.project', 'project')
      .where('project.userId = :userId', { userId })
      .getMany();

    const stats = {
      total: sessions.length,
      running: sessions.filter((s) => s.status === 'running').length,
      stopped: sessions.filter((s) => s.status === 'stopped').length,
      error: sessions.filter((s) => s.status === 'error').length,
      averageDuration: 0,
    };

    // Calculate average duration for completed sessions
    const completedSessions = sessions.filter(
      (s) => s.endedAt && s.startedAt
    );

    if (completedSessions.length > 0) {
      const totalDuration = completedSessions.reduce((sum, session) => {
        return sum + (session.endedAt!.getTime() - session.startedAt.getTime());
      }, 0);

      stats.averageDuration = totalDuration / completedSessions.length;
    }

    return stats;
  }
}
