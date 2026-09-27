import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface ClientBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later.' } = options;
  const buckets = new Map<string, ClientBucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const existing = buckets.get(ip);

    if (!existing || now > existing.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        bobcoinsRefunded: true,
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
