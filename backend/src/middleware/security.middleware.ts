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

// NOTE (security hardening): the previous `sanitizeInput` middleware globally
// MUTATED request bodies (trimming strings and regex-stripping <script>/<iframe>
// tags) and a companion `preventSQLInjection` middleware tried to block SQLi with
// a keyword regex. Both have been removed:
//
//   * The XSS denylist was trivially bypassable (e.g. `<img onerror=...>`,
//     `<svg/onload=...>`, broken-up tags) and provided false assurance while
//     silently corrupting legitimate data that contains the word "script", angle
//     brackets, or code snippets — a real problem for a Claude Code dashboard.
//   * The SQL keyword regex (which was never even mounted) flagged any input
//     containing SELECT/UPDATE/DELETE/etc., breaking benign prose and code while
//     adding no real protection.
//
// XSS is prevented by context-aware output encoding instead: React escapes by
// default and CLI/markdown output is sanitized at render time (DOMPurify in
// MarkdownView, ansiToHtml escaping). SQL injection is prevented by TypeORM's
// parameterized/bound queries used throughout the data layer. Input shape is
// validated by the existing Zod schemas at the route boundary.
//
// Request bodies are intentionally NOT mutated by middleware anymore.
