/**
 * Global error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Error:', error);

  // Handle known application errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.data && { data: error.data }),
    });
    return;
  }

  // Handle validation errors
  if (error.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error,
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
    });
    return;
  }

  // Handle database errors
  if (error.name === 'QueryFailedError') {
    res.status(500).json({
      success: false,
      error: 'Database error',
    });
    return;
  }

  // Default to 500 server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
