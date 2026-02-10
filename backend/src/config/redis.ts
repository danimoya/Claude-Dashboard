/**
 * Redis Configuration
 * Used for session management, caching, and token blacklist
 */

import { createClient, type RedisClientType } from 'redis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis connection
 */
export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await redisClient.connect();

    logger.info('Redis connected successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

/**
 * Disconnect Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}

/**
 * Redis utility functions
 */
export const redis = {
  /**
   * Set a key with optional TTL (in seconds)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    const client = getRedisClient();
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
  },

  /**
   * Get a key's value
   */
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    return await client.get(key);
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    return (await client.exists(key)) === 1;
  },

  /**
   * Set key expiration (in seconds)
   */
  async expire(key: string, seconds: number): Promise<void> {
    const client = getRedisClient();
    await client.expire(key, seconds);
  },

  /**
   * Increment a value
   */
  async incr(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.incr(key);
  },

  /**
   * Set a value in a hash
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    const client = getRedisClient();
    await client.hSet(key, field, value);
  },

  /**
   * Get a value from a hash
   */
  async hget(key: string, field: string): Promise<string | undefined> {
    const client = getRedisClient();
    return await client.hGet(key, field);
  },

  /**
   * Get all values from a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    const client = getRedisClient();
    return await client.hGetAll(key);
  },

  /**
   * Delete a field from a hash
   */
  async hdel(key: string, field: string): Promise<void> {
    const client = getRedisClient();
    await client.hDel(key, field);
  },
};
