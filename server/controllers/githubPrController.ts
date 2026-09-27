import type { Request, Response, NextFunction } from 'express';
import { diffCache } from '../utils/cache';
import {
  agentACoachAdapter,
  agentBRadarAdapter,
  watsonxAgentACoachAdapter,
  watsonxAgentBRadarAdapter,
  type PRAnalysisResponse,
} from '../adapters/agentAdapters';
import { BOBCOIN_ECONOMY } from '../../src/data/bobPrompts';
import { MOCK_PRS } from '../../src/data/mockPrData';
import { fetchGitHubPRDiff, listRepositoryPRs } from '../services/githubClient';

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
