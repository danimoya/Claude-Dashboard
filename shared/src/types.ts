/**
 * Shared TypeScript types for Claude Dashboard
 */

export type ProjectType = 'claude-code' | 'claude-flow';
export type ProjectStatus = 'active' | 'inactive' | 'archived';
export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface User {
  id: string;
  username: string;
  email?: string;
  apiKeys?: {
    anthropic?: string;
    openai?: string;
    speechmatics?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  path: string;
  status: ProjectStatus;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  projectId: string;
  type: ProjectType;
  status: SessionStatus;
  startedAt: Date;
  endedAt?: Date;
  error?: string;
}

export interface Task {
  id: string;
  sessionId: string;
  command: string;
  args?: string[];
  status: TaskStatus;
  output?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}

export interface Transcript {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface EnhancedPrompt {
  original: string;
  enhanced: string;
  provider: 'openai' | 'anthropic';
  timestamp: Date;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  cpu?: string;
  memory?: string;
  ports?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
