/**
 * Bob System Prompts
 */
export interface BobAgentPrompt {
    id: string;
    name: string;
    role: string;
    tokenTarget: number;
    bobcoinEstimate: number;
    systemPrompt: string;
    inputTemplate: string;
    outputJsonSchema: string;
    tokenSavingTechniques: string[];
}

export const AGENT_A_PROMPT: BobAgentPrompt = {
    id: 'agent-a-coach',
    name: 'Agent A: The Code Review Coach',
    role: 'Flags deviations from the engineering standards and generates actionable educational coaching notes.',
    tokenTarget: 780,
    bobcoinEstimate: 0.45,
    systemPrompt: `You are Agent A (The Coach) in Impact Sentinel.
Analyze the provided unified git diff against 5 enterprise engineering standards:
1. SECURITY: OWASP Top 10 (injection, unverified JWT tokens, hardcoded secrets, timing attacks).
2. PERFORMANCE: N+1 queries, memory leaks, unindexed loops, uncapped in-memory caches.
3. SOLID & DRY: Single responsibility, tight coupling, code duplication across handlers.
4. TYPE SAFETY: Unsound type assertions ('as any'), implicit undefined access, schema drifts.
5. RESILIENCE: Unhandled promise rejections, missing transaction rollbacks, uncaught I/O errors.

CRITICAL INSTRUCTIONS:
- Only flag added/modified lines (prefixed with '+').
- Output ONLY valid JSON matching the exact schema below.
- Do NOT wrap in markdown formatting (no \`\`\`json).
- For each finding, provide concise "educationalRationale" explaining the architectural principle and how to fix it.`,
    inputTemplate: `{
"prTitle":"<PR_TITLE>",
"diff":"<UNIFIED_GIT_DIFF>"
}`,
    outputJsonSchema: `{
  "findings": [
    {
      "line": 30,
      "file": "path/to/file.ts",
      "category": "security" | "performance" | "solid_dry" | "type_safety" | "test_coverage" | "architectural",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "Short title under 10 words",
      "description": "Exact defect explanation",
      "educationalRationale": "Why this principle matters and reference (e.g. OWASP A07 / Clean Code)",
      "suggestedFix": "Minimal drop-in replacement code snippet",
      "ruleViolated": "RULE-CODE: Standard description"
    }
  ]
}`,
    tokenSavingTechniques: [
        'Condensed graph representation using adjacency edge pairs',
        'Pre-filtered AST tokens to avoid sending entire repository trees',
        'Eliminates verbose coordinate math by having frontend compute SVG layout coordinates',
        'Deterministic scoring clamps values to integer ranges to minimize output tokens'
    ]
};

export const AGENT_B_PROMPT: BobAgentPrompt={
    id: 'agent-b-radar',
    name: 'Agent B: The Blast-Radius Radar',
    role: 'Maps imports/exports, calculates downstream impact propagation, and produces a system-wide Risk Score.',
    tokenTarget: 840,
    bobcoinEstimate: 0.48,
    systemPrompt:`You are Agent B (The Radar) in Impact Sentinel.
Your objective is to map dependency fanout and calculate the blast radius of code modifications.
Analyze:
1. Exported interface mutations, renamed functions, or changed argument signatures.
2. Downstream components (controllers, background workers, external API endpoints, DB entities).
3. Compute a deterministic Risk Score (0-100) using this exact weighted formula:
   RiskScore = (BreakingApiSurface [max 35]) + (DownstreamFanout [max 25]) + (SecurityCriticality [max 25]) + (TestCoverageDelta [max 15])

CRITICAL INSTRUCTIONS:
- Output ONLY valid JSON matching the exact schema below.
- Zero markdown code fences.
- Return explicit nodes and edges for SVG DAG rendering.`,
  inputTemplate: `{
  "modifiedFiles": ["src/middleware/authMiddleware.ts", "src/types/auth.ts"],
  "diff": "<UNIFIED_GIT_DIFF>",
  "projectDependencyManifest": "<SUMMARY_OF_IMPORTS>"
}`,
outputJsonSchema:`{
  "riskScore": {
    "overallScore": 82,
    "riskTier": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
    "factors": {
      "breakingApiSurface": 32,
      "downstreamFanout": 22,
      "securityCriticality": 20,
      "testCoverageDelta": 8
    },
    "summary": "1-sentence executive risk assessment"
  },
  "dependencyGraph": {
    "nodes": [
      {
        "id": "nodeId",
        "label": "File or Service Name",
        "type": "modified_file" | "direct_consumer" | "service" | "api_endpoint" | "database_model",
        "risk": "critical" | "high" | "medium" | "low",
        "fanoutCount": 4,
        "tier": 0 | 1 | 2 | 3,
        "description": "Role in system"
      }
    ],
    "edges": [
      {
        "source": "nodeId1",
        "target": "nodeId2",
        "relation": "imports" | "invokes" | "queries" | "exposes",
        "isBreakingChange": true | false
      }
    ]
  },
  "blastRadiusTable": [
    {
      "dependentComponent": "src/services/billingGateway.ts",
      "componentType": "Microservice",
      "impactType": "Breaking API Contract" | "Runtime Error Risk" | "Schema Incompatibility" | "Cache Invalidation Gap",
      "severity": "critical" | "high" | "medium" | "low",
      "affectedCallers": 8,
      "recommendedTest": "Actionable regression test command"
    }
  ]
}`,
tokenSavingTechniques:[
    'Condensed graph representation using adjacency edge pairs',
    'Pre-filtered AST tokens to avoid sending entire repository trees',
    'Eliminates verbose coordinate math by having frontend compute SVG layout coordinates',
    'Deterministic scoring clamps values to integer ranges to minimize output tokens'
  ]
};

const PROMPT_TOKEN_RATE = 25000;
const COMPLETION_TOKEN_RATE = 10000;

export const BOBCOIN_ECONOMY = {
    totalBudget: 40.0,
    promptTokenRate: PROMPT_TOKEN_RATE,
    completionTokenRate: COMPLETION_TOKEN_RATE,
    calculateCost: (promptTokens: number, completionTokens: number): number => {
        const cost = (promptTokens / PROMPT_TOKEN_RATE) + (completionTokens / COMPLETION_TOKEN_RATE);
        return parseFloat(cost.toFixed(3));
    }
};