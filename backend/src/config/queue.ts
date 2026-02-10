/**
 * Bull Queue Configuration
 * Task queue for CLI command execution
 */

import Bull, { Queue, Job, JobOptions } from 'bull';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export interface CLIJobData {
  sessionId: string;
  projectId: string;
  userId: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface CLIJobResult {
  sessionId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

// Create Bull queues
export const cliQueue: Queue<CLIJobData> = new Bull('cli-commands', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200, // Keep last 200 failed jobs
  },
});

// Voice transcription queue (for future Sprint 4)
export const voiceQueue: Queue = new Bull('voice-transcription', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
  },
});

// Scheduler queue (for future Sprint 5)
export const schedulerQueue: Queue = new Bull('scheduled-tasks', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
  },
});

/**
 * Add a CLI command to the queue
 */
export async function addCLIJob(
  data: CLIJobData,
  options?: JobOptions
): Promise<Job<CLIJobData>> {
  const job = await cliQueue.add(data, {
    priority: options?.priority || 1,
    ...options,
  });

  logger.info(`Added CLI job ${job.id} to queue`, {
    sessionId: data.sessionId,
    command: data.command,
  });

  return job;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string | number): Promise<{
  id: string | number;
  state: string;
  progress: number | object;
  failedReason?: string;
  result?: any;
}> {
  const job = await cliQueue.getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  const state = await job.getState();
  const progress = job.progress();
  const failedReason = job.failedReason;

  return {
    id: job.id,
    state,
    progress,
    failedReason,
    result: job.returnvalue,
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queue: Queue): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

/**
 * Setup queue event handlers
 */
export function setupQueueEventHandlers(): void {
  // CLI Queue events
  cliQueue.on('completed', (job: Job, result: CLIJobResult) => {
    logger.info(`CLI job ${job.id} completed`, {
      sessionId: result.sessionId,
      duration: result.duration,
    });
  });

  cliQueue.on('failed', (job: Job, err: Error) => {
    logger.error(`CLI job ${job.id} failed`, {
      error: err.message,
      sessionId: job.data.sessionId,
    });
  });

  cliQueue.on('stalled', (job: Job) => {
    logger.warn(`CLI job ${job.id} stalled`, {
      sessionId: job.data.sessionId,
    });
  });

  cliQueue.on('error', (error: Error) => {
    logger.error('CLI queue error', error);
  });

  // Voice Queue events
  voiceQueue.on('completed', (job: Job) => {
    logger.info(`Voice job ${job.id} completed`);
  });

  voiceQueue.on('failed', (job: Job, err: Error) => {
    logger.error(`Voice job ${job.id} failed`, err);
  });

  // Scheduler Queue events
  schedulerQueue.on('completed', (job: Job) => {
    logger.info(`Scheduled job ${job.id} completed`);
  });

  schedulerQueue.on('failed', (job: Job, err: Error) => {
    logger.error(`Scheduled job ${job.id} failed`, err);
  });
}

/**
 * Cleanup queues on shutdown
 */
export async function cleanupQueues(): Promise<void> {
  logger.info('Cleaning up queues');

  await Promise.all([
    cliQueue.close(),
    voiceQueue.close(),
    schedulerQueue.close(),
  ]);

  logger.info('All queues closed');
}

/**
 * Pause queue processing
 */
export async function pauseQueue(queue: Queue): Promise<void> {
  await queue.pause();
  logger.info(`Queue ${queue.name} paused`);
}

/**
 * Resume queue processing
 */
export async function resumeQueue(queue: Queue): Promise<void> {
  await queue.resume();
  logger.info(`Queue ${queue.name} resumed`);
}

/**
 * Clear all jobs from queue
 */
export async function clearQueue(queue: Queue): Promise<void> {
  await queue.empty();
  logger.info(`Queue ${queue.name} cleared`);
}
