/**
 * Scheduler Service
 * Manages scheduled tasks using Bull queue
 */

import { schedulerQueue } from '../config/queue.js';
import { Job, JobOptions } from 'bull';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../config/database.js';
import { ScheduledTask } from '../entities/ScheduledTask.entity.js';

export interface ScheduleTaskDto {
  name: string;
  projectId: string;
  userId: string;
  type: 'cli_command' | 'backup' | 'cleanup' | 'sync';
  schedule: string; // Cron expression
  payload: Record<string, any>;
  enabled?: boolean;
}

export class SchedulerService {
  private taskRepository = AppDataSource.getRepository(ScheduledTask);

  /**
   * Create a scheduled task
   */
  async createScheduledTask(data: ScheduleTaskDto): Promise<ScheduledTask> {
    // Create database record
    const task = this.taskRepository.create({
      ...data,
      enabled: data.enabled ?? true,
      lastRun: null,
      nextRun: this.getNextRunTime(data.schedule),
    });

    await this.taskRepository.save(task);

    // Add to Bull queue with repeat option
    if (task.enabled) {
      await schedulerQueue.add(
        `scheduled-${task.id}`,
        {
          taskId: task.id,
          ...data.payload,
        },
        {
          repeat: {
            cron: data.schedule,
          },
          jobId: `scheduled-${task.id}`,
        }
      );

      logger.info(`Scheduled task created: ${task.name}`, {
        schedule: data.schedule,
        type: data.type,
      });
    }

    return task;
  }

  /**
   * Update scheduled task
   */
  async updateScheduledTask(
    taskId: string,
    userId: string,
    updates: Partial<ScheduleTaskDto>
  ): Promise<ScheduledTask> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Scheduled task not found');
    }

    // Remove old job
    await this.removeJob(`scheduled-${taskId}`);

    // Update task
    Object.assign(task, updates);

    if (updates.schedule) {
      task.nextRun = this.getNextRunTime(updates.schedule);
    }

    await this.taskRepository.save(task);

    // Add new job if enabled
    if (task.enabled && task.schedule) {
      await schedulerQueue.add(
        `scheduled-${task.id}`,
        {
          taskId: task.id,
          ...task.payload,
        },
        {
          repeat: {
            cron: task.schedule,
          },
          jobId: `scheduled-${task.id}`,
        }
      );
    }

    logger.info(`Scheduled task updated: ${task.name}`);

    return task;
  }

  /**
   * Delete scheduled task
   */
  async deleteScheduledTask(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Scheduled task not found');
    }

    // Remove job from queue
    await this.removeJob(`scheduled-${taskId}`);

    // Delete from database
    await this.taskRepository.remove(task);

    logger.info(`Scheduled task deleted: ${task.name}`);
  }

  /**
   * Enable/disable scheduled task
   */
  async toggleScheduledTask(taskId: string, userId: string, enabled: boolean): Promise<ScheduledTask> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Scheduled task not found');
    }

    if (enabled && !task.enabled) {
      // Enable: add to queue
      await schedulerQueue.add(
        `scheduled-${task.id}`,
        {
          taskId: task.id,
          ...task.payload,
        },
        {
          repeat: {
            cron: task.schedule,
          },
          jobId: `scheduled-${task.id}`,
        }
      );
    } else if (!enabled && task.enabled) {
      // Disable: remove from queue
      await this.removeJob(`scheduled-${taskId}`);
    }

    task.enabled = enabled;
    await this.taskRepository.save(task);

    logger.info(`Scheduled task ${enabled ? 'enabled' : 'disabled'}: ${task.name}`);

    return task;
  }

  /**
   * Get scheduled tasks for project
   */
  async getProjectTasks(projectId: string, userId: string): Promise<ScheduledTask[]> {
    return this.taskRepository.find({
      where: { projectId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Record task execution
   */
  async recordExecution(taskId: string, success: boolean, error?: string): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      return;
    }

    task.lastRun = new Date();
    task.nextRun = this.getNextRunTime(task.schedule);

    if (error) {
      task.lastError = error;
    }

    await this.taskRepository.save(task);
  }

  /**
   * Remove job from queue
   */
  private async removeJob(jobId: string): Promise<void> {
    const repeatableJobs = await schedulerQueue.getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.id === jobId);

    if (job) {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  private getNextRunTime(cronExpression: string): Date {
    // Simplified - would use cron-parser in production
    const now = new Date();
    return new Date(now.getTime() + 3600000); // 1 hour from now as placeholder
  }
}
