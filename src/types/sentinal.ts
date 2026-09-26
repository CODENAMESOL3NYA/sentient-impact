/**
 * Core Type Definitions
 * 
 */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type StandardCategory =
| 'security'
| 'performance'
| 'solid_dry'
| 'type_safety'
| 'test_coverage'
| 'architectural';

export interface DiffLine {
    type: 'addition' | 'deletion' | 'context' | 'header';
    oldLineNumber?: number;
    newLineNumber?: number;
    content: string;
    hasFinding?:boolean;
    findingId?:string
}

export interface CoachFinding {
    id: string;
    line: number;
    endLine?: number;
    file: string;
    category: StandardCategory;
    severity: SeverityLevel;
    title: string;
    description:string;
    educationalRationale: string;
    suggestedFix?: string;
    codeSnippet?: string;
    ruleViolated: string;
}

export interface DependencyNode {
  id: string;
  label: string;
  type: 'modified_file' | 'direct_consumer' | 'service' | 'api_endpoint' | 'database_model';
  risk: SeverityLevel;
  fanoutCount: number;
  tier: number; // 0 = origin, 1 = direct import, 2 = service, 3 = public route/db
  description: string;
  x?: number;
  y?: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  relation: 'imports' | 'invokes' | 'queries' | 'exposes';
  isBreakingChange?: boolean;
}

export interface BlastRadiusImpact {
  dependentComponent: string;
  componentType: string;
  impactType: 'Breaking API Contract' | 'Runtime Error Risk' | 'Schema Incompatibility' | 'Cache Invalidation Gap';
  severity: SeverityLevel;
  affectedCallers: number;
  recommendedTest: string;
}

export interface RiskScoreBreakdown {
  overallScore: number; // 0 - 100
  riskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors: {
    breakingApiSurface: number; // max 35
    downstreamFanout: number;    // max 25
    securityCriticality: number; // max 25
    testCoverageDelta: number;   // max 15
  };
  summary: string;
}

export interface ReleaseNotes {
  title: string;
  versionTarget: string;
  executiveSummary: string;
  breakingChanges: string[];
  downstreamServicesToAlert: string[];
  qaChecklist: { id: string; item: string; checked: boolean }[];
  rollbackPlan: string[];
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  authorAvatar?: string;
  targetBranch: string;
  sourceBranch: string;
  commitHash: string;
  changedFilesCount: number;
  additions: number;
  deletions: number;
  files: {
    filename: string;
    additions: number;
    deletions: number;
    rawDiff: string;
    diffLines: DiffLine[];
  }[];
  findings: CoachFinding[];
  dependencyGraph: {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
  };
  blastRadiusTable: BlastRadiusImpact[];
  riskScore: RiskScoreBreakdown;
  releaseNotes: ReleaseNotes;
  estimatedTokens: {
    promptTokens: number;
    completionTokens: number;
    bobcoinCost: number;
  };
}

export interface BobcoinTransaction {
  id: string;
  timestamp: string;
  taskId: string;
  agent: 'Agent A (The Coach)' | 'Agent B (The Radar)' | 'Aggregator' | 'Prompt Dry-Run';
  tokensUsed: number;
  coinsDeducted: number;
  balanceAfter: number;
  prNumber: number;
  cached: boolean;
}

export interface BobSessionLog {
  taskId: string;
  sessionTitle: string;
  startTime: string;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  promptTokens: number;
  completionTokens: number;
  bobcoins: number;
  summary: string;
}

export type SprintPhase = 
  | 'Phase 1: Dataset & Mocking (Hrs 01-06)'
  | 'Phase 2: UI & Architecture (Hrs 07-16)'
  | 'Phase 3: Prompt Engineering & Bob Shell (Hrs 17-28)'
  | 'Phase 4: Node.js Backend Bridge (Hrs 29-38)'
  | 'Phase 5: E2E Integration & Coins Test (Hrs 39-44)'
  | 'Phase 6: Compliance & Submission (Hrs 45-48)';

export interface MicroSprintTask {
  id: string;
  phase: SprintPhase;
  timeBlock: string;
  title: string;
  assignee: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'high' | 'critical' | 'medium';
  bobcoinBudget: number;
  description: string;
  acceptanceCriteria: string[];
}
