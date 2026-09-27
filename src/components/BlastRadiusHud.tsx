import { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  Check,
  Copy,
  Download,
  GitFork,
  Layers,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import type {
  DependencyNode,
  ReleaseNotes,
  RiskScoreBreakdown,
  SeverityLevel,
} from '../types/sentinal';
import type { BlastRadiusGraphPayload } from '../../server/adapters/agentAdapters';

interface BlastRadiusHudProps {
  blastRadius: BlastRadiusGraphPayload;
  riskScore: RiskScoreBreakdown;
  releaseNotes: ReleaseNotes;
}

function getTierBadgeStyle(tier: RiskScoreBreakdown['riskTier']) {
  switch (tier) {
    case 'CRITICAL':
      return 'text-rose-400 border-rose-500/50 bg-rose-950/30';
    case 'HIGH':
      return 'text-amber-400 border-amber-500/50 bg-amber-950/30';
    case 'MODERATE':
      return 'text-yellow-300 border-yellow-500/40 bg-yellow-950/25';
    default:
      return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/25';
  }
}

function getNodeStroke(risk: SeverityLevel): string {
  switch (risk) {
    case 'critical':
      return '#F43F5E';
    case 'high':
      return '#F59E0B';
    case 'medium':
      return '#EAB308';
    default:
      return '#38BDF8';
  }
}

const TIER_LABELS: Record<number, string> = {
  0: 'Tier 0 · Modified Files',
  1: 'Tier 1 · Direct Consumers',
  2: 'Tier 2 · API & Services',
  3: 'Tier 3 · Data Models',
};

export function BlastRadiusHud({
  blastRadius,
  riskScore,
  releaseNotes,
}: BlastRadiusHudProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    blastRadius.nodes[0]?.id ?? null
  );
  const [qaState, setQaState] = useState<Record<string, boolean>>({});
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedTestIdx, setCopiedTestIdx] = useState<number | null>(null);

  // Deterministic SVG coordinates based on node tier
  const positionedGraph = useMemo(() => {
    const tiers = [0, 1, 2, 3];
    const coords = new Map<string, { x: number; y: number; node: DependencyNode }>();

    tiers.forEach((tier) => {
      const group = blastRadius.nodes.filter((n) => n.tier === tier);
      const x = 115 + tier * 215;
      group.forEach((node, index) => {
        const total = group.length;
        const spacing = 260 / (total + 1);
        const y = Math.round(spacing * (index + 1));
        coords.set(node.id, { x, y, node });
      });
    });

    return coords;
  }, [blastRadius.nodes]);

  const selectedNode =
    blastRadius.nodes.find((n) => n.id === selectedNodeId) ??
    blastRadius.nodes[0] ??
    null;

  const buildReleaseMarkdown = () => {
    const lines = [
      `# ${releaseNotes.title}`,
      `**Target Version:** \`${releaseNotes.versionTarget}\` · **Composite Risk Score:** \`${riskScore.overallScore}/100 (${riskScore.riskTier})\``,
      '',
      `## Executive Summary`,
      releaseNotes.executiveSummary,
      '',
      `## Breaking Changes`,
      ...(releaseNotes.breakingChanges.length > 0
        ? releaseNotes.breakingChanges.map((b) => `- ⚠️ ${b}`)
        : ['- None identified']),
      '',
      `## Downstream Squads to Alert`,
      ...(releaseNotes.downstreamServicesToAlert.length > 0
        ? releaseNotes.downstreamServicesToAlert.map((s) => `- 📣 ${s}`)
        : ['- No external squad coordination required']),
      '',
      `## Pre-Production QA Checklist`,
      ...releaseNotes.qaChecklist.map((item) => {
        const checked = qaState[item.id] ?? item.checked;
        return `- [${checked ? 'x' : ' '}] ${item.item}`;
      }),
      '',
      `## Automated Rollback Runbook`,
      ...releaseNotes.rollbackPlan.map((step) => `- ${step}`),
    ];
    return lines.join('\n');
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(buildReleaseMarkdown());
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([buildReleaseMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `release-gate-${releaseNotes.versionTarget || 'brief'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const factors = [
    {
      label: 'Breaking API Surface',
      score: riskScore.factors.breakingApiSurface,
      max: 35,
      barColor: 'bg-rose-500',
    },
    {
      label: 'Downstream Fanout',
      score: riskScore.factors.downstreamFanout,
      max: 25,
      barColor: 'bg-amber-500',
    },
    {
      label: 'Security Criticality',
      score: riskScore.factors.securityCriticality,
      max: 25,
      barColor: 'bg-sky-400',
    },
    {
      label: 'Test Coverage Delta',
      score: riskScore.factors.testCoverageDelta,
      max: 15,
      barColor: 'bg-indigo-400',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Row: Deployment Risk Index (4 cols) + Interactive Downstream Topology Graph (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Deployment Risk Index Widget */}
        <div className="lg:col-span-4 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Deployment Risk Index
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded border font-mono text-xs font-bold ${getTierBadgeStyle(
                  riskScore.riskTier
                )}`}
              >
                {riskScore.riskTier}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-mono text-4xl font-bold text-slate-100 tabular-nums">
                {riskScore.overallScore}
              </span>
              <span className="font-mono text-sm text-slate-400">/ 100</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {riskScore.summary}
            </p>
          </div>

          {/* 4-Factor Deterministic Breakdown */}
          <div className="space-y-2.5 pt-3 border-t border-[#1E293B]">
            {factors.map((f) => {
              const pct = Math.min(100, Math.round((f.score / f.max) * 100));
              return (
                <div key={f.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">{f.label}</span>
                    <span className="text-slate-200 tabular-nums">
                      {f.score} / {f.max}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#090D16] rounded-full overflow-hidden border border-[#1E293B]">
                    <div
                      className={`h-full ${f.barColor} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Downstream Topology Graph (Interactive SVG DAG) */}
        <div className="lg:col-span-8 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Downstream Topology Graph
              </span>
              <span className="text-xs font-mono text-slate-400">
                · {blastRadius.nodes.length} Nodes · {blastRadius.edges.length} Edges
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                Breaking Contract Edge
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-500 inline-block" />
                Standard Call Edge
              </span>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <div className="w-full overflow-x-auto bg-[#090D16] border border-[#1E293B] rounded-md">
            <svg
              viewBox="0 0 880 265"
              className="w-full min-w-[680px] h-[250px] select-none"
            >
              <defs>
                <marker
                  id="arrow-breaking"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,1 L7,4 L0,7 Z" fill="#F43F5E" />
                </marker>
                <marker
                  id="arrow-normal"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,1 L7,4 L0,7 Z" fill="#475569" />
                </marker>
              </defs>

              {/* Tier Column Headers */}
              {[0, 1, 2, 3].map((tier) => (
                <g key={tier}>
                  <text
                    x={115 + tier * 215}
                    y={20}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {TIER_LABELS[tier]}
                  </text>
                  <line
                    x1={115 + tier * 215}
                    y1={28}
                    x2={115 + tier * 215}
                    y2={250}
                    stroke="#1E293B"
                    strokeDasharray="3 3"
                  />
                </g>
              ))}

              {/* Directed Edges */}
              {blastRadius.edges.map((edge, idx) => {
                const sourcePos = positionedGraph.get(edge.source);
                const targetPos = positionedGraph.get(edge.target);
                if (!sourcePos || !targetPos) return null;

                const x1 = sourcePos.x + 68;
                const y1 = sourcePos.y;
                const x2 = targetPos.x - 68;
                const y2 = targetPos.y;
                const midX = (x1 + x2) / 2;

                return (
                  <g key={idx}>
                    <path
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={edge.isBreakingChange ? '#F43F5E' : '#475569'}
                      strokeWidth={edge.isBreakingChange ? 2 : 1.5}
                      strokeDasharray={edge.isBreakingChange ? 'none' : '4 3'}
                      markerEnd={
                        edge.isBreakingChange
                          ? 'url(#arrow-breaking)'
                          : 'url(#arrow-normal)'
                      }
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {Array.from(positionedGraph.values()).map(({ x, y, node }) => {
                const isSelected = selectedNode?.id === node.id;
                const strokeColor = getNodeStroke(node.risk);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x - 66}, ${y - 20})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      width="132"
                      height="40"
                      rx="6"
                      fill={isSelected ? '#131C2E' : '#0D131F'}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? '2' : '1.2'}
                    />
                    <text
                      x="10"
                      y="17"
                      fill="#F1F5F9"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {node.label.length > 16
                        ? `${node.label.slice(0, 15)}…`
                        : node.label}
                    </text>
                    <text
                      x="10"
                      y="31"
                      fill="#94A3B8"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      fanout:{node.fanoutCount} · {node.risk.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected Node Inspector Bar */}
          {selectedNode && (
            <div className="px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sky-400">
                  {selectedNode.label}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">{selectedNode.description}</span>
              </div>
              <span className="font-mono text-slate-400 tabular-nums">
                Downstream Fanout: {selectedNode.fanoutCount} caller(s)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Impacted Component Matrix (6 cols) + Release Readiness & Rollback Brief (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Impacted Downstream Components & Regression Commands */}
        <div className="lg:col-span-6 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Impacted Downstream Services & Contracts
              </h3>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {blastRadius.table.length} affected
            </span>
          </div>

          <div className="space-y-2.5">
            {blastRadius.table.map((row, idx) => (
              <div
                key={idx}
                className="p-3 rounded-md bg-[#090D16] border border-[#1E293B] space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-100">
                    {row.dependentComponent}
                  </span>
                  <span className="font-mono text-[11px] text-amber-300">
                    {row.impactType} · {row.affectedCallers} callers
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1E293B]/70">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300 truncate">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{row.recommendedTest}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(row.recommendedTest);
                      setCopiedTestIdx(idx);
                      setTimeout(() => setCopiedTestIdx(null), 1500);
                    }}
                    className="px-2 py-0.5 rounded border border-[#1E293B] bg-[#0D131F] text-[11px] font-mono text-slate-300 hover:text-white shrink-0 cursor-pointer"
                  >
                    {copiedTestIdx === idx ? 'Copied' : 'Copy Cmd'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* One-Click Exportable Release Readiness & Rollback Brief */}
        <div className="lg:col-span-6 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono text-[11px] text-sky-400 font-semibold">
                {releaseNotes.versionTarget}
              </span>
              <h3 className="text-sm font-semibold text-slate-100">
                {releaseNotes.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-[#1E293B] bg-[#090D16] text-slate-200 hover:border-sky-500/50 cursor-pointer"
              >
                {copiedMarkdown ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied MD</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-sky-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {releaseNotes.executiveSummary}
          </p>

          {/* Breaking Changes & Downstream Squad Alerts */}
          {releaseNotes.breakingChanges.length > 0 && (
            <div className="p-3 rounded-md bg-rose-950/20 border border-rose-500/40 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Breaking API / Contract Mutations</span>
              </div>
              <ul className="list-disc list-inside text-xs text-rose-200/90 space-y-1">
                {releaseNotes.breakingChanges.map((bc, i) => (
                  <li key={i}>{bc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Interactive QA Verification Checklist */}
          {releaseNotes.qaChecklist.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pre-Release QA Verification Gate
              </div>
              <div className="space-y-1.5">
                {releaseNotes.qaChecklist.map((item) => {
                  const isChecked = qaState[item.id] ?? item.checked;
                  return (
                    <label
                      key={item.id}
                      className="flex items-start gap-2.5 p-2 rounded bg-[#090D16] border border-[#1E293B] text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setQaState((prev) => ({ ...prev, [item.id]: !isChecked }))
                        }
                        className="mt-0.5 accent-sky-400 rounded cursor-pointer"
                      />
                      <span
                        className={
                          isChecked ? 'line-through text-slate-500' : 'text-slate-200'
                        }
                      >
                        {item.item}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Automated Rollback Runbook */}
          {releaseNotes.rollbackPlan.length > 0 && (
            <div className="p-3 rounded-md bg-[#090D16] border border-[#1E293B] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Automated Rollback Runbook</span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                {releaseNotes.rollbackPlan.map((step, i) => (
                  <div key={i}>{step}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
