import type {
  CoachFinding,
  RiskScoreBreakdown,
  ReleaseNotes,
  PullRequest,
  StandardCategory,
} from '../types/sentinal';
import type { BlastRadiusGraphPayload } from '../../server/adapters/agentAdapters';

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
  title: string;
  description: string;
  enforcedCategories: StandardCategory[];
  enabled: boolean;
  requiresMinApprovals?: number;
}

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: 'rule-gov-approvals',
    code: 'GOV-01',
    title: 'Mandatory 2+ Reviewer Approvals',
    description: 'Requires at least 2 peer reviewer sign-offs before staging merge.',
    enforcedCategories: [],
    enabled: true,
    requiresMinApprovals: 2,
  },
  {
    id: 'rule-owasp-sec01',
    code: 'OWASP SEC-01',
    title: 'Input Sanitization & Verified Crypto',
    description: 'Enforces JWT signature verification, SQL parameterization, and ACID locks.',
    enforcedCategories: ['security'],
    enabled: true,
  },
  {
    id: 'rule-ts-strict',
    code: 'TS-STRICT-02',
    title: 'Strict TypeScript & API Contract Safety',
    description: 'Blocks breaking context interface mutations and unverified type assertions.',
    enforcedCategories: ['type_safety', 'architectural'],
    enabled: true,
  },
  {
    id: 'rule-solid-dry',
    code: 'SOLID-03',
    title: 'SOLID / DRY & Async Error Boundaries',
    description: 'Requires explicit promise rejection handling and separation of concerns.',
    enforcedCategories: ['solid_dry', 'test_coverage'],
    enabled: true,
  },
  {
    id: 'rule-perf-lru',
    code: 'PERF-04',
    title: 'Bounded Memory & Replica Routing',
    description: 'Prevents unbounded in-memory caches and connection pool starvation.',
    enforcedCategories: ['performance'],
    enabled: true,
  },
];

/**
 * Synthesizes a valid unified git diff string from a PullRequest object's diffLines,
 * incorporating any 1-Click patches applied by the developer so the backend SHA-256
 * cache key accurately reflects the current state of the code.
 */
export function buildUnifiedDiffFromPR(
  pr: PullRequest,
  appliedPatches: Record<string, string> = {}
): string {
  return pr.files
    .map((file) => {
      if (
        file.rawDiff &&
        file.rawDiff.trim().length > 0 &&
        Object.keys(appliedPatches).length === 0
      ) {
        return file.rawDiff;
      }
      const header = `diff --git a/${file.filename} b/${file.filename}\n--- a/${file.filename}\n+++ b/${file.filename}`;
      const body = file.diffLines
        .map((line) => {
          if (line.findingId && appliedPatches[line.findingId]) {
            return `+ ${appliedPatches[line.findingId].split('\n')[0]}`;
          }
          return line.content;
        })
        .join('\n');
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Calls POST /api/analyze-pr on the existing Express backend.
 */
export async function analyzePullRequestDiff(params: {
  prId?: string;
  diff: string;
  bypassCache?: boolean;
}): Promise<AnalyzePRClientResponse> {
  const response = await fetch('/api/analyze-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prId: params.prId,
      diff: params.diff,
      bypassCache: params.bypassCache ?? false,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Backend error (${response.status})`);
  }

  return data as AnalyzePRClientResponse;
}

/**
 * Calls GET /api/cache-stats on the existing Express backend.
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
