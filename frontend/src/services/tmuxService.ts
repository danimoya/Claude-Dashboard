/**
 * Tmux API client. Mirrors backend/src/routes/tmux.routes.ts.
 */

import { api } from './api';

export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
  activity: string;
  width?: number;
  height?: number;
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  panes: number;
}

export interface TmuxPane {
  window: number;
  pane: number;
  windowName: string;
  target: string;
  paneActive: boolean;
  windowActive: boolean;
  command: string;
  title: string;
  width?: number;
  height?: number;
}

export interface TmuxPaneSnapshot {
  session: string;
  window: number;
  text: string;
  capturedAt: string;
}

export interface TmuxHealth {
  ok: boolean;
  socket: string;
  version?: string;
  error?: string;
}

export const tmuxService = {
  async health(): Promise<TmuxHealth> {
    const r = await api.get('/api/v1/tmux/health');
    return r.data.data;
  },
  async listSessions(): Promise<TmuxSession[]> {
    const r = await api.get('/api/v1/tmux/sessions');
    return r.data.data;
  },
  async listWindows(name: string): Promise<TmuxWindow[]> {
    const r = await api.get(`/api/v1/tmux/sessions/${encodeURIComponent(name)}/windows`);
    return r.data.data;
  },
  async listPanes(name: string): Promise<TmuxPane[]> {
    const r = await api.get(`/api/v1/tmux/sessions/${encodeURIComponent(name)}/panes`);
    return r.data.data;
  },
  async capture(name: string, scrollback = 200): Promise<TmuxPaneSnapshot> {
    const r = await api.get(
      `/api/v1/tmux/sessions/${encodeURIComponent(name)}/capture?scrollback=${scrollback}`
    );
    return r.data.data;
  },
  async sendKeys(name: string, tokens: string[], literal = false): Promise<void> {
    await api.post(`/api/v1/tmux/sessions/${encodeURIComponent(name)}/keys`, { tokens, literal });
  },
  async sendLine(name: string, text: string): Promise<void> {
    await api.post(`/api/v1/tmux/sessions/${encodeURIComponent(name)}/line`, { text });
  },
  async newSession(name: string, opts: { cwd?: string; command?: string } = {}): Promise<void> {
    await api.post('/api/v1/tmux/sessions', { name, ...opts });
  },
  async killSession(name: string): Promise<void> {
    await api.delete(`/api/v1/tmux/sessions/${encodeURIComponent(name)}`);
  },
  async slugify(name: string): Promise<string> {
    const r = await api.get(`/api/v1/tmux/slugify?name=${encodeURIComponent(name)}`);
    return r.data.data.slug;
  },
};
