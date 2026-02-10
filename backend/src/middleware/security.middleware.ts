/**
 * Security Middleware
 * Additional security hardening for production
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * Request size limiting
 */
export function requestSizeLimit(maxSize: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > maxSize) {
      logger.warn(`Request size exceeds limit: ${contentLength} > ${maxSize}`);
      res.status(413).json({
        success: false,
        error: 'Request entity too large',
      });
      return;
    }

    next();
  };
}

/**
 * Input sanitization
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Sanitize query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = (req.query[key] as string).trim();
    }
  }

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
}

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].trim();
      // Remove potentially dangerous characters
      obj[key] = obj[key].replace(/<script[^>]*>.*?<\/script>/gi, '');
      obj[key] = obj[key].replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * SQL injection prevention
 */
export function preventSQLInjection(req: Request, res: Response, next: NextFunction): void {
  const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi;

  const checkString = (str: string): boolean => {
    return sqlPattern.test(str);
  };

  const checkObject = (obj: any): boolean => {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && checkString(obj[key])) {
        return true;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  // Check query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === 'string' && checkString(req.query[key] as string)) {
      logger.warn(`Potential SQL injection detected in query: ${key}`);
      res.status(400).json({
        success: false,
        error: 'Invalid input detected',
      });
      return;
    }
  }

  // Check body
  if (req.body && typeof req.body === 'object') {
    if (checkObject(req.body)) {
      logger.warn('Potential SQL injection detected in body');
      res.status(400).json({
        success: false,
        error: 'Invalid input detected',
      });
      return;
    }
  }

  next();
}
