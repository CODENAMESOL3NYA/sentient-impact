import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { getGitHubClient } from '../services/githubClient.js';
import { diffCache } from '../utils/cache.js';
import {
    agentACoachAdapter,
    agentBRadarAdapter,
    watsonxAgentACoachAdapter,
    watsonxAgentBRadarAdapter,
    type PRAnalysisResponse,
} from '../adapters/agentAdapters.js';
import { BOBCOIN_ECONOMY } from '../../src/data/bobPrompts.js';

/**
 * Controller for the GitHub-sourced PR analysis routes.
 * Fetches real PR data from GitHub, then delegates to the same dual-agent
 * pipeline used by PRAnalysisController — no logic duplication.
 */
export class GitHubPrController {

    /**
     * GET /api/github/prs?owner=<owner>&repo=<repo>
     * Lists open pull requests for the specified repository.
     */
    public static async listPRs(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { owner, repo } = req.query as Record<string, string | undefined>;

            if (!owner || typeof owner !== 'string' || owner.trim().length === 0) {
                throw new AppError('Query parameter "owner" is required.', 400);
            }
            if (!repo || typeof repo !== 'string' || repo.trim().length === 0) {
                throw new AppError('Query parameter "repo" is required.', 400);
            }

            const prs = await getGitHubClient().listPullRequests(owner.trim(), repo.trim());
            res.status(200).json({ owner, repo, pullRequests: prs });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/analyze-github-pr
     * Body: { owner: string; repo: string; prNumber: number; bypassCache?: boolean }
     *
     * Fetches the PR diff + metadata from GitHub, runs the dual-agent analysis
     * pipeline, caches the result, and returns PRAnalysisResponse enriched with
     * GitHub PR metadata.
     */
    public static async analyzePR(req: Request, res: Response, next: NextFunction): Promise<void> {
        const startTime = Date.now();

        try {
            const { owner, repo, prNumber, bypassCache = false } = req.body as {
                owner?: unknown;
                repo?: unknown;
                prNumber?: unknown;
                bypassCache?: boolean;
            };

            // Validate owner and repo.
            if (!owner || typeof owner !== 'string' || owner.trim().length === 0) {
                throw new AppError('"owner" is required in the request body.', 400);
            }
            if (!repo || typeof repo !== 'string' || repo.trim().length === 0) {
                throw new AppError('"repo" is required in the request body.', 400);
            }

            // Validate prNumber as a positive integer.
            const parsedPrNumber = Number(prNumber);
            if (!Number.isInteger(parsedPrNumber) || parsedPrNumber < 1) {
                throw new AppError('"prNumber" must be a positive integer.', 400);
            }

            const ownerStr = owner.trim();
            const repoStr = repo.trim();

            // Namespace the cache key so it never collides with mock IDs like 'pr-142'.
            const prId = `${ownerStr}/${repoStr}#${parsedPrNumber}`;
            const cacheKey = diffCache.generateDiffHash('', prId);

            if (!bypassCache) {
                const cachedResult = diffCache.get<PRAnalysisResponse>(cacheKey);
                if (cachedResult) {
                    res.status(200).json({
                        ...cachedResult,
                        source: 'cache',
                        executionTimeMs: Date.now() - startTime,
                        bobcoinsBilled: 0.0,
                        cacheHit: true,
                    });
                    return;
                }
            }

            // Fetch diff and metadata from GitHub.
            const { diff, diffTruncated, modifiedFiles, prMeta } =
                await getGitHubClient().getPullRequestDiff(ownerStr, repoStr, parsedPrNumber);

            if (!diff || diff.trim().length === 0) {
                throw new AppError(
                    `PR #${parsedPrNumber} in ${ownerStr}/${repoStr} has no diff content. ` +
                    'It may be already merged, closed, or contain only binary files.',
                    422
                );
            }

            const useLive = process.env.USE_LIVE_LLM === 'true';
            const coachAdapter = useLive ? watsonxAgentACoachAdapter : agentACoachAdapter;
            const radarAdapter  = useLive ? watsonxAgentBRadarAdapter  : agentBRadarAdapter;

            const [coachResult, radarResult] = await Promise.all([
                coachAdapter.execute({ prId, diff }),
                radarAdapter.execute({ prId, diff, modifiedFiles }),
            ]);

            const executionTimeMs = Date.now() - startTime;

            const totalPromptTokens     = coachResult.tokenUsage.promptTokens     + radarResult.tokenUsage.promptTokens;
            const totalCompletionTokens = coachResult.tokenUsage.completionTokens + radarResult.tokenUsage.completionTokens;
            const bobcoinsBilled        = BOBCOIN_ECONOMY.calculateCost(totalPromptTokens, totalCompletionTokens);

            const responsePayload: PRAnalysisResponse = {
                prId,
                source: useLive ? 'watsonx_live' : 'mock_adapter',
                executionTimeMs,
                bobcoinsBilled,
                cacheKey,
                findings: coachResult.findings,
                blastRadius: radarResult.blastRadius,
                riskScore: radarResult.riskScore,
                releaseNotes: radarResult.releaseNotes,
            };

            diffCache.set(cacheKey, responsePayload);

            res.status(200).json({
                ...responsePayload,
                cacheHit: false,
                diffTruncated,
                githubPR: {
                    owner: ownerStr,
                    repo: repoStr,
                    number: parsedPrNumber,
                    ...prMeta,
                    modifiedFiles,
                },
            });

        } catch (error) {
            next(error);
        }
    }
}
