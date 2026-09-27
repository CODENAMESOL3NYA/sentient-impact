import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Wrench,
  RotateCcw,
  FileCode2,
  BookOpen,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import type { CoachFinding, DiffLine, PullRequest, SeverityLevel } from '../types/sentinal';
import type { PolicyRule } from '../services/sentinelApi';

interface DiffCoachViewProps {
  pr: PullRequest;
  findings: CoachFinding[];
  activeRules: PolicyRule[];
  appliedPatches: Record<string, string>;
  onApplyPatch: (finding: CoachFinding) => void;
  onRevertPatch: (findingId: string) => void;
  onReanalyzeWithPatches: () => void;
  reviewerApprovals: number;
  isAnalyzing: boolean;
}

function getSeverityAccent(severity: SeverityLevel) {
  switch (severity) {
    case 'critical':
      return {
        border: 'border-rose-500/50',
        bg: 'bg-rose-950/25',
        text: 'text-rose-400',
        label: 'CRITICAL',
      };
    case 'high':
      return {
        border: 'border-amber-500/50',
        bg: 'bg-amber-950/25',
        text: 'text-amber-400',
        label: 'HIGH',
      };
    case 'medium':
      return {
        border: 'border-sky-500/50',
        bg: 'bg-sky-950/25',
        text: 'text-sky-400',
        label: 'MEDIUM',
      };
    default:
      return {
        border: 'border-slate-600/50',
        bg: 'bg-slate-900/40',
        text: 'text-slate-300',
        label: severity.toUpperCase(),
      };
  }
}

