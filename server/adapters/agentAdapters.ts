import { MOCK_PRS } from '../../src/data/mockPrData';
import { AGENT_A_PROMPT, AGENT_B_PROMPT } from '../../src/data/bobPrompts';
import { getWatsonxClient } from '../services/watsonxClient';
import type {
    CoachFinding,
    DependencyNode,
    DependencyEdge,
    BlastRadiusImpact,
    RiskScoreBreakdown,
    ReleaseNotes,
    PullRequest
} from '../../src/types/sentinal';

/**
 * Token usage reported by a single agent execution.
 * In mock mode these are estimated from the prompt's tokenTarget and the diff length.
 * In live mode the LLM response fills these fields directly.
 */
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
}

//Interface to represent the blast-radius network graph
export interface BlastRadiusGraphPayload{
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    table: BlastRadiusImpact[];
}

//Interface representing the unified analysis output by the backend

export interface PRAnalysisResponse {
    prId: string;
    source: 'cache'|'mock_adapter'|'watsonx_live';
    executionTimeMs:number;
    bobcoinsBilled:number;
    cacheKey:string;
    findings:CoachFinding[];
    blastRadius:BlastRadiusGraphPayload;
    riskScore:RiskScoreBreakdown;
    releaseNotes:ReleaseNotes;
}

export interface IAgentAdapter<TInput,TOutput>{
    execute(input:TInput): Promise<TOutput>;
}

/**
 * Adapter A: The Code Review Coach
 * It Analyzes exact changed lines, flagging standard violations and security risks
 */
export class AgentACoachAdapter implements IAgentAdapter<{prId?: string; diff:string},{findings:CoachFinding[]; tokenUsage: TokenUsage }>{
    async execute(input: {prId?:string, diff:string}): Promise<{findings: CoachFinding[]; tokenUsage: TokenUsage }>{
        await new Promise((resolve)=>setTimeout(resolve,Number(process.env.AGENT_SIMULATION_DELAY_MS)));

        // Estimate prompt tokens: base prompt size + diff length (rough char→token ratio of 4:1).
        const promptTokens = AGENT_A_PROMPT.tokenTarget + Math.ceil(input.diff.length / 4);
        // Estimate completion tokens: one finding ≈ 120 tokens on average.
        const matchedPr = MOCK_PRS.find((p:PullRequest)=>p.id===input.prId);

        // If a prId was provided but doesn't match any seeded mock, return empty findings
        // rather than silently injecting mock data that belongs to a different PR.
        if(input.prId && !matchedPr){
            return {
                findings: [],
                tokenUsage: { promptTokens, completionTokens: 0 },
            };
        }

        const pr = matchedPr ?? MOCK_PRS[0];

        //Check if diff contains specific security keywords to dynamically flag if custom diff
        if(!input.prId && input.diff){
            const customFindings:CoachFinding[]=[];
            if(input.diff.includes('algorithms:')||input.diff.includes('jwt.')){
                customFindings.push({
                    id:'custom-sec-1',
                    file:'custom/auth.ts',
                    line:14,
                    endLine:16,
                    severity:'critical',
                    category:'security',
                    ruleViolated:'CWE-327: Broken Crypto Algorithm',
                    title:'Unrestricted JWT Algorithms Detected',
                    description:'Explicit algorithms whitelist is missing, leaving the token verification vulnerable to algorithm downgrade attacks.',
                    educationalRationale:'When verifying JSON Web Tokens, always enforce the expected signing algorithm (e.g. algorithms: ["HS256"]) to prevent forging signatures with "none" or asymmetric/symmetric confusion.',
                    suggestedFix:'jwt.verify(token, secret, { algorithms: ["HS256"] });',
                    codeSnippet:'jwt.verify(token, secret);'
                });
            }
            if(customFindings.length>0){
                return {
                    findings: customFindings,
                    tokenUsage: { promptTokens, completionTokens: customFindings.length * 120 },
                };
            }
        }
        return {
            findings: pr.findings,
            tokenUsage: { promptTokens, completionTokens: pr.findings.length * 120 },
        };
    }
}

/**
 * Adapter B: The Blast-Radius Radar
 * Maps downstream dependencies,callers,public API routes and calculates risk score.
 */

