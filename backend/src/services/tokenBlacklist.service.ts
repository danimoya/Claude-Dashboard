/**
 * Token Blacklist Service
 * Manages revoked/blacklisted JWT tokens for logout functionality
 */

import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export class TokenBlacklistService {
  private readonly prefix = 'blacklist:token:';

  /**
   * Add token to blacklist
   */
  async addToken(token: string, expiresIn: number): Promise<void> {
    try {
      const key = this.getKey(token);
      // Store token with same TTL as token expiry
      await redis.set(key, '1', expiresIn);
      logger.debug(`Token blacklisted: ${token.substring(0, 10)}...`);
    } catch (error) {
      logger.error('Error adding token to blacklist:', error);
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    try {
      const key = this.getKey(token);
      return await redis.exists(key);
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Fail open - allow token if Redis is down
      return false;
    }
  }

  /**
   * Remove token from blacklist (rarely needed)
   */
  async removeToken(token: string): Promise<void> {
    try {
      const key = this.getKey(token);
      await redis.del(key);
    } catch (error) {
      logger.error('Error removing token from blacklist:', error);
    }
  }

  /**
   * Generate blacklist key
   */
  private getKey(token: string): string {
    return `${this.prefix}${token}`;
  }
}
