/**
 * First-run setup routes.
 *
 *   GET  /api/v1/setup/status — returns { needsSetup: boolean }. The
 *        frontend pings this on every public page; if true, the SPA
 *        forces the /setup wizard.
 *   POST /api/v1/setup/bootstrap — atomic first-run init: creates the
 *        first user, mints the installation_id, and applies the chosen
 *        telemetry / update-check toggles. Refuses if any user already
 *        exists.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.entity.js';
import { AuthService } from '../services/auth.service.js';
import { telemetryService } from '../services/telemetry.service.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
const authService = new AuthService();

const BootstrapSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email().optional(),
  enableTelemetry: z.boolean().optional().default(false),
  enableUpdateChecks: z.boolean().optional().default(false),
});

async function userCount(): Promise<number> {
  return AppDataSource.getRepository(User).count();
}

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await userCount();
    res.json({ success: true, data: { needsSetup: count === 0 } });
  } catch (err) {
    next(err);
  }
});

router.post('/bootstrap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if ((await userCount()) > 0) {
      throw AppError.forbidden('Setup already complete');
    }
    const dto = BootstrapSchema.parse(req.body);
    const auth = await authService.register(dto.username, dto.password, dto.email);
    await telemetryService.setPreferences({
      telemetry: dto.enableTelemetry,
      updates: dto.enableUpdateChecks,
    });
    res.json({ success: true, data: auth });
  } catch (err) {
    next(err);
  }
});

export default router;
