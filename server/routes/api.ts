import express from 'express';
import { PRAnalysisController } from '../controllers/prController.ts';
import { GitHubPrController } from '../controllers/githubPrController.ts';
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

/**
 * @route   GET /api/github/prs?owner=<owner>&repo=<repo>
 * @desc    Lists open pull requests for the given GitHub repository
 * @access  Public / Team internal
 */
router.get('/github/prs', analyzePrLimiter, GitHubPrController.listPRs);

/**
 * @route   POST /api/analyze-github-pr
 * @desc    Fetch a real GitHub PR diff and run the dual-agent analysis pipeline
 * @body    { owner: string; repo: string; prNumber: number; bypassCache?: boolean }
 * @access  Public / Team internal
 */
router.post('/analyze-github-pr', analyzePrLimiter, GitHubPrController.analyzePR);

export default router;