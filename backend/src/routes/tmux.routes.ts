/**
 * Tmux Routes
 * REST endpoints for managing host tmux sessions.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { tmuxService, TmuxService } from '../services/tmux.service.js';

const router = Router();

const NameSchema = z.object({ name: z.string().min(1).max(64) });

const CapturePaneSchema = z.object({
  window: z.number().int().min(0).optional(),
  pane: z.number().int().min(0).optional(),
  scrollback: z.number().int().min(0).max(10_000).optional(),
});

const SendKeysSchema = z.object({
  tokens: z.array(z.string().min(1).max(512)).min(1),
  literal: z.boolean().optional(),
});

const SendLineSchema = z.object({ text: z.string().max(16_000) });

const NewSessionSchema = z.object({
  name: z.string().min(1).max(64),
  cwd: z.string().max(1024).optional(),
  command: z.string().max(2048).optional(),
});

router.get('/health', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await tmuxService.health();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await tmuxService.listSessions();
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:name/windows', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = NameSchema.parse(req.params);
    const data = await tmuxService.listWindows(name);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:name/panes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = NameSchema.parse(req.params);
    const data = await tmuxService.listPanes(name);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:name/capture', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = NameSchema.parse(req.params);
    const opts = CapturePaneSchema.parse({
      window: req.query.window !== undefined ? Number(req.query.window) : undefined,
      pane: req.query.pane !== undefined ? Number(req.query.pane) : undefined,
      scrollback: req.query.scrollback !== undefined ? Number(req.query.scrollback) : undefined,
    });
    const snap = await tmuxService.capturePane(name, opts);
    res.json({ success: true, data: snap });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/:name/keys', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = NameSchema.parse(req.params);
    const { tokens, literal } = SendKeysSchema.parse(req.body);
    await tmuxService.sendKeys(name, tokens, { literal });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/:name/line', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = NameSchema.parse(req.params);
    const { text } = SendLineSchema.parse(req.body);
    await tmuxService.sendLine(name, text);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, cwd, command } = NewSessionSchema.parse(req.body);
    await tmuxService.newSession(name, { cwd, command });
    res.status(201).json({ success: true, data: { name } });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:name', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = NameSchema.parse(req.params);
    await tmuxService.killSession(name);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Expose slugify so the frontend doesn't need its own copy.
router.get('/slugify', authenticate, (req: Request, res: Response) => {
  const input = String(req.query.name ?? '');
  res.json({ success: true, data: { slug: TmuxService.slugify(input) } });
});

export default router;
