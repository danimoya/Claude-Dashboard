/**
 * 2FA Step-up Middleware
 *
 * Routes that require 2FA expect a short-lived, signed "settings token" in
 * the `x-2fa-token` header. The token is issued by POST /auth/2fa/verify
 * after a successful TOTP/backup-code challenge.
 *
 * If the user has not enabled 2FA, the middleware is a no-op (settings
 * remains accessible — 2FA is opt-in but strongly encouraged).
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { twofaService } from '../services/twofa.service.js';

const SETTINGS_TOKEN_TTL = 10 * 60; // 10 minutes
const SCOPE = 'settings';

export function issueSettingsToken(userId: string): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + SETTINGS_TOKEN_TTL;
  const token = jwt.sign({ userId, scope: SCOPE, exp: expiresAt }, config.jwt.secret);
  return { token, expiresAt: expiresAt * 1000 };
}

export async function require2FA(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) throw AppError.unauthorized('Authentication required');

    // No 2FA enabled? Allow through. The frontend nudges users to enroll.
    const enabled = await twofaService.isEnabled(req.userId);
    if (!enabled) return next();

    const header = req.headers['x-2fa-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) throw AppError.forbidden('2FA verification required');

    let payload: any;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      throw AppError.forbidden('Invalid or expired 2FA token');
    }

    if (payload.userId !== req.userId || payload.scope !== SCOPE) {
      throw AppError.forbidden('2FA token mismatch');
    }
    next();
  } catch (error) {
    next(error);
  }
}
