import type { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

interface RateLimiterOptions {
    /** Length of the sliding window in milliseconds. Default: 60 000 (1 min). */
    windowMs?: number;
    /** Maximum number of requests allowed per IP per window. Default: 30. */
    maxRequests?: number;
    /** Human-readable message returned in the 429 response body. */
    message?: string;
}

/**
 * Minimal in-process fixed-window rate limiter keyed by client IP.
 * No external dependencies required.
 *
 * Each IP is allowed `maxRequests` within a rolling `windowMs` period.
 * Once the window expires the counter resets automatically on the next request.
 * Stale entries (IPs that have not been seen for > windowMs) are swept
 * every `windowMs` to prevent unbounded Map growth.
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
        const ip  = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
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
