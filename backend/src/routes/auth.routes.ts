/**
 * Authentication Routes
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { LoginSchema } from '@claude-dashboard/shared';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.entity.js';
import { AuthService } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authRateLimit } from '../middleware/rateLimit.middleware.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
const authService = new AuthService();

// Open self-registration is a privileged operation for this tool: a fresh
// account immediately receives JWTs that unlock host command execution
// (CLI spawn) and full tmux control. It is therefore DISABLED by default and
// only ever permitted while no user exists yet (the very first account, which
// the /setup/bootstrap flow normally creates). Set ALLOW_OPEN_REGISTRATION=true
// to deliberately re-open it (e.g. behind a trusted network gate).
async function assertRegistrationAllowed(): Promise<void> {
  const userCount = await AppDataSource.getRepository(User).count();
  if (userCount === 0) {
    return; // bootstrap of the first user is always permitted
  }
  if (process.env.ALLOW_OPEN_REGISTRATION === 'true') {
    return; // explicit operator opt-in
  }
  throw AppError.forbidden('Registration is disabled');
}

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Gate registration: once the instance has an owner, refuse new public
    // sign-ups unless explicitly re-enabled. Mirrors the /setup/bootstrap guard.
    await assertRegistrationAllowed();

    const { username, password, email } = req.body;

    // Validate input
    if (!username || !password) {
      throw AppError.badRequest('Username and password are required');
    }

    if (password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters');
    }

    const result = await authService.register(username, password, email);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Login with username and password
 */
router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const credentials = LoginSchema.parse(req.body);

    const result = await authService.login(credentials);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw AppError.badRequest('Refresh token is required');
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getCurrentUser(req.userId!);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout (client-side token removal + server-side blacklist)
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.substring(7); // Remove 'Bearer '

    if (token) {
      // Blacklist the current access token
      await authService.blacklistToken(token);
    }

    // Also revoke the refresh token so a logged-out session cannot mint new
    // access tokens for the remaining (up to 7-day) refresh-token lifetime.
    // The client should send its refresh token on logout.
    const { refreshToken } = req.body ?? {};
    if (refreshToken && typeof refreshToken === 'string') {
      await authService.blacklistToken(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
