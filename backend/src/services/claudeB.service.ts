/**
 * Claude-B Proxy Service
 * Communicates with the Claude-B daemon's REST API to manage background sessions,
 * fire-and-forget tasks, and notifications.
 */

import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

const CB_API_BASE = process.env.CB_API_URL || 'http://127.0.0.1:3847';

interface CBAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface CBSession {
  id: string;
  name?: string;
  model?: string;
  status: 'idle' | 'busy';
  createdAt: string;
  workingDir?: string;
  promptCount?: number;
  goal?: string;
}

interface CBNotification {
  id: string;
  sessionId: string;
  sessionName?: string;
  prompt: string;
  duration: number;
  exitCode: number;
  timestamp: string;
  read: boolean;
}

interface CBPromptResult {
  sessionId: string;
  promptId: string;
  status: string;
  message: string;
}

export class ClaudeBService {
  private jwtToken: string | null = null;
  private tokenExpiresAt = 0;

  /**
   * Get a valid JWT token from Claude-B's REST API.
   * Caches the token for 50 minutes (tokens last 1 hour).
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.jwtToken && now < this.tokenExpiresAt) {
      return this.jwtToken;
    }

    const apiKey = await this.getApiKey();
    const res = await fetch(`${CB_API_BASE}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });

    if (!res.ok) {
      throw AppError.internal('Failed to authenticate with Claude-B daemon');
    }

    const data = (await res.json()) as CBAuthResponse;
    this.jwtToken = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in - 600) * 1000; // cache with 10 min margin
    return this.jwtToken;
  }

  /**
   * Read the API key from Claude-B's config.
   */
  private async getApiKey(): Promise<string> {
    const key = process.env.CB_API_KEY;
    if (key) return key;

    // Try reading from the cb CLI output
    try {
      const { execSync } = await import('child_process');
      const output = execSync('cb --api-key 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const match = output.match(/[a-f0-9-]{36}/);
      if (match) return match[0];
    } catch {
      // fall through
    }

    throw AppError.internal('CB_API_KEY not configured and could not auto-detect');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();

    // Only set Content-Type when there is actually a body. Fastify rejects
    // bodyless requests that declare `application/json` with
    // FST_ERR_CTP_EMPTY_JSON_BODY → 400, which broke every POST/DELETE
    // without payload (kill, mark-read, delete notification…).
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    };
    if (options.body !== undefined && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${CB_API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error(`Claude-B API error: ${res.status} ${path}`, { body });
      // Surface the upstream error message so the toast on the frontend
      // is useful instead of "Claude-B API error: 400".
      let upstream = '';
      try {
        const parsed = JSON.parse(body);
        upstream = parsed?.message || parsed?.error || '';
      } catch {
        upstream = body.slice(0, 200);
      }
      const detail = upstream ? `: ${upstream}` : '';
      throw AppError.internal(`Claude-B API error ${res.status}${detail}`);
    }

    // Empty bodies (204 / cb's success-only responses) — return null cast.
    const text = await res.text();
    if (!text) return null as T;
    return JSON.parse(text) as T;
  }

  // ── Sessions ──────────────────────────────────────────────

  async listSessions(): Promise<{ sessions: CBSession[]; count: number }> {
    return this.request('/api/sessions');
  }

  async createSession(name?: string, model?: string): Promise<CBSession> {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, model }),
    });
  }

  async getSession(id: string): Promise<CBSession> {
    return this.request(`/api/sessions/${id}`);
  }

  async killSession(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/sessions/${id}`, { method: 'DELETE' });
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<CBPromptResult> {
    return this.request(`/api/sessions/${sessionId}/prompt`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async getLastOutput(sessionId: string): Promise<{ sessionId: string; output: string; status: string }> {
    return this.request(`/api/sessions/${sessionId}/last`);
  }

  async getTranscript(sessionId: string): Promise<{ sessionId: string; transcript: any }> {
    return this.request(`/api/sessions/${sessionId}/transcript`);
  }

  // ── Notifications ─────────────────────────────────────────

  async getNotifications(unread?: boolean): Promise<CBNotification[]> {
    const qs = unread !== undefined ? `?unread=${unread}` : '';
    return this.request(`/api/notifications${qs}`);
  }

  async getNotificationCount(): Promise<{ total: number; unread: number }> {
    return this.request('/api/notifications/count');
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/api/notifications/read-all', { method: 'POST' });
  }

  async deleteNotification(id: string): Promise<void> {
    await this.request(`/api/notifications/${id}`, { method: 'DELETE' });
  }

  /**
   * Bulk delete via cb's atomic single-rewrite endpoints. The previous
   * implementation fanned out N independent DELETEs which raced cb's
   * read-modify-write cycle and corrupted notifications.jsonl mid-write.
   * The cb daemon now exposes /delete-all and /delete-read, both wrapped
   * in a per-inbox mutex with an atomic rename — one round-trip, zero
   * race surface, regardless of how many messages are in the inbox.
   */
  async deleteReadNotifications(): Promise<number> {
    const r = (await this.request('/api/notifications/delete-read', {
      method: 'POST',
    })) as { deleted?: number };
    return r?.deleted ?? 0;
  }

  async deleteAllNotifications(): Promise<number> {
    const r = (await this.request('/api/notifications/delete-all', {
      method: 'POST',
    })) as { deleted?: number };
    return r?.deleted ?? 0;
  }

  // ── Health ────────────────────────────────────────────────

  async health(): Promise<{ status: string; timestamp: string; sessions: number }> {
    // Health endpoint does not require auth
    const res = await fetch(`${CB_API_BASE}/api/health`);
    if (!res.ok) throw AppError.internal('Claude-B daemon unreachable');
    return res.json() as Promise<{ status: string; timestamp: string; sessions: number }>;
  }

  /**
   * Return the WebSocket URL for streaming a session.
   * The frontend will connect to this directly.
   */
  getStreamUrl(sessionId: string): string {
    const wsBase = CB_API_BASE.replace(/^http/, 'ws');
    return `${wsBase}/api/sessions/${sessionId}/stream`;
  }

  /**
   * Get a fresh JWT token the frontend can use to authenticate
   * WebSocket connections to Claude-B directly.
   */
  async getClientToken(): Promise<string> {
    return this.getToken();
  }
}