export const DiffCoachView: React.FC<DiffCoachViewProps> = ({
  pr,
  findings,
  activeRules,
  appliedPatches,
  onApplyPatch,
  onRevertPatch,
  onReanalyzeWithPatches,
  reviewerApprovals,
  isAnalyzing,
}) => {
  const [selectedFileFilter, setSelectedFileFilter] = useState<string>('ALL');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedFixId, setCopiedFixId] = useState<string | null>(null);

  // Determine which categories are enforced by the Lead Policy Ruleset
  const enforcedCategories = new Set(
    activeRules.filter((r) => r.enabled).flatMap((r) => r.enforcedCategories)
  );
  const govRuleEnabled = activeRules.find((r) => r.isGovernanceRule)?.enabled ?? false;

  // Filter findings by active policy rules
  const policyFilteredFindings = findings.filter((f) => enforcedCategories.has(f.category));
  const unresolvedFindings = policyFilteredFindings.filter((f) => !appliedPatches[f.id]);
  const patchedCount = Object.keys(appliedPatches).length;

  const isMergeGateBlocked =
    unresolvedFindings.some((f) => f.severity === 'critical' || f.severity === 'high') ||
    (govRuleEnabled && reviewerApprovals < 2);

  // Build Reviewer PR Summary Markdown
  const generateReviewerSummary = () => {
    const statusLine = isMergeGateBlocked
      ? 'BLOCKED — Requires policy remediation or reviewer sign-off before staging merge'
      : 'APPROVED FOR STAGING — All active Lead Policy gates satisfied';

    const findingBullets =
      policyFilteredFindings.length === 0
        ? '- Zero policy violations flagged under active ruleset.'
        : policyFilteredFindings
            .map((f) => {
              const isPatched = Boolean(appliedPatches[f.id]);
              return `- [${isPatched ? 'PATCHED' : f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.title} (${f.ruleViolated})`;
            })
            .join('\n');

    return [
      `### Blindspot PR Review Summary — #${pr.number} ${pr.title}`,
      `**Author:** ${pr.author} · **Branch:** \`${pr.sourceBranch}\` → \`${pr.targetBranch}\` · **Commit:** \`${pr.commitHash}\``,
      `**Staging Merge Gate:** ${statusLine}`,
      `**Reviewer Sign-Offs:** ${reviewerApprovals}/2 required approvals · **Inline Patches Applied:** ${patchedCount}/${policyFilteredFindings.length}`,
      '',
      '#### Active Policy Findings',
      findingBullets,
    ].join('\n');
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(generateReviewerSummary());
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 1800);
  };

  const handleCopySnippet = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFixId(id);
    setTimeout(() => setCopiedFixId(null), 1500);
  };

  const visibleFiles =
    selectedFileFilter === 'ALL'
      ? pr.files
      : pr.files.filter((f) => f.filename === selectedFileFilter);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left 8 Columns: Unified Git Diff + Line-Anchored Coaching Cards */}
      <div className="xl:col-span-8 space-y-4">
        {/* File Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0D131F] border border-[#1E293B] rounded-lg">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedFileFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                selectedFileFilter === 'ALL'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Files ({pr.files.length})
            </button>
            {pr.files.map((file) => {
              const fileFindingsCount = policyFilteredFindings.filter(
                (f) => f.file === file.filename
              ).length;
              return (
                <button
                  key={file.filename}
                  type="button"
                  onClick={() => setSelectedFileFilter(file.filename)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                    selectedFileFilter === file.filename
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[200px]">{file.filename.split('/').pop()}</span>
                  {fileFindingsCount > 0 && (
                    <span className="text-rose-400 tabular-nums">({fileFindingsCount})</span>
                  )}
                </button>
              );
            })}
          </div>

          {patchedCount > 0 && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={onReanalyzeWithPatches}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>Re-Verify Patched Diff ({patchedCount})</span>
            </button>
          )}
        </div>

        {/* File Diff Blocks */}
        {visibleFiles.map((file) => {
          const fileFindings = policyFilteredFindings.filter((f) => f.file === file.filename);

          return (
            <div
              key={file.filename}
              className="border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden"
            >
              {/* File Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#090D16] border-b border-[#1E293B] font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <FileCode2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{file.filename}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-emerald-400">+{file.additions}</span>
                  <span className="text-rose-400">-{file.deletions}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">
                    {fileFindings.length} {fileFindings.length === 1 ? 'coaching note' : 'coaching notes'}
                  </span>
                </div>
              </div>

              {/* Diff Lines & Line-Anchored Inline Coaching Cards */}
              <div className="divide-y divide-[#1E293B]/40 font-mono text-xs">
                {file.diffLines.map((line: DiffLine, idx: number) => {
                  // Match a finding anchored at this exact line (avoid rendering duplicate cards for multi-line spans)
                  const anchoredFinding = fileFindings.find(
                    (f) =>
                      (line.newLineNumber !== undefined && f.line === line.newLineNumber) ||
                      (line.findingId &&
                        f.id === line.findingId &&
                        file.diffLines.findIndex((dl) => dl.findingId === line.findingId) === idx)
                  );

                  const isPatchedLine =
                    line.findingId !== undefined && Boolean(appliedPatches[line.findingId]);

                  let rowBg = 'bg-[#090D16] text-slate-300';
                  if (line.type === 'header') {
                    rowBg = 'bg-[#111927] text-sky-300/90';
                  } else if (isPatchedLine) {
                    rowBg = 'bg-emerald-950/35 text-emerald-200';
                  } else if (line.type === 'addition') {
                    rowBg = line.hasFinding
                      ? 'bg-rose-950/30 text-rose-100'
                      : 'bg-emerald-950/20 text-emerald-200';
                  } else if (line.type === 'deletion') {
                    rowBg = 'bg-rose-950/20 text-rose-300/80';
                  }

                  return (
                    <React.Fragment key={`${file.filename}-${idx}`}>
                      <div className={`flex items-stretch ${rowBg} hover:brightness-110`}>
                        {/* Old Line Number */}
                        <span className="w-11 px-2 py-1 text-right text-slate-500 select-none border-r border-[#1E293B]/60 tabular-nums shrink-0">
                          {line.oldLineNumber ?? ''}
                        </span>
                        {/* New Line Number */}
                        <span className="w-11 px-2 py-1 text-right text-slate-500 select-none border-r border-[#1E293B]/60 tabular-nums shrink-0">
                          {line.newLineNumber ?? ''}
                        </span>
                        {/* Code Content */}
                        <pre className="px-3 py-1 overflow-x-auto whitespace-pre flex-1 leading-relaxed">
                          {isPatchedLine && anchoredFinding
                            ? `+ ${appliedPatches[anchoredFinding.id]} // [PATCH APPLIED]`
                            : line.content}
                        </pre>
                      </div>

                      {/* Line-Anchored Inline Coaching Card */}
                      {anchoredFinding && (
                        <div className="p-4 bg-[#0D131F] border-y border-[#1E293B]">
                          <div
                            className={`p-4 rounded-lg border ${
                              appliedPatches[anchoredFinding.id]
                                ? 'border-emerald-500/40 bg-emerald-950/15'
                                : `${getSeverityAccent(anchoredFinding.severity).border} ${
                                    getSeverityAccent(anchoredFinding.severity).bg
                                  }`
                            }`}
                          >
                            {/* Finding Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 text-xs">
                                <AlertTriangle
                                  className={`w-4 h-4 shrink-0 ${
                                    appliedPatches[anchoredFinding.id]
                                      ? 'text-emerald-400'
                                      : getSeverityAccent(anchoredFinding.severity).text
                                  }`}
                                />
                                <span
                                  className={`font-mono font-semibold ${
                                    appliedPatches[anchoredFinding.id]
                                      ? 'text-emerald-400'
                                      : getSeverityAccent(anchoredFinding.severity).text
                                  }`}
                                >
                                  {appliedPatches[anchoredFinding.id]
                                    ? 'PATCHED IN WORKING TREE'
                                    : getSeverityAccent(anchoredFinding.severity).label}
                                </span>
                                <span className="text-slate-500">·</span>
                                <span className="font-mono text-slate-300">
                                  Line {anchoredFinding.line}
                                </span>
                                <span className="text-slate-500">·</span>
                                <span className="font-mono text-sky-300">
                                  {anchoredFinding.ruleViolated}
                                </span>
                              </div>
                            </div>

                            {/* Defect Title & Description */}
                            <h4 className="text-sm font-sans font-semibold text-slate-100 mb-1">
                              {anchoredFinding.title}
                            </h4>
                            <p className="text-xs font-sans text-slate-300 leading-relaxed mb-3">
                              {anchoredFinding.description}
                            </p>

                            {/* Educational WHY Callout */}
                            <div className="p-3 rounded bg-[#090D16]/90 border border-[#1E293B] mb-3 font-sans">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300 mb-1">
                                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                                <span>Why This Matters (Engineering Standard & OWASP Rationale)</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {anchoredFinding.educationalRationale}
                              </p>
                            </div>

                            {/* Suggested Fix + 1-Click Apply Patch */}
                            {anchoredFinding.suggestedFix && (
                              <div className="rounded bg-[#090D16] border border-[#1E293B] overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-[#111827] border-b border-[#1E293B]">
                                  <span className="text-[11px] font-sans font-medium text-slate-300">
                                    Recommended Drop-In Fix
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopySnippet(
                                          anchoredFinding.id,
                                          anchoredFinding.suggestedFix!
                                        )
                                      }
                                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-sans text-slate-300 hover:text-white bg-[#090D16] border border-[#1E293B] rounded transition-colors"
                                    >
                                      {copiedFixId === anchoredFinding.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span>Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy Snippet</span>
                                        </>
                                      )}
                                    </button>

                                    {appliedPatches[anchoredFinding.id] ? (
                                      <button
                                        type="button"
                                        onClick={() => onRevertPatch(anchoredFinding.id)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-sans font-medium text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded transition-colors"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Revert Patch</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onApplyPatch(anchoredFinding)}
                                        className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-sans font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors"
                                      >
                                        <Wrench className="w-3 h-3" />
                                        <span>1-Click Apply Patch</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                                  {anchoredFinding.suggestedFix}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Fallback Findings List if a custom diff has findings not matching seeded file names */}
        {policyFilteredFindings.filter(
          (f) => !pr.files.some((file) => file.filename === f.file)
        ).length > 0 && (
          <div className="border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200">
              Custom Diff Coaching Findings
            </h3>
            {policyFilteredFindings
              .filter((f) => !pr.files.some((file) => file.filename === f.file))
              .map((finding) => (
                <div
                  key={finding.id}
                  className="p-4 rounded border border-rose-500/40 bg-[#090D16] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-rose-400 font-semibold">
                      {finding.severity.toUpperCase()} · {finding.file}:{finding.line}
                    </span>
                    <span className="text-sky-400">{finding.ruleViolated}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{finding.title}</div>
                  <p className="text-xs text-slate-300">{finding.description}</p>
                  <div className="p-2.5 rounded bg-[#0D131F] border border-[#1E293B] text-xs text-slate-300">
                    <strong className="text-sky-300">Why: </strong>
                    {finding.educationalRationale}
                  </div>
                  {finding.suggestedFix && (
                    <pre className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/30 text-xs font-mono text-emerald-300 overflow-x-auto">
                      {finding.suggestedFix}
                    </pre>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Right 4 Columns: PR Summary Generator & Staging Gatekeeper */}
      <aside className="xl:col-span-4 space-y-4 sticky top-4">
        <div className="border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[#090D16] border-b border-[#1E293B] flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-100">
              Staging Merge Gatekeeper
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                isMergeGateBlocked ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {isMergeGateBlocked ? 'GATE BLOCKED' : 'READY TO MERGE'}
            </span>
          </div>

          <div className="p-4 space-y-4">
            {/* Gate Status Callout */}
            <div
              className={`p-3 rounded border ${
                isMergeGateBlocked
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {isMergeGateBlocked ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs leading-relaxed">
                  {isMergeGateBlocked ? (
                    <>
                      Staging merge is blocked. Resolve{' '}
                      <strong className="font-mono tabular-nums">
                        {unresolvedFindings.length}
                      </strong>{' '}
                      active policy {unresolvedFindings.length === 1 ? 'finding' : 'findings'}{' '}
                      {govRuleEnabled && reviewerApprovals < 2
                        ? `and obtain ${2 - reviewerApprovals} more peer approval(s).`
                        : 'using 1-Click Apply Patch.'}
                    </>
                  ) : (
                    <>
                      All active company policy checks and peer approval requirements are met.
                      Ready to merge into <code className="font-mono">{pr.targetBranch}</code>.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2.5 bg-[#090D16] border border-[#1E293B] rounded">
                <div className="text-lg font-semibold text-slate-100 tabular-nums">
                  {unresolvedFindings.length}
                </div>
                <div className="text-[11px] font-sans text-slate-400">Open Flags</div>
              </div>
              <div className="p-2.5 bg-[#090D16] border border-[#1E293B] rounded">
                <div className="text-lg font-semibold text-emerald-400 tabular-nums">
                  {patchedCount}
                </div>
                <div className="text-[11px] font-sans text-slate-400">Patched</div>
              </div>
              <div className="p-2.5 bg-[#090D16] border border-[#1E293B] rounded">
                <div className="text-lg font-semibold text-sky-400 tabular-nums">
                  {reviewerApprovals}/2
                </div>
                <div className="text-[11px] font-sans text-slate-400">Approvals</div>
              </div>
            </div>

            {/* Auto-Generated PR Review Summary */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-200">
                  Auto-Generated Reviewer Summary
                </span>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-white bg-[#131C2E] border border-[#1E293B] rounded transition-colors"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied Markdown</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Summary</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded bg-[#090D16] border border-[#1E293B] text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {generateReviewerSummary()}
              </pre>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
