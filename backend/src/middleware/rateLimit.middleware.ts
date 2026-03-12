/**
 * Rate Limiting Middleware
 * Uses Redis to track request counts per IP/user
 */

import type { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

/**
 * Create rate limit middleware
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || config.rateLimit.windowMs;
  const maxRequests = options.maxRequests || config.rateLimit.maxRequests;
  const keyPrefix = options.keyPrefix || 'ratelimit:';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Use user ID if authenticated, otherwise use IP
      const identifier = req.userId || req.ip || 'unknown';
      const key = `${keyPrefix}${identifier}`;

      // Get current count
      const current = await redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);

      // Check if rate limit exceeded
      if (current > maxRequests) {
        throw AppError.badRequest('Too many requests, please try again later', {
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      next();
    } catch (error) {
      // If Redis is down, allow request
      if (error instanceof AppError) {
        next(error);
      } else {
        next();
      }
    }
  };
}

/**
 * Strict rate limit for auth endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 15, // 15 attempts
  keyPrefix: 'auth:',
});
