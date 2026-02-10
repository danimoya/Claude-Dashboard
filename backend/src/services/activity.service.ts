/**
 * Activity Service
 * Tracks and manages user activities across projects
 */

import { AppDataSource } from '../config/database.js';
import { Activity } from '../entities/Activity.entity.js';
import { logger } from '../utils/logger.js';

export interface CreateActivityDto {
  userId: string;
  projectId: string;
  type: 'file_edit' | 'session_start' | 'session_end' | 'command_run' | 'project_create' | 'project_update';
  metadata?: Record<string, any>;
}

export class ActivityService {
  private activityRepository = AppDataSource.getRepository(Activity);

  /**
   * Record an activity
   */
  async recordActivity(data: CreateActivityDto): Promise<Activity> {
    const activity = this.activityRepository.create(data);
    await this.activityRepository.save(activity);

    logger.debug(`Recorded activity ${activity.type} for user ${data.userId}`);

    return activity;
  }

  /**
   * Get recent activities for a project
   */
  async getProjectActivities(projectId: string, limit: number = 50): Promise<Activity[]> {
    return this.activityRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Get recent activities for a user
   */
  async getUserActivities(userId: string, limit: number = 50): Promise<Activity[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Clean up old activities
   */
  async cleanupOldActivities(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.activityRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    logger.info(`Cleaned up ${result.affected} old activities`);

    return result.affected || 0;
  }
}
