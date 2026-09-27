import type { Request, Response, NextFunction } from 'express';
import { diffCache } from '../utils/cache';
import {
    agentACoachAdapter,
    agentBRadarAdapter,
    liveAgentACoachAdapter,
    liveAgentBRadarAdapter,
    type PRAnalysisResponse,
} from '../adapters/agentAdapters.js';
import { BOBCOIN_ECONOMY } from '../../src/data/bobPrompts.js';
import { resolveProvider } from '../services/llmClientFactory.js';

export class GitHubPrController {
  public static async listPRs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const owner = String(req.query.owner || 'sentinel-demo').trim();
      const repo = String(req.query.repo || 'core-platform').trim();
      const prs = await listRepositoryPRs(owner, repo);
      res.status(200).json({ owner, repo, prs });
    } catch (error) {
      next(error);
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
            const { owner, repo, prNumber, bypassCache = false, provider } = req.body as {
                owner?: unknown;
                repo?: unknown;
                prNumber?: unknown;
                bypassCache?: boolean;
                provider?: 'watsonx' | 'gemini';
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

            const resolvedProvider = resolveProvider(provider);

            // Namespace the cache key so it never collides with mock IDs like 'pr-142',
            // and include the provider so switching providers always produces a fresh result.
            const prId = `${ownerStr}/${repoStr}#${parsedPrNumber}`;
            const cacheKey = diffCache.generateDiffHash(`${resolvedProvider}::`, prId);

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
            const coachAdapter = useLive ? liveAgentACoachAdapter : agentACoachAdapter;
            const radarAdapter  = useLive ? liveAgentBRadarAdapter  : agentBRadarAdapter;

            const [coachResult, radarResult] = await Promise.all([
                coachAdapter.execute({ prId, diff, provider: resolvedProvider }),
                radarAdapter.execute({ prId, diff, modifiedFiles, provider: resolvedProvider }),
            ]);

            const executionTimeMs = Date.now() - startTime;

            const totalPromptTokens     = coachResult.tokenUsage.promptTokens     + radarResult.tokenUsage.promptTokens;
            const totalCompletionTokens = coachResult.tokenUsage.completionTokens + radarResult.tokenUsage.completionTokens;
            const bobcoinsBilled        = BOBCOIN_ECONOMY.calculateCost(totalPromptTokens, totalCompletionTokens);

            const responsePayload: PRAnalysisResponse = {
                prId,
                source: useLive ? `${resolvedProvider}_live` as 'watsonx_live' | 'gemini_live' : 'mock_adapter',
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

  public static async analyzePR(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    try {
      const {
        owner = 'sentinel-demo',
        repo = 'core-platform',
        prNumber,
        bypassCache = false,
      } = req.body as {
        owner?: string;
        repo?: string;
        prNumber: number;
        bypassCache?: boolean;
      };

      if (!prNumber) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'A valid prNumber is required in the request body',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const prData = await fetchGitHubPRDiff(owner, repo, Number(prNumber));
      const matchedMock = MOCK_PRS.find((p) => p.number === Number(prNumber));
      const prId = matchedMock ? matchedMock.id : `gh-${owner}-${repo}-${prNumber}`;
      const cacheKey = diffCache.generateDiffHash(prData.diff, prId);

      if (!bypassCache) {
        const cached = diffCache.get<PRAnalysisResponse>(cacheKey);
        if (cached) {
          res.status(200).json({
            ...cached,
            source: 'cache',
            executionTimeMs: Date.now() - startTime,
            bobcoinsBilled: 0.0,
            cacheHit: true,
            diffTruncated: prData.diffTruncated,
            githubPR: {
              owner,
              repo,
              number: Number(prNumber),
              title: prData.prMeta.title,
              author: prData.prMeta.author,
              sourceBranch: prData.prMeta.sourceBranch,
              targetBranch: prData.prMeta.targetBranch,
              modifiedFiles: prData.modifiedFiles,
            },
          });
          return;
        }
      }

      const useLive = process.env.USE_LIVE_LLM === 'true';
      const coachAdapter = useLive ? watsonxAgentACoachAdapter : agentACoachAdapter;
      const radarAdapter = useLive ? watsonxAgentBRadarAdapter : agentBRadarAdapter;
      const adapterPrId = matchedMock ? matchedMock.id : undefined;

      const [coachResult, radarResult] = await Promise.all([
        coachAdapter.execute({ prId: adapterPrId, diff: prData.diff }),
        radarAdapter.execute({ prId: adapterPrId, diff: prData.diff }),
      ]);

      const executionTimeMs = Date.now() - startTime;
      const totalPromptTokens =
        coachResult.tokenUsage.promptTokens + radarResult.tokenUsage.promptTokens;
      const totalCompletionTokens =
        coachResult.tokenUsage.completionTokens + radarResult.tokenUsage.completionTokens;
      const bobcoinsBilled = BOBCOIN_ECONOMY.calculateCost(
        totalPromptTokens,
        totalCompletionTokens
      );

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
        diffTruncated: prData.diffTruncated,
        githubPR: {
          owner,
          repo,
          number: Number(prNumber),
          title: prData.prMeta.title,
          author: prData.prMeta.author,
          sourceBranch: prData.prMeta.sourceBranch,
          targetBranch: prData.prMeta.targetBranch,
          modifiedFiles: prData.modifiedFiles,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
