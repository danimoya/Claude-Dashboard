/**
 * User Routes
 * Profile, preferences, and API key management
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { require2FA } from '../middleware/twofa.middleware.js';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.entity.js';
import { AppError } from '../utils/AppError.js';
import { z } from 'zod';

const router = Router();
const userRepository = AppDataSource.getRepository(User);

router.use(authenticate);

const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const UpdateApiKeysSchema = z.object({
  anthropic: z.string().optional(),
  openai: z.string().optional(),
  speechmatics: z.string().optional(),
});

const UpdatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  language: z.string().optional(),
  editorFontSize: z.number().min(10).max(32).optional(),
});

/**
 * PATCH /api/v1/users/profile
 */
router.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = UpdateProfileSchema.parse(req.body);
    const user = await userRepository.findOneBy({ id: req.userId });
    if (!user) throw AppError.notFound('User not found');

    if (dto.username) user.username = dto.username;
    if (dto.email) user.email = dto.email;

    await userRepository.save(user);
    res.json({ success: true, data: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/users/password
 */
router.patch('/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
    const user = await userRepository.findOneBy({ id: req.userId });
    if (!user) throw AppError.notFound('User not found');

    const valid = await user.comparePassword(currentPassword);
    if (!valid) throw AppError.unauthorized('Current password is incorrect');

    user.password = newPassword;
    await userRepository.save(user);

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/api-keys
 */
router.put('/api-keys', require2FA, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = UpdateApiKeysSchema.parse(req.body);
    const user = await userRepository.findOneBy({ id: req.userId });
    if (!user) throw AppError.notFound('User not found');

    user.apiKeys = { ...user.apiKeys, ...keys };
    await userRepository.save(user);

    res.json({ success: true, message: 'API keys updated' });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/preferences
 */
router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = UpdatePreferencesSchema.parse(req.body);
    const user = await userRepository.findOneBy({ id: req.userId });
    if (!user) throw AppError.notFound('User not found');

    user.preferences = { ...user.preferences, ...prefs };
    await userRepository.save(user);

    res.json({ success: true, data: user.preferences });
  } catch (error) {
    next(error);
  }
});

export default router;
