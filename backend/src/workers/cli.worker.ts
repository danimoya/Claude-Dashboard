/**
 * CLI Worker
 * Processes CLI command jobs from the queue
 */

import { Job } from 'bull';
import { cliQueue, CLIJobData, CLIJobResult } from '../config/queue.js';
import { ClaudeWrapperService } from '../services/claude-wrapper.service.js';
import { CLISessionService } from '../services/cli-session.service.js';
import { CLIOutputParserService } from '../services/cli-output-parser.service.js';
import { logger } from '../utils/logger.js';

const claudeWrapper = new ClaudeWrapperService();
const sessionService = new CLISessionService();
const outputParser = new CLIOutputParserService();

/**
 * Process CLI command job
 */
cliQueue.process(async (job: Job<CLIJobData>): Promise<CLIJobResult> => {
  const { sessionId, projectId, userId, command, args, cwd, env } = job.data;
  const startTime = Date.now();

  logger.info(`Processing CLI job ${job.id}`, {
    sessionId,
    command,
  });

  try {
    // Update job progress
    await job.progress(10);

    // Get session from database
    const dbSession = await sessionService.getSession(sessionId, userId);

    await job.progress(20);

    // Start CLI session
    const cliSession = await claudeWrapper.startSession(
      sessionId,
      projectId,
      dbSession.type,
      { command, args, cwd, env }
    );

    await job.progress(30);

    // Setup output handler
    const outputBuffer: string[] = [];

    claudeWrapper.on('output', async (output) => {
      if (output.sessionId === sessionId) {
        outputBuffer.push(output.data);

        // Parse and store output
        const parsed = outputParser.parseOutput(sessionId, output.data);

        // Update session metadata
        await sessionService.recordOutput(sessionId, output.data, output.type);

        // Update job progress based on output
        await job.progress(50);
      }
    });

    // Setup exit handler
    return new Promise<CLIJobResult>((resolve, reject) => {
      claudeWrapper.once('exit', async ({ sessionId: exitSessionId, code }) => {
        if (exitSessionId === sessionId) {
          const duration = Date.now() - startTime;

          // Update session status
          await sessionService.updateSessionStatus(
            sessionId,
            code === 0 ? 'stopped' : 'error'
          );

          // Clear output buffer
          outputParser.clearBuffer(sessionId);

          await job.progress(100);

          if (code === 0) {
            logger.info(`CLI job ${job.id} completed successfully`, {
              sessionId,
              duration,
            });

            resolve({
              sessionId,
              success: true,
              output: outputBuffer.join('\n'),
              duration,
            });
          } else {
            logger.error(`CLI job ${job.id} failed with code ${code}`, {
              sessionId,
              duration,
            });

            resolve({
              sessionId,
              success: false,
              error: `Process exited with code ${code}`,
              output: outputBuffer.join('\n'),
              duration,
            });
          }
        }
      });

      claudeWrapper.once('error', async ({ sessionId: errorSessionId, error }) => {
        if (errorSessionId === sessionId) {
          const duration = Date.now() - startTime;

          // Update session status
          await sessionService.updateSessionStatus(sessionId, 'error');

          // Clear output buffer
          outputParser.clearBuffer(sessionId);

          logger.error(`CLI job ${job.id} errored`, {
            sessionId,
            error: error.message,
          });

          reject(error);
        }
      });

      // Set timeout (30 minutes max)
      setTimeout(async () => {
        try {
          await claudeWrapper.stopSession(sessionId);
          reject(new Error('Job timeout'));
        } catch (err) {
          reject(err);
        }
      }, 30 * 60 * 1000);
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(`CLI job ${job.id} processing failed`, {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update session status
    await sessionService.updateSessionStatus(sessionId, 'error');

    return {
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    };
  }
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  logger.info('CLI worker received SIGTERM, shutting down gracefully');

  await claudeWrapper.cleanup();
  await cliQueue.close();

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('CLI worker received SIGINT, shutting down gracefully');

  await claudeWrapper.cleanup();
  await cliQueue.close();

  process.exit(0);
});

logger.info('CLI worker started');
