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
 * In-memory fallback limiter.
 *
 * When Redis is unavailable we must NOT fail open (that would let an attacker
 * disable the limiter by knocking Redis over, then brute-force auth freely).
 * Instead we degrade to a per-process in-memory fixed-window counter so the
 * endpoint stays rate-limited (best-effort: not shared across instances, but
 * far safer than unbounded). Entries are lazily expired on read.
 */
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): { count: number; limited: boolean } {
  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, limited: 1 > maxRequests };
  }

  existing.count += 1;
  return { count: existing.count, limited: existing.count > maxRequests };
}

// Periodically sweep expired in-memory buckets so the map can't grow unbounded
// under sustained Redis outage. Unref so it never keeps the process alive.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryBuckets) {
    if (v.resetAt <= now) memoryBuckets.delete(k);
  }
}, 60_000);
if (typeof sweep.unref === 'function') sweep.unref();

/**
 * Create rate limit middleware
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || config.rateLimit.windowMs;
  const maxRequests = options.maxRequests || config.rateLimit.maxRequests;
  const keyPrefix = options.keyPrefix || 'ratelimit:';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Use user ID if authenticated, otherwise use IP
    const identifier = req.userId || req.ip || 'unknown';
    const key = `${keyPrefix}${identifier}`;

    let current: number;
    try {
      // Primary path: shared Redis counter.
      current = await redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }
    } catch (error) {
      // Redis is unavailable: degrade to the in-memory fallback limiter rather
      // than failing open. The endpoint stays rate-limited per-process.
      const fallback = memoryRateLimit(key, windowMs, maxRequests);
      current = fallback.count;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
    res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);

    // Check if rate limit exceeded
    if (current > maxRequests) {
      next(
        AppError.badRequest('Too many requests, please try again later', {
          retryAfter: Math.ceil(windowMs / 1000),
        })
      );
      return;
    }

    next();
  };
}

/**
 * Strict rate limit for auth endpoints.
 *
 * Tightened from 15/5min to 5/15min: these endpoints (login/register/refresh)
 * issue tokens that authorize host command execution, so brute-force resistance
 * matters more than convenience. The limiter now also degrades to an in-memory
 * counter instead of failing open when Redis is down (see `rateLimit` above).
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per window
  keyPrefix: 'auth:',
});
