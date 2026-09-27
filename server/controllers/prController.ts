import type { Request, Response, NextFunction } from "express";
import { diffCache } from "../utils/cache";
import {
    agentACoachAdapter,
    agentBRadarAdapter,
    liveAgentACoachAdapter,
    liveAgentBRadarAdapter,
    type PRAnalysisResponse,
} from "../adapters/agentAdapters";
import { BOBCOIN_ECONOMY } from "../../src/data/bobPrompts";
import { resolveProvider } from "../services/llmClientFactory";

/**
 * Interface defining the expected body payload for the analyze-pr route
 */

export interface AnalyzePRRequestBody{
    prId?:string;
    diff:string;
    bypassCache?:boolean;
    provider?: 'watsonx' | 'gemini';
}

/**
 * Controller class managing PR analysis requests
 * Orchestrates:
 * Payload validation
 * Deterministic cache lookup
 * Concurrent subagent execution
 * Aggregated response formatting and cache storage
 */
export class PRAnalysisController{

    /**
     * Main route handler for POST /api/analyze-pr
     */

    public static async analyzePR(req:Request, res: Response, next:NextFunction): Promise<void>{
        const startTime = Date.now();

        try {
            const { prId, diff, bypassCache = false, provider } = req.body as AnalyzePRRequestBody;

            if(!diff || typeof diff !== 'string' || diff.trim().length ===0){
                res.status(400).json({
                    error:'BAD_REQUEST',
                    message:'A valid git diff string is required in the request body',
                    timestamp:new Date().toISOString(),
                });
                return;
            }

            const resolvedProvider = resolveProvider(provider);
            const cacheKey = diffCache.generateDiffHash(`${resolvedProvider}::${diff}`, prId);

            if(!bypassCache){
                const cachedResult = diffCache.get<PRAnalysisResponse>(cacheKey);
                if(cachedResult){
                    res.status(200).json({
                        ...cachedResult,
                        source:'cache',
                        executionTimeMs:Date.now()-startTime,
                        bobcoinsBilled:0.0,
                        cacheHit:true
                    });
                    return;
                }
            }

            const useLive = process.env.USE_LIVE_LLM === 'true';
            const coachAdapter = useLive ? liveAgentACoachAdapter : agentACoachAdapter;
            const radarAdapter  = useLive ? liveAgentBRadarAdapter  : agentBRadarAdapter;

            const [coachResult,radarResult]=await Promise.all([
                coachAdapter.execute({ prId, diff, provider: resolvedProvider }),
                radarAdapter.execute({ prId, diff, provider: resolvedProvider }),
            ]);

            const executionTimeMs = Date.now()-startTime;

            // Derive cost from actual token usage reported by each agent.
            const totalPromptTokens     = coachResult.tokenUsage.promptTokens     + radarResult.tokenUsage.promptTokens;
            const totalCompletionTokens = coachResult.tokenUsage.completionTokens + radarResult.tokenUsage.completionTokens;
            const bobcoinsBilled        = BOBCOIN_ECONOMY.calculateCost(totalPromptTokens, totalCompletionTokens);

            const responsePayload:PRAnalysisResponse={
                prId:prId||'custom-pr',
                source: useLive ? `${resolvedProvider}_live` as 'watsonx_live'|'gemini_live' : 'mock_adapter',
                executionTimeMs,
                bobcoinsBilled,
                cacheKey,
                findings:coachResult.findings,
                blastRadius:radarResult.blastRadius,
                riskScore:radarResult.riskScore,
                releaseNotes:radarResult.releaseNotes
            };

            diffCache.set(cacheKey,responsePayload);

            res.status(200).json({
                ...responsePayload,
                cacheHit:false,
            });

        } catch (error) {
            next(error)            
        }
    }

    /**
     * Diagnostic endpoint to view cache performance and Bobcoins saved
     * GET /api/cache-stats
     */

    public static getCacheStats(req:Request,res:Response):void{
        const stats = diffCache.getStats();
        res.status(200).json({
            status:'operational',
            cacheStats:stats,
            message:`Aggressive caching has preserved ${stats.totalBobcoinSaved.toFixed(2)} Bobcoins`
        });
    }
}