import { MOCK_PRS } from "@/src/data/mockPrData";
import type {
    CoachFinding,
    DependencyNode,
    DependencyEdge,
    BlastRadiusImpact,
    RiskScoreBreakdown,
    ReleaseNotes,
    PullRequest
} from '../../src/types/sentinal';

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
export class AgentACoachAdapter implements IAgentAdapter<{prId?: string; diff:string},{findings:CoachFinding[] }>{
    async execute(input: {prId?:string, diff:string}): Promise<{findings: CoachFinding[] }>{
        await new Promise((resolve)=>setTimeout(resolve,1500));

        const matchedPr = MOCK_PRS.find((p:PullRequest)=>p.id===input.prId)|| MOCK_PRS[0];

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
                return {findings:customFindings}
            }
        }
        return {
            findings:matchedPr.findings,
        };
    }
}

/**
 * Adapter B: The Blast-Radius Radar
 * Maps downstream dependencies,callers,public API routes and calculates risk score.
 */

export class AgentBRadarAdapter implements IAgentAdapter<{prId?:string;diff:string},{blastRadius:BlastRadiusGraphPayload;riskScore:RiskScoreBreakdown;releaseNotes: ReleaseNotes}>{
    async execute(input:{prId?:string;diff:string}): Promise<{blastRadius: BlastRadiusGraphPayload; riskScore:RiskScoreBreakdown; releaseNotes: ReleaseNotes}>{
        await new Promise((resolve)=>setTimeout(resolve,1500));

        const matchedPr = MOCK_PRS.find((p:PullRequest)=>p.id===input.prId)|| MOCK_PRS[0];

        return{
            blastRadius:{
                nodes:matchedPr.dependencyGraph.nodes,
                edges:matchedPr.dependencyGraph.edges,
                table:matchedPr.blastRadiusTable,
            },
            riskScore:matchedPr.riskScore,
            releaseNotes:matchedPr.releaseNotes,
        };
    }
}

export const agentACoachAdapter = new AgentACoachAdapter();
export const agentBRadarAdapter = new AgentBRadarAdapter();