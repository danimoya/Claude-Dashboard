/**
 * Claude-B Proxy Routes
 * Exposes Claude-B daemon functionality to authenticated dashboard users.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { authenticate } from '../middleware/auth.middleware.js';
import { ClaudeBService } from '../services/claudeB.service.js';
import { z } from 'zod';

const execFile = promisify(execFileCb);
const router = Router();
const cbService = new ClaudeBService();

// ── Health ────────────────────────────────────────────────────

router.get('/health', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await cbService.health();
    res.json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
});

/**
 * Lightweight detector for the /claude-b page's install-hint panel.
 * Reports whether the cb binary is on PATH (`installed`) and whether the
 * daemon's REST endpoint answers within ~1.5s (`running`). Never throws —
 * absence is part of the answer.
 */
router.get('/daemon-status', authenticate, async (_req: Request, res: Response) => {
  let installed = false;
  let version: string | undefined;
  try {
    const { stdout } = await execFile('cb', ['--version'], { timeout: 2000 });
    installed = true;
    version = stdout.split('\n')[0]?.trim() || undefined;
  } catch {
    installed = false;
  }

  let running = false;
  const apiUrl = process.env.CB_API_URL || 'http://127.0.0.1:3847';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${apiUrl}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    running = r.ok;
  } catch {
    running = false;
  }

  res.json({ success: true, data: { installed, running, version, apiUrl } });
});

// ── Sessions ──────────────────────────────────────────────────

router.get('/sessions', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cbService.listSessions();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

const CreateSessionSchema = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
});

router.post('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, model } = CreateSessionSchema.parse(req.body);
    const session = await cbService.createSession(name, model);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await cbService.getSession(req.params.id);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cbService.killSession(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Prompts ───────────────────────────────────────────────────

const SendPromptSchema = z.object({
  prompt: z.string().min(1),
});

router.post('/sessions/:id/prompt', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = SendPromptSchema.parse(req.body);
    const result = await cbService.sendPrompt(req.params.id, prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:id/last', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const output = await cbService.getLastOutput(req.params.id);
    res.json({ success: true, data: output });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:id/transcript', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transcript = await cbService.getTranscript(req.params.id);
    res.json({ success: true, data: transcript });
  } catch (error) {
    next(error);
  }
});

// ── Stream token (for frontend WebSocket auth) ───────────────

router.get('/stream-token', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await cbService.getClientToken();
    const streamBase = process.env.CB_API_URL?.replace(/^http/, 'ws') || 'ws://127.0.0.1:3847';
    res.json({ success: true, data: { token, streamBase } });
  } catch (error) {
    next(error);
  }
});

// ── Notifications ─────────────────────────────────────────────

router.get('/notifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unread = req.query.unread === 'true' ? true : req.query.unread === 'false' ? false : undefined;
    const notifications = await cbService.getNotifications(unread);
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/count', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await cbService.getNotificationCount();
    res.json({ success: true, data: count });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cbService.markNotificationRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/read-all', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await cbService.markAllNotificationsRead();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/notifications/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cbService.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/delete-read', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await cbService.deleteReadNotifications();
    res.json({ success: true, data: { deleted: count } });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/delete-all', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await cbService.deleteAllNotifications();
    res.json({ success: true, data: { deleted: count } });
  } catch (error) {
    next(error);
  }
});

export default router;
