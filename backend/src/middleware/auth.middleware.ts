/**
 * Authentication middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

const authService = new AuthService();

/**
 * Verify JWT token and attach user ID to request
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const { userId } = authService.verifyAccessToken(token);

    // Attach user ID to request
    req.userId = userId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication (doesn't throw if no token)
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { userId } = authService.verifyAccessToken(token);
      req.userId = userId;
    }
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
}
