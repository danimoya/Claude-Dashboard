/**
 * Environment configuration with validation
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server configuration
  PORT: z.string().transform(Number).default('5000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Database configuration
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_USER: z.string().default('claude'),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().default('claude_dashboard_dev'),

  // Redis configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT configuration
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // API keys (external services)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  SPEECHMATICS_API_KEY: z.string().optional(),

  // Service configuration
  VOICE_PROVIDER: z.enum(['speechmatics', 'openai', 'assemblyai']).default('speechmatics'),
  PROMPT_ENHANCEMENT_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),

  // Projects
  PROJECTS_BASE_PATH: z.string().default('/app/projects'),

  // Security configuration
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
});

// Parse and validate environment
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

const env = parsed.data;

// Export structured configuration
export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  frontendUrl: env.FRONTEND_URL,

  database: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  apiKeys: {
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    speechmatics: env.SPEECHMATICS_API_KEY,
  },

  services: {
    voiceProvider: env.VOICE_PROVIDER,
    promptEnhancementProvider: env.PROMPT_ENHANCEMENT_PROVIDER,
  },

  projectsBasePath: env.PROJECTS_BASE_PATH,

  cors: {
    origins: env.CORS_ORIGINS.split(','),
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
} as const;
