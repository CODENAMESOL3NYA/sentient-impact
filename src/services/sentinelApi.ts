import type {
  CoachFinding,
  DependencyNode,
  DependencyEdge,
  BlastRadiusImpact,
  RiskScoreBreakdown,
  ReleaseNotes,
  PullRequest,
  StandardCategory,
} from '../types/sentinal';

export interface BlastRadiusGraphPayload {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  table: BlastRadiusImpact[];
}

export interface AnalyzePRRequestPayload {
  prId?: string;
  diff: string;
  bypassCache?: boolean;
}

export interface AnalyzePRClientResponse {
  prId: string;
  source: 'cache' | 'mock_adapter' | 'watsonx_live';
  executionTimeMs: number;
  bobcoinsBilled: number;
  cacheKey: string;
  cacheHit: boolean;
  fromCache?: boolean;
  findings: CoachFinding[];
  blastRadius: BlastRadiusGraphPayload;
  riskScore: RiskScoreBreakdown;
  releaseNotes: ReleaseNotes;
}

export interface CacheStatsPayload {
  status: string;
  cacheStats: {
    totalKeys: number;
    hits: number;
    misses: number;
    totalBobcoinSaved: number;
    evictions: number;
  };
  message: string;
}

export interface PolicyRule {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  enforcedCategories: StandardCategory[];
  isGovernanceRule?: boolean;
}

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: 'rule-gov-approvals',
    code: 'GOV-01',
    name: 'Mandatory 2+ Reviewer Approvals',
    description: 'Require at least two senior/peer sign-offs before merging into main or staging.',
    enabled: true,
    enforcedCategories: [],
    isGovernanceRule: true,
  },
  {
    id: 'rule-sec-owasp',
    code: 'OWASP SEC-01',
    name: 'Input & Token Sanitization (OWASP Top 10)',
    description: 'Enforce cryptographic JWT verification, SQL parameterization, and ACID financial locks.',
    enabled: true,
    enforcedCategories: ['security'],
  },
  {
    id: 'rule-ts-strict',
    code: 'TS-STRICT-02',
    name: 'Strict TypeScript No-Implicit-Any & Contract Stability',
    description: 'Block unverified type assertions and breaking context interface mutations.',
    enabled: true,
    enforcedCategories: ['type_safety', 'architectural'],
  },
  {
    id: 'rule-solid-dry',
    code: 'SOLID-03',
    name: 'SOLID / DRY & Async Error Boundary Compliance',
    description: 'Require explicit promise rejection handling and single-responsibility DTO separation.',
    enabled: true,
    enforcedCategories: ['solid_dry'],
  },
  {
    id: 'rule-perf-guard',
    code: 'PERF-04',
    name: 'Bounded Memory & Query Performance Guardrails',
    description: 'Prevent unbounded in-memory Map leaks, N+1 queries, and unindexed loops.',
    enabled: true,
    enforcedCategories: ['performance', 'test_coverage'],
  },
];

/**
 * Builds a deterministic unified git diff string from a PullRequest and any applied 1-click patches.
 */
export function buildUnifiedDiffFromPR(
  pr: PullRequest,
  appliedPatches: Record<string, string> = {}
): string {
  return pr.files
    .map((file) => {
      const header = `diff --git a/${file.filename} b/${file.filename}\n--- a/${file.filename}\n+++ b/${file.filename}`;
      const lines = file.diffLines
        .map((dl) => {
          if (dl.findingId && appliedPatches[dl.findingId]) {
            const patchLines = appliedPatches[dl.findingId]
              .split('\n')
              .map((line) => `+ ${line}`)
              .join('\n');
            return patchLines;
          }
          return dl.content;
        })
        .join('\n');
      return `${header}\n${lines}`;
    })
    .join('\n\n');
}

/**
 * Dispatches a git diff payload to POST /api/analyze-pr
 */
export async function analyzePullRequestDiff(
  payload: AnalyzePRRequestPayload
): Promise<AnalyzePRClientResponse> {
  const response = await fetch('/api/analyze-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Analysis failed with status ${response.status}`);
  }

  return data as AnalyzePRClientResponse;
}

/**
 * Retrieves SHA-256 deduplication cache telemetry from GET /api/cache-stats
 */
export async function fetchCacheTelemetry(): Promise<CacheStatsPayload | null> {
  try {
    const response = await fetch('/api/cache-stats');
    if (!response.ok) return null;
    return (await response.json()) as CacheStatsPayload;
  } catch {
    return null;
  }
}

/**
 * Checks backend bridge health via GET /api/health
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch {
    return false;
  }
}
