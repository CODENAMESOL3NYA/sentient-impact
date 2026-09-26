import express from 'express';
import {PRAnalysisController } from '../controllers/prController.ts';

const router = express.Router();

/**
 * @route   POST /api/analyze-pr
 * @desc    Accept git diff and PR identifier,checks cache, runs Agent A and Agent B concurrently
 * @access  Public / Team internal
 */

router.post('/analyze-pr',PRAnalysisController.analyzePR);

/**
 * @route   GET /api/cache-state
 * @desc    Retrieves cache metrics and total Bobcoins preserved by SHA-256 deduplication
 * @access  Internal Diagnostic
 */

router.get('/cache-stats',PRAnalysisController.getCacheStats);

export default router;