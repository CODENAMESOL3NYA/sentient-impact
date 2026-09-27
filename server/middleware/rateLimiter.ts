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
export function createRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
    const windowMs   = options.windowMs   ?? 60_000;
    const maxRequests = options.maxRequests ?? 30;
    const message    = options.message    ?? 'Too many requests — please try again later.';

    const store = new Map<string, RateLimitEntry>();

    // Periodic sweep: remove entries whose window has already expired.
    const sweepInterval = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of store) {
            if (now - entry.windowStart > windowMs) {
                store.delete(ip);
            }
        }
    }, windowMs);

    // Allow the Node.js event loop to exit even if this interval is still live.
    sweepInterval.unref();

    return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
        // req.ip respects Express's `trust proxy` setting and is the safest source.
        // X-Forwarded-For is only read as a fallback and uses the leftmost (client) IP,
        // which can be spoofed when the server is not behind a trusted reverse proxy.
        // Set `app.set('trust proxy', 1)` in server.ts if deployed behind a load balancer.
        const ip  = req.ip
                 ?? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
                 ?? req.socket.remoteAddress
                 ?? 'unknown';

        const now  = Date.now();
        const entry = store.get(ip);

        if (!entry || now - entry.windowStart > windowMs) {
            // First request in a new window.
            store.set(ip, { count: 1, windowStart: now });
            next();
            return;
        }

        entry.count++;

        if (entry.count > maxRequests) {
            const retryAfterSec = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
            res.setHeader('Retry-After', String(retryAfterSec));
            res.setHeader('X-RateLimit-Limit',     String(maxRequests));
            res.setHeader('X-RateLimit-Remaining', '0');
            res.status(429).json({
                error:   'RateLimitExceeded',
                message,
                retryAfterSeconds: retryAfterSec,
            });
            return;
        }

        res.setHeader('X-RateLimit-Limit',     String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(maxRequests - entry.count));
        next();
    };
}
