/**
 * Two-Factor Authentication Routes
 *
 *   POST /api/v1/auth/2fa/enroll       — generate secret + backup codes
 *   POST /api/v1/auth/2fa/confirm      — confirm enrollment with a TOTP code
 *   POST /api/v1/auth/2fa/verify       — verify code, get a settings step-up token
 *   POST /api/v1/auth/2fa/disable      — disable 2FA (requires current code)
 *   GET  /api/v1/auth/2fa/status       — { enabled }
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { twofaService } from '../services/twofa.service.js';
import { issueSettingsToken } from '../middleware/twofa.middleware.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
router.use(authenticate);

const TokenSchema = z.object({ token: z.string().min(4).max(32) });

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = await twofaService.isEnabled(req.userId!);
    res.json({ success: true, data: { enabled } });
  } catch (error) {
    next(error);
  }
});

router.post('/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await twofaService.beginEnrollment(req.userId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = TokenSchema.parse(req.body);
    await twofaService.confirmEnrollment(req.userId!, token);
    const stepUp = issueSettingsToken(req.userId!);
    res.json({ success: true, data: { enabled: true, stepUp } });
  } catch (error) {
    next(error);
  }
});

router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = TokenSchema.parse(req.body);
    const ok = await twofaService.verify(req.userId!, token);
    if (!ok) throw AppError.unauthorized('Invalid 2FA code');
    const stepUp = issueSettingsToken(req.userId!);
    res.json({ success: true, data: stepUp });
  } catch (error) {
    next(error);
  }
});

router.post('/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = TokenSchema.parse(req.body);
    await twofaService.disable(req.userId!, token);
    res.json({ success: true, data: { enabled: false } });
  } catch (error) {
    next(error);
  }
});

export default router;
