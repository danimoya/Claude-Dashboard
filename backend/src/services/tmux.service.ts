/**
 * Tmux Service
 * Wraps the host's tmux binary (via mounted /tmp/tmux-1001 socket) to list,
 * inspect, attach (capture-pane), and control sessions.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

const execFileAsync = promisify(execFile);

export interface TmuxSession {
  name: string;
  windows: number;
  created: string; // unix epoch as string
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
  /** `window.pane` — what to pass to capture-pane / send-keys. */
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

/**
 * tmux send-keys allows symbolic keys. We accept either a literal string
 * (typed as-is) or a list of key tokens. Tokens may include things like
 * `C-c`, `C-x`, `M-x`, `Up`, `Down`, `PageUp`, `Enter`, `Space`, `Tab`,
 * `Escape`, `BSpace`, `F1`..`F12` — anything tmux accepts.
 */
export type TmuxKeyToken = string;

export class TmuxService {
  private readonly socketPath: string;
  private readonly bin: string;
  private readonly hostUid: string | null;

  constructor() {
    this.bin = process.env.TMUX_BIN || 'tmux';
    // Default to the mounted host socket; allow override via env.
    this.socketPath = process.env.TMUX_SOCKET || '/tmp/tmux-1001/default';
    // The mounted socket is owned by the host's UID (default 1001). When the
    // container runs as root we use `su-exec` to drop to that UID so tmux
    // doesn't refuse the socket on a UID mismatch. Set TMUX_HOST_UID="" to
    // disable.
    this.hostUid =
      process.env.TMUX_HOST_UID === undefined ? '1001' : process.env.TMUX_HOST_UID || null;
  }

  private async run(args: string[], timeoutMs = 5000): Promise<string> {
    const tmuxArgs = ['-S', this.socketPath, ...args];
    const useSuexec = this.hostUid && process.getuid && process.getuid() === 0;
    const cmd = useSuexec ? 'su-exec' : this.bin;
    const fullArgs = useSuexec ? [this.hostUid!, this.bin, ...tmuxArgs] : tmuxArgs;
    try {
      const { stdout } = await execFileAsync(cmd, fullArgs, {
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
      });
      return stdout;
    } catch (err: any) {
      const stderr = (err?.stderr || '').toString().trim();
      const stdout = (err?.stdout || '').toString().trim();
      const message = stderr || stdout || err?.message || 'tmux command failed';
      logger.warn(`tmux ${args.join(' ')} → ${message}`);
      throw AppError.internal(`tmux: ${message}`);
    }
  }

  /**
   * Verify tmux server is reachable on the configured socket.
   */
  async health(): Promise<{ ok: boolean; socket: string; version?: string; error?: string }> {
    try {
      const { stdout: v } = await execFileAsync(this.bin, ['-V'], { timeout: 2000 });
      // Use the same su-exec path as run() so health reflects what real
      // commands will see.
      try {
        await this.run(['list-sessions'], 2000);
      } catch (err: any) {
        // "no server running" is fine — tmux is callable, just no sessions.
        if (!/no server running|no sessions/i.test(err?.message || '')) throw err;
      }
      return { ok: true, socket: this.socketPath, version: v.trim() };
    } catch (err: any) {
      return { ok: false, socket: this.socketPath, error: err?.message || 'tmux unavailable' };
    }
  }