export class AgentBRadarAdapter implements IAgentAdapter<{prId?:string;diff:string},{blastRadius:BlastRadiusGraphPayload;riskScore:RiskScoreBreakdown;releaseNotes:ReleaseNotes;tokenUsage:TokenUsage}>{
    async execute(input:{prId?:string;diff:string}): Promise<{blastRadius:BlastRadiusGraphPayload;riskScore:RiskScoreBreakdown;releaseNotes:ReleaseNotes;tokenUsage:TokenUsage}>{
        await new Promise((resolve)=>setTimeout(resolve,Number(process.env.AGENT_SIMULATION_DELAY_MS)));

        // Estimate prompt tokens: base prompt size + diff length (rough char→token ratio of 4:1).
        const promptTokens = AGENT_B_PROMPT.tokenTarget + Math.ceil(input.diff.length / 4);
        const matchedPr = MOCK_PRS.find((p:PullRequest)=>p.id===input.prId);

        // If a prId was provided but doesn't match any seeded mock, return an empty result
        // rather than silently returning blast-radius data that belongs to a different PR.
        if(input.prId && !matchedPr){
            return {
                blastRadius: { nodes: [], edges: [], table: [] },
                riskScore: {
                    overallScore: 0,
                    riskTier: 'LOW',
                    factors: { breakingApiSurface: 0, downstreamFanout: 0, securityCriticality: 0, testCoverageDelta: 0 },
                    summary: 'No mock data available for this PR.',
                },
                releaseNotes: {
                    title: 'Release Notes',
                    versionTarget: 'TBD',
                    executiveSummary: '',
                    breakingChanges: [],
                    downstreamServicesToAlert: [],
                    qaChecklist: [],
                    rollbackPlan: [],
                },
                tokenUsage: { promptTokens, completionTokens: 0 },
            };
        }

        const pr = matchedPr ?? MOCK_PRS[0];

        // Estimate completion tokens: graph nodes + edges + table rows each cost ~80 tokens.
        const completionTokens =
            (pr.dependencyGraph.nodes.length +
             pr.dependencyGraph.edges.length +
             pr.blastRadiusTable.length) * 80;

        return{
            blastRadius:{
                nodes:pr.dependencyGraph.nodes,
                edges:pr.dependencyGraph.edges,
                table:pr.blastRadiusTable,
            },
            riskScore:pr.riskScore,
            releaseNotes:pr.releaseNotes,
            tokenUsage: { promptTokens, completionTokens },
        };
    }
}

export const agentACoachAdapter = new AgentACoachAdapter();
export const agentBRadarAdapter = new AgentBRadarAdapter();

// ---------------------------------------------------------------------------
// Live adapters — powered by watsonx.ai foundation models
// ---------------------------------------------------------------------------

/**
 * Strips markdown code fences that some models add despite the system prompt
 * instructing them not to. Handles ```json ... ``` and bare ``` ... ``` wrapping.
 */
