/**
 * Telemetry & update-check routes.
 *
 *   GET  /api/v1/telemetry/status     — current toggles + cached values
 *   GET  /api/v1/telemetry/payload    — exact JSON that would be sent
 *   POST /api/v1/telemetry/preferences — update telemetry / updates toggles
 *   POST /api/v1/telemetry/ping       — submit install ping (no-op if off)
 *   POST /api/v1/telemetry/check-updates — fetch the public update feed
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { telemetryService } from '../services/telemetry.service.js';

const router = Router();
router.use(authenticate);

const PrefsSchema = z.object({
  telemetry: z.boolean().optional(),
  updates: z.boolean().optional(),
});

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await telemetryService.getStatus() });
  } catch (err) { next(err); }
});

router.get('/payload', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await telemetryService.buildPayload() });
  } catch (err) { next(err); }
});

router.post('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = PrefsSchema.parse(req.body);
    res.json({ success: true, data: await telemetryService.setPreferences(prefs) });
  } catch (err) { next(err); }
});

router.post('/ping', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await telemetryService.ping() });
  } catch (err) { next(err); }
});

router.post('/check-updates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await telemetryService.checkUpdates() });
  } catch (err) { next(err); }
});

export default router;