  async listSessions(): Promise<TmuxSession[]> {
    // tmux's -F output replaces non-printables (including tab) with `_`, so
    // we use `|` as the field separator. Session names are constrained by
    // assertName() so they can't contain it.
    const fmt =
      '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}|#{session_activity}|#{session_width}|#{session_height}';
    let out: string;
    try {
      out = await this.run(['list-sessions', '-F', fmt]);
    } catch (err: any) {
      if (/no server running|no sessions/i.test(err?.message || '')) return [];
      throw err;
    }
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, windows, created, attached, activity, width, height] = line.split('|');
        return {
          name,
          windows: parseInt(windows, 10) || 0,
          created,
          attached: attached !== '0',
          activity,
          width: width ? parseInt(width, 10) : undefined,
          height: height ? parseInt(height, 10) : undefined,
        };
      });
  }

  async listWindows(session: string): Promise<TmuxWindow[]> {
    this.assertName(session);
    const fmt = '#{window_index}|#{window_name}|#{window_active}|#{window_panes}';
    const out = await this.run(['list-windows', '-t', session, '-F', fmt]);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [index, name, active, panes] = line.split('|');
        return {
          index: parseInt(index, 10),
          name,
          active: active === '1',
          panes: parseInt(panes, 10) || 1,
        };
      });
  }

  /**
   * List every pane across every window of a session. Used by the UI to
   * render quick-jump buttons next to the live indicator.
   */
  async listPanes(session: string): Promise<TmuxPane[]> {
    this.assertName(session);
    const fmt =
      '#{window_index}|#{pane_index}|#{window_name}|#{pane_active}|#{window_active}|#{pane_current_command}|#{pane_title}|#{pane_width}|#{pane_height}';
    const out = await this.run(['list-panes', '-s', '-t', session, '-F', fmt]);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [w, p, wname, pactive, wactive, cmd, title, width, height] = line.split('|');
        const window = parseInt(w, 10);
        const pane = parseInt(p, 10);
        return {
          window,
          pane,
          windowName: wname || String(window),
          target: `${window}.${pane}`,
          paneActive: pactive === '1',
          windowActive: wactive === '1',
          command: cmd || '',
          title: title || '',
          width: width ? parseInt(width, 10) : undefined,
          height: height ? parseInt(height, 10) : undefined,
        };
      });
  }

  /**
   * Capture the visible pane content (and optionally scrollback).
   * lines: number of scrollback lines to include (default 0 = visible only).
   */
  async capturePane(
    session: string,
    opts: { window?: number; pane?: number; scrollback?: number } = {}
  ): Promise<TmuxPaneSnapshot> {
    this.assertName(session);
    const target =
      opts.window !== undefined
        ? `${session}:${opts.window}${opts.pane !== undefined ? '.' + opts.pane : ''}`
        : session;
    const args = ['capture-pane', '-pe', '-t', target];
    if (opts.scrollback && opts.scrollback > 0) {
      args.push('-S', `-${opts.scrollback}`);
    }
    const text = await this.run(args, 8000);
    return {
      session,
      window: opts.window ?? 0,
      text,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Send keys to a session. Accepts a list of tokens (tmux symbolic keys
   * like `C-c`, `Enter`, `Up`) or literal text.
   */
  async sendKeys(session: string, tokens: TmuxKeyToken[], opts: { literal?: boolean } = {}): Promise<void> {
    this.assertName(session);
    return this.sendKeysToTarget(session, tokens, opts);
  }

  /**
   * Send keys to an arbitrary target (`session`, `session:window`, or
   * `session:window.pane`). The session portion is validated; the
   * window/pane suffix is constrained to digits + the `.` separator.
   */
  async sendKeysToTarget(
    target: string,
    tokens: TmuxKeyToken[],
    opts: { literal?: boolean } = {}
  ): Promise<void> {
    this.assertTarget(target);
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw AppError.badRequest('tokens must be a non-empty array');
    }
    for (const t of tokens) {
      if (typeof t !== 'string' || t.length === 0 || t.length > 512) {
        throw AppError.badRequest('Invalid key token');
      }
    }
    const args = ['send-keys', '-t', target];
    if (opts.literal) args.push('-l');
    args.push(...tokens);
    await this.run(args);
  }

  /**
   * Send a literal line of text followed by Enter. Convenience wrapper for
   * "type this command".
   */
  async sendLine(session: string, text: string): Promise<void> {
    this.assertName(session);
    if (typeof text !== 'string' || text.length > 16_000) {
      throw AppError.badRequest('text must be a string up to 16k chars');
    }
    await this.run(['send-keys', '-t', session, '-l', text]);
    await this.run(['send-keys', '-t', session, 'Enter']);
  }

  async newSession(name: string, opts: { cwd?: string; command?: string; detached?: boolean } = {}): Promise<void> {
    this.assertName(name);
    const args = ['new-session', '-d', '-s', name];
    if (opts.cwd) {
      args.push('-c', opts.cwd);
    }
    if (opts.command) {
      args.push(opts.command);
    }
    await this.run(args);
  }

  async hasSession(name: string): Promise<boolean> {
    this.assertName(name);
    try {
      await this.run(['has-session', '-t', name], 2000);
      return true;
    } catch {
      return false;
    }
  }

  async killSession(name: string): Promise<void> {
    this.assertName(name);
    await this.run(['kill-session', '-t', name]);
  }

  async renameSession(from: string, to: string): Promise<void> {
    this.assertName(from);
    this.assertName(to);
    await this.run(['rename-session', '-t', from, to]);
  }

  /**
   * Generate a Linux-friendly slug from a project name. Lowercased,
   * non-alphanumerics → "-", trimmed, max 40 chars.
   */
  static slugify(name: string): string {
    return (
      (name || 'project')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'project'
    );
  }

  private assertName(name: string): void {
    // tmux session/window names: allow letters, digits, dot, dash, underscore.
    // We deliberately reject `:` since it's the target separator.
    if (typeof name !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(name)) {
      throw AppError.badRequest('Invalid tmux session name');
    }
  }

  /**
   * Validate a target like `session`, `session:5`, or `session:5.0`.
   */
  private assertTarget(target: string): void {
    if (typeof target !== 'string' || target.length === 0 || target.length > 96) {
      throw AppError.badRequest('Invalid tmux target');
    }
    const m = target.match(/^([A-Za-z0-9._-]{1,64})(?::(\d{1,4})(?:\.(\d{1,4}))?)?$/);
    if (!m) throw AppError.badRequest('Invalid tmux target');
  }
}

export const tmuxService = new TmuxService();
