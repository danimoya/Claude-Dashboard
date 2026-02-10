/**
 * Shared constants for Claude Dashboard
 */

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const ROUTES = {
  AUTH: {
    LOGIN: `${API_PREFIX}/auth/login`,
    LOGOUT: `${API_PREFIX}/auth/logout`,
    REFRESH: `${API_PREFIX}/auth/refresh`,
    ME: `${API_PREFIX}/auth/me`,
  },
  PROJECTS: {
    BASE: `${API_PREFIX}/projects`,
    BY_ID: (id: string) => `${API_PREFIX}/projects/${id}`,
    FILES: (id: string) => `${API_PREFIX}/projects/${id}/files`,
  },
  SESSIONS: {
    BASE: `${API_PREFIX}/sessions`,
    BY_ID: (id: string) => `${API_PREFIX}/sessions/${id}`,
    LOGS: (id: string) => `${API_PREFIX}/sessions/${id}/logs`,
  },
  VOICE: {
    TRANSCRIBE: `${API_PREFIX}/voice/transcribe`,
  },
  PROMPT: {
    ENHANCE: `${API_PREFIX}/prompt/enhance`,
  },
  INFRASTRUCTURE: {
    CONTAINERS: `${API_PREFIX}/infrastructure/containers`,
    METRICS: `${API_PREFIX}/infrastructure/metrics`,
  },
} as const;

export const WEBSOCKET_EVENTS = {
  // Server -> Client
  PROJECT_STATUS: 'project:status',
  TASK_PROGRESS: 'task:progress',
  LOG_STREAM: 'log:stream',
  INFRASTRUCTURE_UPDATE: 'infrastructure:update',
  ERROR: 'error',

  // Client -> Server
  JOIN_SESSION: 'join:session',
  LEAVE_SESSION: 'leave:session',
  EXECUTE_COMMAND: 'execute:command',
  STOP_SESSION: 'stop:session',
} as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_FILES_PER_PROJECT = 1000;
export const SESSION_TIMEOUT = 3600000; // 1 hour
export const MAX_CONCURRENT_SESSIONS = 10;

export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'zh',
] as const;
