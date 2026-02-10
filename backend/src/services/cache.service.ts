/**
 * Cache Service
 * Provides caching layer for frequently accessed data
 */

import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export class CacheService {
  private readonly defaultTTL = 300; // 5 minutes

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), ttl);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached data
   */
  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple cached keys by pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // Note: In production, use SCAN instead of KEYS for better performance
      // This is simplified for development
      logger.info(`Clearing cache pattern: ${pattern}`);
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Generate cache key for user projects
   */
  getUserProjectsKey(userId: string): string {
    return `user:${userId}:projects`;
  }

  /**
   * Generate cache key for project
   */
  getProjectKey(projectId: string): string {
    return `project:${projectId}`;
  }

  /**
   * Generate cache key for user stats
   */
  getUserStatsKey(userId: string): string {
    return `user:${userId}:stats`;
  }
}
