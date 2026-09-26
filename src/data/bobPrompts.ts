/**
 * Bob System Prompts
 */
export interface BobAgentPromp {
    id: string;
    name: string;
    role: string;
    tokenTarget: number;
    bobcoinEstimate: number;
    systemPrompt: string;
    inputTemplate: string;
    outputJSONSchema: string;
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

export const BOBCOIN_ECONOMY = {
    totalBudget: 40.0,
    promptTokenRate: 25000,
    completionTokenRate: 10000,
    calculateCost: (promptTokens: number, completionTokens: number): number => {
        const cost = (promptTokens / 25000) + (completionTokens / 10000);
        return Math.round(cost * 1000) / 1000;
    }
}