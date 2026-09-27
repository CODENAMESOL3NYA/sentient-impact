import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  FileCode2,
  Sparkles,
  Undo2,
  Wrench,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import type { CoachFinding, PullRequest, SeverityLevel } from '../types/sentinal';
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
        border: 'border-yellow-500/40',
        bg: 'bg-yellow-950/20',
        text: 'text-yellow-300',
        label: 'MEDIUM',
      };
    default:
      return {
        border: 'border-sky-500/40',
        bg: 'bg-sky-950/20',
        text: 'text-sky-400',
        label: 'LOW',
      };
  }
}

export function DiffCoachView({
  pr,
  findings,
  activeRules,
  appliedPatches,
  onApplyPatch,
  onRevertPatch,
  onReanalyzeWithPatches,
  reviewerApprovals,
  isAnalyzing,
}: DiffCoachViewProps) {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedFixId, setCopiedFixId] = useState<string | null>(null);

  const enforcedCategories = new Set(
    activeRules.filter((r) => r.enabled).flatMap((r) => r.enforcedCategories)
  );

  // Filter findings according to active Lead Policy Rules
  const visibleFindings = findings.filter((f) => enforcedCategories.has(f.category));
  const unresolvedFindings = visibleFindings.filter((f) => !appliedPatches[f.id]);

  const approvalRule = activeRules.find((r) => r.requiresMinApprovals);
  const minApprovals = approvalRule?.enabled ? approvalRule.requiresMinApprovals ?? 2 : 0;
  const approvalsMet = reviewerApprovals >= minApprovals;
  const canMergeToStaging = approvalsMet && unresolvedFindings.length === 0;

  // Build PR Summary Markdown for Pillar 1
  const buildPrSummaryMarkdown = () => {
    const statusLine = canMergeToStaging
      ? '✅ READY FOR STAGING MERGE'
      : '⛔ BLOCKED BY SENTINEL POLICY GATE';
    const patchedCount = Object.keys(appliedPatches).length;

    const lines = [
      `### Impact Sentinel — PR #${pr.number} Review Summary`,
      `**Status:** ${statusLine}`,
      `**Branch:** \`${pr.sourceBranch}\` → \`${pr.targetBranch}\` (\`${pr.commitHash}\`)`,
      `**Peer Approvals:** ${reviewerApprovals}/${minApprovals || 2} · **Active Findings:** ${unresolvedFindings.length} (${patchedCount} patched)`,
      '',
      unresolvedFindings.length > 0
        ? '**Open Coaching Items:**\n' +
          unresolvedFindings
            .map(
              (f) =>
                `- **[${f.severity.toUpperCase()}]** \`${f.file}:${f.line}\` — ${f.title} (_${f.ruleViolated}_)`
            )
            .join('\n')
        : '_All enforced Lead Policy Ruleset checks and code coaching items are resolved._',
    ];
    return lines.join('\n');
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(buildPrSummaryMarkdown());
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyFix = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFixId(id);
    setTimeout(() => setCopiedFixId(null), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left 8 Columns: Line-Anchored Git Diff + Inline "Blindspot" Coaching Cards */}
      <div className="lg:col-span-8 space-y-4">
        {pr.files.map((file) => {
          const fileFindings = visibleFindings.filter((f) => f.file === file.filename);
          const renderedFindingIds = new Set<string>();

          return (
            <div
              key={file.filename}
              className="border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden"
            >
              {/* File Diff Header */}
              <div className="px-4 py-2.5 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                  <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-semibold">{file.filename}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                  <span className="text-emerald-400">+{file.additions}</span>
                  <span className="text-rose-400">-{file.deletions}</span>
                  {fileFindings.length > 0 && (
                    <span className="text-amber-300">
                      · {fileFindings.length} coaching note{fileFindings.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Monospace Diff Table */}
              <div className="divide-y divide-[#1E293B]/40 font-mono text-xs">
                {file.diffLines.map((line, idx) => {
                  // Match finding anchored on this line
                  const anchoredFinding = fileFindings.find(
                    (f) =>
                      !renderedFindingIds.has(f.id) &&
                      ((line.findingId && line.findingId === f.id) ||
                        (line.newLineNumber !== undefined && line.newLineNumber === f.line))
                  );

                  if (anchoredFinding) {
                    renderedFindingIds.add(anchoredFinding.id);
                  }

                  const isPatchedLine =
                    line.findingId && Boolean(appliedPatches[line.findingId]);

                  let rowBg = 'bg-[#090D16]';
                  let textColor = 'text-slate-300';

                  if (line.type === 'header') {
                    rowBg = 'bg-sky-950/20';
                    textColor = 'text-sky-300';
                  } else if (isPatchedLine) {
                    rowBg = 'bg-emerald-950/30';
                    textColor = 'text-emerald-200';
                  } else if (line.type === 'addition') {
                    rowBg = line.hasFinding
                      ? 'bg-amber-950/25'
                      : 'bg-emerald-950/15';
                    textColor = 'text-slate-100';
                  } else if (line.type === 'deletion') {
                    rowBg = 'bg-rose-950/20';
                    textColor = 'text-rose-300/90';
                  }

                  return (
                    <div key={idx}>
                      {/* Diff Line */}
                      <div className={`flex items-stretch ${rowBg} hover:bg-slate-800/30`}>
                        <span className="w-10 px-2 py-1 text-right text-slate-600 select-none border-r border-[#1E293B]/60 shrink-0 tabular-nums">
                          {line.oldLineNumber ?? ''}
                        </span>
                        <span className="w-10 px-2 py-1 text-right text-slate-600 select-none border-r border-[#1E293B]/60 shrink-0 tabular-nums">
                          {line.newLineNumber ?? ''}
                        </span>
                        <pre className={`px-3 py-1 flex-1 overflow-x-auto whitespace-pre-wrap break-all ${textColor}`}>
                          {isPatchedLine && line.findingId
                            ? `+ ${appliedPatches[line.findingId]}`
                            : line.content}
                        </pre>
                      </div>

                      {/* Line-Anchored Inline Coaching Card */}
                      {anchoredFinding && (
                        <div className="p-3.5 bg-[#0B111E] border-y border-[#1E293B]">
                          {(() => {
                            const sev = getSeverityAccent(anchoredFinding.severity);
                            const isPatched = Boolean(appliedPatches[anchoredFinding.id]);

                            return (
                              <div
                                className={`rounded-lg border ${
                                  isPatched
                                    ? 'border-emerald-500/40 bg-emerald-950/15'
                                    : `${sev.border} bg-[#0D131F]`
                                } p-4 space-y-3`}
                              >
                                {/* Top Meta Row */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs font-mono">
                                    <AlertTriangle className={`w-3.5 h-3.5 ${sev.text}`} />
                                    <span className={`font-bold ${sev.text}`}>
                                      {sev.label}
                                    </span>
                                    <span className="text-slate-500">·</span>
                                    <span className="text-slate-300">
                                      Line {anchoredFinding.line}
                                    </span>
                                    <span className="text-slate-500">·</span>
                                    <span className="text-sky-400">
                                      {anchoredFinding.ruleViolated}
                                    </span>
                                  </div>

                                  {isPatched && (
                                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Patch Staged in Diff
                                    </span>
                                  )}
                                </div>

                                {/* Defect Title & Description */}
                                <div className="space-y-1 font-sans">
                                  <h4 className="text-sm font-semibold text-slate-100">
                                    {anchoredFinding.title}
                                  </h4>
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {anchoredFinding.description}
                                  </p>
                                </div>

                                {/* Educational "WHY" Callout */}
                                <div className="p-3 rounded-md bg-[#090D16] border border-[#1E293B] font-sans space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Why This Matters (Engineering Standard & OWASP)</span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {anchoredFinding.educationalRationale}
                                  </p>
                                </div>

                                {/* Suggested Patch & 1-Click Action */}
                                {anchoredFinding.suggestedFix && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-mono text-slate-400">
                                        Recommended Drop-In Patch
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCopyFix(
                                              anchoredFinding.id,
                                              anchoredFinding.suggestedFix!
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono border border-[#1E293B] bg-[#090D16] text-slate-300 hover:text-white cursor-pointer"
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

                                        {isPatched ? (
                                          <button
                                            type="button"
                                            onClick={() => onRevertPatch(anchoredFinding.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                                          >
                                            <Undo2 className="w-3 h-3" />
                                            <span>Revert Patch</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => onApplyPatch(anchoredFinding)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer transition-colors"
                                          >
                                            <Wrench className="w-3 h-3" />
                                            <span>1-Click Apply Patch</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <pre className="p-3 rounded-md bg-[#090D16] border border-[#1E293B] text-emerald-300 font-mono text-xs overflow-x-auto">
                                      {anchoredFinding.suggestedFix}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right 4 Columns: Staging Merge Gatekeeper & PR Summary Generator */}
      <aside className="lg:col-span-4 space-y-4">
        {/* Gatekeeper Decision Card */}
        <div className="border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Staging Merge Gatekeeper
            </span>
            {canMergeToStaging ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                PASSING
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-rose-400">
                <ShieldAlert className="w-4 h-4" />
                BLOCKED
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs border-t border-[#1E293B] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Unresolved Coaching Flags</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  unresolvedFindings.length === 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {unresolvedFindings.length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Staged 1-Click Patches</span>
              <span className="font-mono font-semibold text-sky-400 tabular-nums">
                {Object.keys(appliedPatches).length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Peer Reviewer Approvals</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  approvalsMet ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {reviewerApprovals} / {minApprovals || 2} required
              </span>
            </div>
          </div>

          {Object.keys(appliedPatches).length > 0 && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={onReanalyzeWithPatches}
              className="w-full py-2 px-3 rounded-md bg-sky-500/20 border border-sky-500/50 text-sky-300 hover:bg-sky-500/30 font-mono text-xs font-semibold cursor-pointer transition-colors"
            >
              {isAnalyzing
                ? 'Re-running /api/analyze-pr...'
                : 'Re-Verify Patched Diff via /api/analyze-pr'}
            </button>
          )}
        </div>

        {/* PR Summary Generator Card */}
        <div className="border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                PR Summary Generator
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-[#1E293B] bg-[#090D16] text-slate-200 hover:border-sky-500/50 cursor-pointer"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Auto-generated pre-staging review brief for GitHub PR comment thread:
          </p>

          <pre className="p-3 rounded-md bg-[#090D16] border border-[#1E293B] text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {buildPrSummaryMarkdown()}
          </pre>
        </div>
      </aside>
    </div>
  );
}
