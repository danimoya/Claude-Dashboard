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
    // Return only sanitized field paths/messages, never the raw error object.
    // The raw ZodError serializes internal schema structure, input values, and
    // stack-trace-adjacent detail that should not leak to clients. `flatten()`
    // yields { formErrors: string[], fieldErrors: Record<string,string[]> }.
    let details: unknown = undefined;
    const zodError = error as { flatten?: () => unknown };
    if (typeof zodError.flatten === 'function') {
      details = zodError.flatten();
    }
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      ...(details !== undefined && { details }),
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
