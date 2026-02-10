/**
 * Request logging middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log request
  logger.debug(`${req.method} ${req.path}`);

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';

    logger.log(logLevel, `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
}
