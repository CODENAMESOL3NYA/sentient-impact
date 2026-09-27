import type { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface ClientRateRecord {
  count: number;
  resetAt: number;
}

/**
 * Lightweight in-memory rate limiter middleware for Express routes.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs = 60_000,
    maxRequests = 30,
    message = 'Too many requests, please try again later.',
  } = options;

  const clients = new Map<string, ClientRateRecord>();

  return function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'global';
    const record = clients.get(key);

    if (!record || now > record.resetAt) {
      clients.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        message,
        retryAfterMs: Math.max(0, record.resetAt - now),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    record.count += 1;
    next();
  };
}