function stripCodeFences(raw: string): string {
    return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

/**
 * Live Adapter A: The Code Review Coach (watsonx)
 * Sends the real diff to a foundation model and parses the JSON response
 * into CoachFinding[] with real token usage.
 */
export class WatsonxAgentACoachAdapter
    implements IAgentAdapter<{ prId?: string; diff: string }, { findings: CoachFinding[]; tokenUsage: TokenUsage }>
{
    async execute(input: { prId?: string; diff: string }): Promise<{ findings: CoachFinding[]; tokenUsage: TokenUsage }> {
        const client = getWatsonxClient();

        const userContent = AGENT_A_PROMPT.inputTemplate
            .replace('<PR_TITLE>', input.prId ?? 'Custom PR')
            .replace('<UNIFIED_GIT_DIFF>', input.diff);

        // Append the output schema to the system prompt so the model knows exactly
        // what JSON shape to produce.
        const systemPrompt =
            `${AGENT_A_PROMPT.systemPrompt}\n\nOUTPUT SCHEMA (return ONLY this JSON, no markdown fences):\n${AGENT_A_PROMPT.outputJsonSchema}`;

        const { text, promptTokens, completionTokens } = await client.chat(systemPrompt, userContent);

        let parsed: { findings: CoachFinding[] };
        try {
            parsed = JSON.parse(stripCodeFences(text));
        } catch {
            throw new Error(`[WatsonxAgentA] Failed to parse model response as JSON.\nRaw output:\n${text}`);
        }

        // Ensure every finding has a unique id (model may omit it).
        const findings: CoachFinding[] = (parsed.findings ?? []).map((f, i) => ({
            ...f,
            id: f.id ?? `wx-a-finding-${i}`,
        }));

        return {
            findings,
            tokenUsage: { promptTokens, completionTokens },
        };
    }
}

/**
 * Live Adapter B: The Blast-Radius Radar (watsonx)
 * Sends the real diff to a foundation model and parses the JSON response
 * into blast-radius graph, risk score, and release notes with real token usage.
 */
export class WatsonxAgentBRadarAdapter
    implements IAgentAdapter<
        { prId?: string; diff: string; modifiedFiles?: string[] },
        { blastRadius: BlastRadiusGraphPayload; riskScore: RiskScoreBreakdown; releaseNotes: ReleaseNotes; tokenUsage: TokenUsage }
    >
{
    async execute(input: { prId?: string; diff: string; modifiedFiles?: string[] }): Promise<{
        blastRadius: BlastRadiusGraphPayload;
        riskScore: RiskScoreBreakdown;
        releaseNotes: ReleaseNotes;
        tokenUsage: TokenUsage;
    }> {
        const client = getWatsonxClient();

        // Build the modifiedFiles JSON array from explicit input or extract from diff headers.
        let fileListJson: string;
        if (input.modifiedFiles && input.modifiedFiles.length > 0) {
            fileListJson = input.modifiedFiles.map(f => `"${f}"`).join(', ');
        } else {
            // Extract filenames from +++ b/<path> lines in the unified diff.
            const extracted = [...input.diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(m => `"${m[1]}"`);
            fileListJson = extracted.length > 0 ? extracted.join(', ') : '"unknown"';
        }

        const userContent = AGENT_B_PROMPT.inputTemplate
            .replace('"src/middleware/authMiddleware.ts", "src/types/auth.ts"', fileListJson)
            .replace('<UNIFIED_GIT_DIFF>', input.diff)
            .replace('<SUMMARY_OF_IMPORTS>', 'See diff above.');

        const systemPrompt =
            `${AGENT_B_PROMPT.systemPrompt}\n\nOUTPUT SCHEMA (return ONLY this JSON, no markdown fences):\n${AGENT_B_PROMPT.outputJsonSchema}`;

        const { text, promptTokens, completionTokens } = await client.chat(systemPrompt, userContent);

        let parsed: {
            riskScore: RiskScoreBreakdown;
            dependencyGraph: { nodes: DependencyNode[]; edges: DependencyEdge[] };
            blastRadiusTable: BlastRadiusImpact[];
            releaseNotes?: ReleaseNotes;
        };
        try {
            parsed = JSON.parse(stripCodeFences(text));
        } catch {
            throw new Error(`[WatsonxAgentB] Failed to parse model response as JSON.\nRaw output:\n${text}`);
        }

        // Provide a safe fallback for releaseNotes in case the model omits it.
        const releaseNotes: ReleaseNotes = parsed.releaseNotes ?? {
            title: 'Release Notes',
            versionTarget: 'TBD',
            executiveSummary: parsed.riskScore?.summary ?? '',
            breakingChanges: [],
            downstreamServicesToAlert: [],
            qaChecklist: [],
            rollbackPlan: [],
        };

        return {
            blastRadius: {
                nodes: parsed.dependencyGraph?.nodes ?? [],
                edges: parsed.dependencyGraph?.edges ?? [],
                table: parsed.blastRadiusTable ?? [],
            },
            riskScore: parsed.riskScore,
            releaseNotes,
            tokenUsage: { promptTokens, completionTokens },
        };
    }
}

export const watsonxAgentACoachAdapter = new WatsonxAgentACoachAdapter();
export const watsonxAgentBRadarAdapter = new WatsonxAgentBRadarAdapter();