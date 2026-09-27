import { useState, useEffect, useCallback } from 'react';
import {
  GitPullRequest,
  GitBranch,
  Zap,
  RefreshCw,
  Code2,
  Radar,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';
import { MOCK_PRS } from './data/mockPrData';
import type { PullRequest, CoachFinding } from './types/sentinal';
import {
  DEFAULT_POLICY_RULES,
  analyzePullRequestDiff,
  buildUnifiedDiffFromPR,
  fetchCacheTelemetry,
  type AnalyzePRClientResponse,
  type CacheStatsPayload,
  type PolicyRule,
} from './services/sentinelApi';
import { PolicyRulesetDrawer } from './components/PolicyRulesetDrawer';
import { DiffCoachView } from './components/DiffCoachView';
import { BlastRadiusHud } from './components/BlastRadiusHud';
import {
  LoadingSkeletonHud,
  type AnalysisStage,
} from './components/LoadingSkeletonHud';
import { CustomDiffModal } from './components/CustomDiffModal';

type HudPerspective = 'developer' | 'release';

export default function App() {
  // Active PR & perspective state
  const [selectedPrId, setSelectedPrId] = useState<string>(MOCK_PRS[0].id);
  const [customPr, setCustomPr] = useState<PullRequest | null>(null);
  const [perspective, setPerspective] = useState<HudPerspective>('developer');

  // Lead Policy Ruleset state (Pillar 1)
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>(DEFAULT_POLICY_RULES);
  const [isPolicyDrawerOpen, setIsPolicyDrawerOpen] = useState<boolean>(false);
  const [reviewerApprovals, setReviewerApprovals] = useState<number>(1);
  const [appliedPatches, setAppliedPatches] = useState<Record<string, string>>({});

  // Backend API analysis & SHA-256 cache state
  const [analysisResult, setAnalysisResult] = useState<AnalyzePRClientResponse | null>(null);
  const [cacheTelemetry, setCacheTelemetry] = useState<CacheStatsPayload | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<AnalysisStage>('hashing');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Custom diff modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);

  const activePr: PullRequest =
    selectedPrId === 'custom-pr' && customPr
      ? customPr
      : MOCK_PRS.find((p) => p.id === selectedPrId) ?? MOCK_PRS[0];

  const refreshCacheStats = useCallback(async () => {
    const stats = await fetchCacheTelemetry();
    if (stats) {
      setCacheTelemetry(stats);
    }
  }, []);

  // Trigger POST /api/analyze-pr with Multi-Stage Micro Loading States
  const triggerAnalysis = useCallback(
    async (
      targetPr: PullRequest,
      patches: Record<string, string>,
      bypassCache = false,
      overridePrId?: string
    ) => {
      setIsAnalyzing(true);
      setErrorBanner(null);
      setLoadingStage('hashing');

      const stageTimer1 = setTimeout(() => setLoadingStage('subagents'), 180);
      const stageTimer2 = setTimeout(() => setLoadingStage('topology'), 380);

      try {
        const unifiedDiff = buildUnifiedDiffFromPR(targetPr, patches);
        const hasPatches = Object.keys(patches).length > 0;
        // When patches are applied or custom diff is used, send undefined/custom prId or let the diff hash reflect the modified lines
        const effectivePrId =
          overridePrId !== undefined
            ? overridePrId
            : targetPr.id === 'custom-pr'
            ? undefined
            : targetPr.id;

        const response = await analyzePullRequestDiff({
          prId: effectivePrId,
          diff: unifiedDiff,
          bypassCache,
        });

        // Wait briefly so the multi-stage micro steps settle smoothly
        await new Promise((r) => setTimeout(r, 240));

        // Filter out findings that have been patched in the working tree if re-verifying
        const remainingFindings = hasPatches
          ? response.findings.filter((f) => !patches[f.id])
          : response.findings;

        setAnalysisResult({
          ...response,
          findings: remainingFindings,
        });

        await refreshCacheStats();
      } catch (err) {
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Failed to communicate with /api/analyze-pr backend bridge.'
        );
      } finally {
        clearTimeout(stageTimer1);
        clearTimeout(stageTimer2);
        setIsAnalyzing(false);
      }
    },
    [refreshCacheStats]
  );

  // Initial analysis on mount and when switching PRs
  useEffect(() => {
    triggerAnalysis(activePr, {}, false);
  }, [selectedPrId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectPR = (prId: string) => {
    setAppliedPatches({});
    setSelectedPrId(prId);
  };

  const handleToggleRule = (ruleId: string) => {
    setPolicyRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const handleApplyPatch = (finding: CoachFinding) => {
    if (!finding.suggestedFix) return;
    setAppliedPatches((prev) => ({
      ...prev,
      [finding.id]: finding.suggestedFix!,
    }));
  };

  const handleRevertPatch = (findingId: string) => {
    setAppliedPatches((prev) => {
      const next = { ...prev };
      delete next[findingId];
      return next;
    });
  };

  const handleRunCustomDiff = (title: string, diffText: string, bypassCache: boolean) => {
    const rawLines = diffText.split('\n');
    let lineCounter = 10;
    const parsedDiffLines = rawLines.map((line) => {
      if (line.startsWith('@@')) {
        return { type: 'header' as const, content: line };
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        lineCounter += 1;
        return {
          type: 'addition' as const,
          newLineNumber: lineCounter,
          content: line,
          hasFinding: line.includes('jwt.') || line.includes('algorithms:'),
        };
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        return {
          type: 'deletion' as const,
          oldLineNumber: lineCounter,
          content: line,
        };
      }
      lineCounter += 1;
      return {
        type: 'context' as const,
        oldLineNumber: lineCounter,
        newLineNumber: lineCounter,
        content: line,
      };
    });

    const syntheticPr: PullRequest = {
      ...MOCK_PRS[0],
      id: 'custom-pr',
      number: 199,
      title,
      author: 'local-workspace',
      sourceBranch: 'hotfix/custom-diff',
      targetBranch: 'main',
      commitHash: 'c8f19a2',
      changedFilesCount: 1,
      additions: parsedDiffLines.filter((l) => l.type === 'addition').length,
      deletions: parsedDiffLines.filter((l) => l.type === 'deletion').length,
      files: [
        {
          filename: 'custom/auth.ts',
          additions: parsedDiffLines.filter((l) => l.type === 'addition').length,
          deletions: parsedDiffLines.filter((l) => l.type === 'deletion').length,
          rawDiff: diffText,
          diffLines: parsedDiffLines,
        },
      ],
    };

    setCustomPr(syntheticPr);
    setAppliedPatches({});
    setSelectedPrId('custom-pr');
    triggerAnalysis(syntheticPr, {}, bypassCache, undefined);
  };

  // Current effective findings, blast radius, riskScore, and releaseNotes from backend response (with safe fallback while loading)
  const findings = analysisResult?.findings ?? activePr.findings;
  const blastRadius = analysisResult?.blastRadius ?? {
    nodes: activePr.dependencyGraph.nodes,
    edges: activePr.dependencyGraph.edges,
    table: activePr.blastRadiusTable,
  };
  const riskScore = analysisResult?.riskScore ?? activePr.riskScore;
  const releaseNotes = analysisResult?.releaseNotes ?? activePr.releaseNotes;

  const enforcedCategories = new Set(
    policyRules.filter((r) => r.enabled).flatMap((r) => r.enforcedCategories)
  );
  const activeFindingsCount = findings.filter(
    (f) => enforcedCategories.has(f.category) && !appliedPatches[f.id]
  ).length;

  const isCachedResponse =
    analysisResult !== null &&
    (analysisResult.cacheHit === true ||
      analysisResult.fromCache === true ||
      analysisResult.bobcoinsBilled === 0 ||
      analysisResult.source === 'cache');

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Brand) — Zone 2 (Perspective Toggle) — Zone 3 (Primary Actions) */}
      <header className="h-14 px-6 border-b border-[#1E293B] bg-[#0D131F] flex items-center justify-between gap-4 shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap"
        >
          Impact Sentinel
        </a>

        {/* Zone 2: Role-Contextual Perspective Toggle */}
        <nav
          aria-label="HUD Perspective Switcher"
          className="flex items-center gap-1 p-1 bg-[#090D16] border border-[#1E293B] rounded-lg"
        >
          <button
            type="button"
            onClick={() => setPerspective('developer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              perspective === 'developer'
                ? 'bg-[#131C2E] text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Developer Review HUD</span>
            <span className="font-mono text-[11px] tabular-nums text-amber-300">
              ({activeFindingsCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPerspective('release')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              perspective === 'release'
                ? 'bg-[#131C2E] text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Release / Lead HUD</span>
            <span className="font-mono text-[11px] tabular-nums text-rose-300">
              ({riskScore.overallScore}/100)
            </span>
          </button>
        </nav>

        {/* Zone 3: 1–2 Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCustomModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#090D16] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Inspect Custom Diff</span>
          </button>

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => triggerAnalysis(activePr, appliedPatches, false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>Verify PR</span>
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {errorBanner && (
        <div className="px-6 py-2.5 bg-rose-950/60 border-b border-rose-500/40 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-300 hover:text-white font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5">
        {/* Embedded GitHub PR Companion Context Header */}
        <section className="border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3">
          {/* PR Selector Tabs + Zero-Cost Cache Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {MOCK_PRS.map((prItem) => {
                const isSelected = prItem.id === selectedPrId;
                return (
                  <button
                    key={prItem.id}
                    type="button"
                    onClick={() => handleSelectPR(prItem.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#131C2E] border-sky-500/50 text-slate-100 font-semibold'
                        : 'bg-[#090D16] border-[#1E293B] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <GitPullRequest className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="font-mono">#{prItem.number}</span>
                    <span className="truncate max-w-[180px]">{prItem.title}</span>
                  </button>
                );
              })}

              {customPr && (
                <button
                  type="button"
                  onClick={() => handleSelectPR('custom-pr')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap ${
                    selectedPrId === 'custom-pr'
                      ? 'bg-[#131C2E] border-sky-500/50 text-slate-100 font-semibold'
                      : 'bg-[#090D16] border-[#1E293B] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-mono">#199</span>
                  <span className="truncate max-w-[160px]">{customPr.title}</span>
                </button>
              )}
            </div>

            {/* Zero-Cost Cache Badge & Telemetry */}
            <div className="flex items-center gap-3">
              {analysisResult && (
                <>
                  {isCachedResponse ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold whitespace-nowrap">
                      <span>⚡ Cached Analysis • 0.00 Coins</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Subagent Run • {analysisResult.bobcoinsBilled.toFixed(2)} Coins
                      </span>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() => triggerAnalysis(activePr, appliedPatches, false)}
                        className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
                      >
                        Test Cache Hit
                      </button>
                    </div>
                  )}
                </>
              )}

              {cacheTelemetry && (
                <span className="hidden lg:inline text-xs font-mono text-slate-400 tabular-nums">
                  Saved: {cacheTelemetry.cacheStats.totalBobcoinSaved.toFixed(2)} Coins (
                  {cacheTelemetry.cacheStats.hits} hits)
                </span>
              )}
            </div>
          </div>

          {/* Active PR Details Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-semibold text-sky-400">
                  #{activePr.number}
                </span>
                <h1 className="text-base font-semibold text-slate-100">
                  {activePr.title}
                </h1>
              </div>

              {/* Clean unboxed metadata with typographic separators */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                <span>{activePr.author}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <GitBranch className="w-3 h-3 text-slate-400" />
                  {activePr.sourceBranch} → {activePr.targetBranch}
                </span>
                <span aria-hidden="true">·</span>
                <span>commit {activePr.commitHash}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 tabular-nums">+{activePr.additions}</span>
                <span className="text-rose-400 tabular-nums">-{activePr.deletions}</span>
                {analysisResult && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {analysisResult.executionTimeMs}ms
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500">
                      sha256:{analysisResult.cacheKey.slice(0, 10)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => triggerAnalysis(activePr, appliedPatches, true)}
                className="px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-slate-200 bg-[#090D16] border border-[#1E293B] rounded transition-colors whitespace-nowrap"
                title="Force fresh subagent execution bypassing SHA-256 cache"
              >
                Force Re-Run (Bypass Cache)
              </button>
            </div>
          </div>
        </section>

        {/* Main Workspace Body */}
        {isAnalyzing ? (
          <LoadingSkeletonHud stage={loadingStage} perspective={perspective} />
        ) : perspective === 'developer' ? (
          /* PILLAR 1: "Blindspot" — The Code Review Coach */
          <div className="space-y-5">
            <PolicyRulesetDrawer
              rules={policyRules}
              isOpen={isPolicyDrawerOpen}
              onToggleOpen={() => setIsPolicyDrawerOpen((prev) => !prev)}
              onToggleRule={handleToggleRule}
              reviewerApprovals={reviewerApprovals}
              onChangeApprovals={setReviewerApprovals}
              findings={findings}
              activeFindingsCount={activeFindingsCount}
            />

            <DiffCoachView
              pr={activePr}
              findings={findings}
              activeRules={policyRules}
              appliedPatches={appliedPatches}
              onApplyPatch={handleApplyPatch}
              onRevertPatch={handleRevertPatch}
              onReanalyzeWithPatches={() =>
                triggerAnalysis(activePr, appliedPatches, false)
              }
              reviewerApprovals={reviewerApprovals}
              isAnalyzing={isAnalyzing}
            />
          </div>
        ) : (
          /* PILLAR 2: Automated "Blast Radius" Analyzer */
          <BlastRadiusHud
            blastRadius={blastRadius}
            riskScore={riskScore}
            releaseNotes={releaseNotes}
          />
        )}
      </main>

      {/* Custom Unified Diff Inspector Modal */}
      <CustomDiffModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onRunCustomDiff={handleRunCustomDiff}
      />
    </div>
  );
}
