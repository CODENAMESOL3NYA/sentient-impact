import express from 'express';
import {PRAnalysisController } from '../controllers/prController.ts';
import { createRateLimiter } from '../middleware/rateLimiter.ts';

const router = express.Router();

/**
 * Rate limiter for the expensive dual-agent analysis endpoint.
 * Allows 30 requests per IP per minute by default.
 * Override via environment variables if needed.
 */
const analyzePrLimiter = createRateLimiter({
    windowMs:    Number(process.env.RATE_LIMIT_WINDOW_MS)   || 60_000,
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
    message: 'Rate limit exceeded for /api/analyze-pr — please wait before retrying.',
});

/**
 * @route   POST /api/analyze-pr
 * @desc    Accept git diff and PR identifier,checks cache, runs Agent A and Agent B concurrently
 * @access  Public / Team internal
 */

router.post('/analyze-pr', analyzePrLimiter, PRAnalysisController.analyzePR);

/**
 * @route   GET /api/cache-state
 * @desc    Retrieves cache metrics and total Bobcoins preserved by SHA-256 deduplication
 * @access  Internal Diagnostic
 */

router.get('/cache-stats',PRAnalysisController.getCacheStats);

export default router;