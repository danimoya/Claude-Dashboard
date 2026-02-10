/**
 * Claude CLI Wrapper Service
 * Manages Claude Code and Claude-B CLI processes
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import type { ProjectType } from '@shared/types';

export interface CLISession {
  id: string;
  projectId: string;
  type: ProjectType;
  process: ChildProcess;
  startedAt: Date;
  lastActivity: Date;
  status: 'running' | 'stopped' | 'error';
}

export interface CLICommand {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface CLIOutput {
  sessionId: string;
  type: 'stdout' | 'stderr' | 'error' | 'exit';
  data: string;
  timestamp: Date;
}

export class ClaudeWrapperService extends EventEmitter {
  private sessions: Map<string, CLISession> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    this.startCleanupTimer();
  }

  /**
   * Start a new CLI session
   */
  async startSession(
    sessionId: string,
    projectId: string,
    type: ProjectType,
    command: CLICommand
  ): Promise<CLISession> {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      throw AppError.conflict('Session already exists');
    }

    try {
      // Determine CLI command based on type
      const cliCommand = type === 'claude-code' ? 'claude' : 'cb';
      const fullArgs = [command.command, ...(command.args || [])];

      logger.info(`Starting CLI session ${sessionId}`, {
        type,
        command: cliCommand,
        args: fullArgs,
      });

      // Spawn the CLI process
      const childProcess = spawn(cliCommand, fullArgs, {
        cwd: command.cwd || process.cwd(),
        env: {
          ...process.env,
          ...command.env,
        },
        shell: true,
      });

      // Create session object
      const session: CLISession = {
        id: sessionId,
        projectId,
        type,
        process: childProcess,
        startedAt: new Date(),
        lastActivity: new Date(),
        status: 'running',
      };

      // Setup process event handlers
      this.setupProcessHandlers(session);

      // Store session
      this.sessions.set(sessionId, session);

      return session;
    } catch (error) {
      logger.error(`Failed to start CLI session ${sessionId}`, error);
      throw AppError.internal('Failed to start CLI session');
    }
  }

  /**
   * Send input to a running session
   */
  async sendInput(sessionId: string, input: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw AppError.notFound('Session not found');
    }

    if (session.status !== 'running') {
      throw AppError.badRequest('Session is not running');
    }

    try {
      session.process.stdin?.write(input + '\n');
      session.lastActivity = new Date();

      logger.debug(`Sent input to session ${sessionId}`, { input });
    } catch (error) {
      logger.error(`Failed to send input to session ${sessionId}`, error);
      throw AppError.internal('Failed to send input');
    }
  }

  /**
   * Stop a running session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw AppError.notFound('Session not found');
    }

    try {
      if (session.status === 'running') {
        session.process.kill('SIGTERM');

        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (session.status === 'running') {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }

      session.status = 'stopped';
      session.lastActivity = new Date();

      logger.info(`Stopped CLI session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to stop session ${sessionId}`, error);
      throw AppError.internal('Failed to stop session');
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CLISession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a project
   */
  getProjectSessions(projectId: string): CLISession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.projectId === projectId
    );
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CLISession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.status === 'running'
    );
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(session: CLISession): void {
    const { id, process: childProcess } = session;

    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output: CLIOutput = {
        sessionId: id,
        type: 'stdout',
        data: data.toString(),
        timestamp: new Date(),
      };

      session.lastActivity = new Date();
      this.emit('output', output);

      logger.debug(`Session ${id} stdout`, { data: data.toString() });
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const output: CLIOutput = {
        sessionId: id,
        type: 'stderr',
        data: data.toString(),
        timestamp: new Date(),
      };

      session.lastActivity = new Date();
      this.emit('output', output);

      logger.debug(`Session ${id} stderr`, { data: data.toString() });
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      const output: CLIOutput = {
        sessionId: id,
        type: 'error',
        data: error.message,
        timestamp: new Date(),
      };

      session.status = 'error';
      session.lastActivity = new Date();
      this.emit('output', output);
      this.emit('error', { sessionId: id, error });

      logger.error(`Session ${id} error`, error);
    });

    // Handle process exit
    childProcess.on('exit', (code: number | null, signal: string | null) => {
      const output: CLIOutput = {
        sessionId: id,
        type: 'exit',
        data: `Process exited with code ${code} and signal ${signal}`,
        timestamp: new Date(),
      };

      session.status = 'stopped';
      session.lastActivity = new Date();
      this.emit('output', output);
      this.emit('exit', { sessionId: id, code, signal });

      logger.info(`Session ${id} exited`, { code, signal });

      // Remove session after exit
      setTimeout(() => this.sessions.delete(id), 5000);
    });
  }

  /**
   * Cleanup inactive sessions
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [sessionId, session] of this.sessions.entries()) {
        const inactiveDuration = now - session.lastActivity.getTime();

        if (inactiveDuration > this.sessionTimeout && session.status === 'running') {
          logger.info(`Cleaning up inactive session ${sessionId}`);
          this.stopSession(sessionId).catch((error) => {
            logger.error(`Failed to cleanup session ${sessionId}`, error);
          });
        }
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Cleanup all sessions on shutdown
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up all CLI sessions');

    for (const sessionId of this.sessions.keys()) {
      try {
        await this.stopSession(sessionId);
      } catch (error) {
        logger.error(`Failed to cleanup session ${sessionId}`, error);
      }
    }

    this.sessions.clear();
  }
}
