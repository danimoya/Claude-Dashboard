/**
 * Claude-B API Service
 * Frontend client for the Claude-B proxy endpoints.
 */

import { api } from './api';

export interface CBSession {
  id: string;
  name?: string;
  model?: string;
  status: 'idle' | 'busy';
  createdAt: string;
  workingDir?: string;
  promptCount?: number;
  goal?: string;
}

export interface CBNotification {
  id: string;
  sessionId: string;
  sessionName?: string;
  prompt: string;
  duration: number;
  exitCode: number;
  timestamp: string;
  read: boolean;
}

export interface CBHealth {
  status: string;
  timestamp: string;
  sessions: number;
}

export const claudeBService = {
  // Health
  async health(): Promise<CBHealth> {
    const res = await api.get('/api/v1/cb/health');
    return res.data.data;
  },

  // Sessions
  async listSessions(): Promise<{ sessions: CBSession[]; count: number }> {
    const res = await api.get('/api/v1/cb/sessions');
    return res.data.data;
  },

  async createSession(name?: string, model?: string): Promise<CBSession> {
    const res = await api.post('/api/v1/cb/sessions', { name, model });
    return res.data.data;
  },

  async getSession(id: string): Promise<CBSession> {
    const res = await api.get(`/api/v1/cb/sessions/${id}`);
    return res.data.data;
  },

  async killSession(id: string): Promise<void> {
    await api.delete(`/api/v1/cb/sessions/${id}`);
  },

  async sendPrompt(sessionId: string, prompt: string): Promise<{ promptId: string; status: string }> {
    const res = await api.post(`/api/v1/cb/sessions/${sessionId}/prompt`, { prompt });
    return res.data.data;
  },

  async getLastOutput(sessionId: string): Promise<{ output: string; status: string }> {
    const res = await api.get(`/api/v1/cb/sessions/${sessionId}/last`);
    return res.data.data;
  },

  async getTranscript(sessionId: string): Promise<any> {
    const res = await api.get(`/api/v1/cb/sessions/${sessionId}/transcript`);
    return res.data.data;
  },

  // Stream token for WebSocket
  async getStreamToken(): Promise<{ token: string; streamBase: string }> {
    const res = await api.get('/api/v1/cb/stream-token');
    return res.data.data;
  },

  // Notifications
  async getNotifications(unread?: boolean): Promise<CBNotification[]> {
    const qs = unread !== undefined ? `?unread=${unread}` : '';
    const res = await api.get(`/api/v1/cb/notifications${qs}`);
    return res.data.data;
  },

  async getNotificationCount(): Promise<{ total: number; unread: number }> {
    const res = await api.get('/api/v1/cb/notifications/count');
    return res.data.data;
  },

  async markNotificationRead(id: string): Promise<void> {
    await api.post(`/api/v1/cb/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.post('/api/v1/cb/notifications/read-all');
  },
};
