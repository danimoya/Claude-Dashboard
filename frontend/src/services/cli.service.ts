/**
 * CLI Service
 * API client for CLI session management
 */

import { api, ROUTES } from './api';
import type { CLISession, ProjectType } from '@shared/types';

export interface CreateSessionDto {
  projectId: string;
  type: ProjectType;
  command: string;
  args?: string[];
}

export interface SessionResponse {
  session: CLISession;
  jobId: string | number;
}

export interface JobStatus {
  id: string | number;
  state: string;
  progress: number | object;
  failedReason?: string;
  result?: any;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export const cliService = {
  /**
   * Create a new CLI session
   */
  async createSession(data: CreateSessionDto): Promise<SessionResponse> {
    const response = await api.post<{ data: SessionResponse }>(
      '/api/v1/cli/sessions',
      data
    );
    return response.data.data;
  },

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<CLISession> {
    const response = await api.get<{ data: CLISession }>(
      `/api/v1/cli/sessions/${sessionId}`
    );
    return response.data.data;
  },

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<CLISession[]> {
    const response = await api.get<{ data: CLISession[] }>(
      '/api/v1/cli/sessions'
    );
    return response.data.data;
  },

  /**
   * Get sessions for a project
   */
  async getProjectSessions(
    projectId: string,
    options?: { limit?: number; status?: 'running' | 'stopped' | 'error' }
  ): Promise<CLISession[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);

    const response = await api.get<{ data: CLISession[] }>(
      `/api/v1/cli/projects/${projectId}/sessions?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Send input to a session
   */
  async sendInput(sessionId: string, input: string): Promise<void> {
    await api.post(`/api/v1/cli/sessions/${sessionId}/input`, { input });
  },

  /**
   * Stop a session
   */
  async stopSession(sessionId: string): Promise<void> {
    await api.post(`/api/v1/cli/sessions/${sessionId}/stop`);
  },

  /**
   * Get job status
   */
  async getJobStatus(jobId: string | number): Promise<JobStatus> {
    const response = await api.get<{ data: JobStatus }>(
      `/api/v1/cli/jobs/${jobId}`
    );
    return response.data.data;
  },

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const response = await api.get<{ data: QueueStats }>(
      '/api/v1/cli/stats'
    );
    return response.data.data;
  },

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    total: number;
    running: number;
    stopped: number;
    error: number;
    averageDuration: number;
  }> {
    const response = await api.get('/api/v1/cli/sessions/stats');
    return response.data.data;
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await api.delete(`/api/v1/cli/sessions/${sessionId}`);
  },
};
