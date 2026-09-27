import React, { useState, useMemo } from 'react';
import {
  Activity,
  GitFork,
  FileSpreadsheet,
  Copy,
  Check,
  Download,
  Terminal,
  AlertOctagon,
  CheckSquare,
  Square,
  RotateCcw,
  BellRing,
} from 'lucide-react';
import type {
  DependencyNode,
  RiskScoreBreakdown,
  ReleaseNotes,
  SeverityLevel,
} from '../types/sentinal';
import type { BlastRadiusGraphPayload } from '../services/sentinelApi';

interface BlastRadiusHudProps {
  blastRadius: BlastRadiusGraphPayload;
  riskScore: RiskScoreBreakdown;
  releaseNotes: ReleaseNotes;
}

const TIER_LABELS: Record<number, string> = {
  0: 'Tier 0 · Modified Files',
  1: 'Tier 1 · Direct Consumers',
  2: 'Tier 2 · API & Services',
  3: 'Tier 3 · Data Models',
};

function getRiskColor(risk: SeverityLevel | RiskScoreBreakdown['riskTier']) {
  const normalized = risk.toLowerCase();
  if (normalized === 'critical') {
    return {
      stroke: '#F43F5E',
      fill: '#4C0519',
      text: 'text-rose-400',
      bar: 'bg-rose-500',
      border: 'border-rose-500/40',
    };
  }
  if (normalized === 'high') {
    return {
      stroke: '#F59E0B',
      fill: '#451A03',
      text: 'text-amber-400',
      bar: 'bg-amber-500',
      border: 'border-amber-500/40',
    };
  }
  if (normalized === 'moderate' || normalized === 'medium') {
    return {
      stroke: '#38BDF8',
      fill: '#082F49',
      text: 'text-sky-400',
      bar: 'bg-sky-400',
      border: 'border-sky-500/40',
    };
  }
  return {
    stroke: '#10B981',
    fill: '#064E3B',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    border: 'border-emerald-500/40',
  };
}

export const BlastRadiusHud: React.FC<BlastRadiusHudProps> = ({
  blastRadius,
  riskScore,
  releaseNotes,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    blastRadius.nodes[0]?.id ?? null
  );
  const [qaState, setQaState] = useState<Record<string, boolean>>({});
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Compute deterministic SVG coordinates for nodes grouped by tier (0..3)
  const layoutNodes = useMemo(() => {
    const tiers = [0, 1, 2, 3];
    const positioned: Array<DependencyNode & { cx: number; cy: number }> = [];
    const svgWidth = 860;
    const svgHeight = 320;
    const colPositions = [125, 345, 575, 760];

    tiers.forEach((tierIdx) => {
      const nodesInTier = blastRadius.nodes.filter((n) => n.tier === tierIdx);
      const count = nodesInTier.length;
      nodesInTier.forEach((node, idx) => {
        const spacing = svgHeight / (count + 1);
        positioned.push({
          ...node,
          cx: colPositions[tierIdx] ?? 400,
          cy: Math.round(spacing * (idx + 1)),
        });
      });
    });

    return positioned;
  }, [blastRadius.nodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, DependencyNode & { cx: number; cy: number }>();
    layoutNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [layoutNodes]);

  const selectedNode = useMemo(
    () => layoutNodes.find((n) => n.id === selectedNodeId) ?? layoutNodes[0] ?? null,
    [layoutNodes, selectedNodeId]
  );

  // Toggle QA checklist item state
  const isQaChecked = (id: string, defaultChecked: boolean) =>
    qaState[id] !== undefined ? qaState[id] : defaultChecked;

  const toggleQaItem = (id: string, defaultChecked: boolean) => {
    setQaState((prev) => ({
      ...prev,
      [id]: !isQaChecked(id, defaultChecked),
    }));
  };

  // Build Markdown export for Release Readiness & Rollback Brief
  const buildReleaseBriefMarkdown = () => {
    const breakingList =
      releaseNotes.breakingChanges.length > 0
        ? releaseNotes.breakingChanges.map((b) => `- ${b}`).join('\n')
        : '- Zero breaking changes detected.';

    const squadAlerts =
      releaseNotes.downstreamServicesToAlert.length > 0
        ? releaseNotes.downstreamServicesToAlert.map((s) => `- ${s}`).join('\n')
        : '- No downstream team alerts required.';

    const qaList =
      releaseNotes.qaChecklist.length > 0
        ? releaseNotes.qaChecklist
            .map((q) => `- [${isQaChecked(q.id, q.checked) ? 'x' : ' '}] ${q.item}`)
            .join('\n')
        : '- [x] Standard CI suite passed.';

    const rollbackList =
      releaseNotes.rollbackPlan.length > 0
        ? releaseNotes.rollbackPlan.map((r) => `- ${r}`).join('\n')
        : '- Standard git revert.';

    return [
      `# ${releaseNotes.title}`,
      `**Target Version:** \`${releaseNotes.versionTarget}\` · **Composite Risk Score:** \`${riskScore.overallScore}/100 (${riskScore.riskTier})\``,
      '',
      `## Executive Summary`,
      releaseNotes.executiveSummary,
      '',
      `## Breaking Changes`,
      breakingList,
      '',
      `## Downstream Squads to Alert`,
      squadAlerts,
      '',
      `## Pre-Production QA Checklist`,
      qaList,
      '',
      `## Automated Rollback Runbook`,
      rollbackList,
    ].join('\n');
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(buildReleaseBriefMarkdown());
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 1800);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([buildReleaseBriefMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `release-brief-${releaseNotes.versionTarget || 'pr'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyTestCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  const tierStyle = getRiskColor(riskScore.riskTier);

  const factorRows = [
    {
      label: 'Breaking API Surface',
      value: riskScore.factors.breakingApiSurface,
      max: 35,
    },
    {
      label: 'Downstream Service Fanout',
      value: riskScore.factors.downstreamFanout,
      max: 25,
    },
    {
      label: 'Security Criticality',
      value: riskScore.factors.securityCriticality,
      max: 25,
    },
    {
      label: 'Test Coverage Delta',
      value: riskScore.factors.testCoverageDelta,
      max: 15,
    },
  ];

  const breakingEdgesCount = blastRadius.edges.filter((e) => e.isBreakingChange).length;

  return (
    <div className="space-y-5">
      {/* Top Row: Deployment Risk Index HUD + Interactive Downstream Topology Graph */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Deployment Risk Index Widget (4 cols) */}
        <div className="xl:col-span-4 border border-[#1E293B] bg-[#0D131F] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-100">Deployment Risk Index</h3>
              </div>
              <span className={`font-mono text-xs font-semibold ${tierStyle.text}`}>
                {riskScore.riskTier} RISK
              </span>
            </div>

            {/* Score Display */}
            <div className="flex items-baseline justify-between p-4 rounded bg-[#090D16] border border-[#1E293B] mb-4">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Composite Blast Score</div>
                <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span className={`text-3xl font-bold ${tierStyle.text}`}>
                    {riskScore.overallScore}
                  </span>
                  <span className="text-sm text-slate-500">/ 100</span>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-slate-400 tabular-nums">
                <div>{blastRadius.nodes.length} mapped nodes</div>
                <div className="text-rose-400">{breakingEdgesCount} breaking edges</div>
              </div>
            </div>

            {/* 4 Weighted Risk Factor Bars */}
            <div className="space-y-3 mb-4">
              {factorRows.map((factor) => {
                const pct = Math.min(100, Math.round((factor.value / factor.max) * 100));
                return (
                  <div key={factor.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{factor.label}</span>
                      <span className="font-mono tabular-nums text-slate-200">
                        {factor.value} <span className="text-slate-500">/ {factor.max}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#090D16] rounded overflow-hidden border border-[#1E293B]">
                      <div
                        className={`h-full ${tierStyle.bar} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed p-3 rounded bg-[#090D16] border border-[#1E293B]">
            {riskScore.summary}
          </p>
        </div>

        {/* Downstream Topology DAG Graph (8 cols) */}
        <div className="xl:col-span-8 border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#090D16] border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Downstream Dependency Topology
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                <span>Breaking Contract</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-500 inline-block" />
                <span>Standard Call</span>
              </span>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <div className="relative bg-[#090D16] flex-1 min-h-[300px] overflow-x-auto">
            {layoutNodes.length === 0 ? (
              <div className="flex items-center justify-center h-72 text-xs text-slate-400">
                No downstream dependency graph nodes reported for this diff.
              </div>
            ) : (
              <svg
                viewBox="0 0 880 320"
                className="w-full h-full min-w-[680px] select-none"
                role="img"
                aria-label="Downstream Dependency Topology Graph"
              >
                {/* Tier Column Headers */}
                {[0, 1, 2, 3].map((tier) => {
                  const xPos = [125, 345, 575, 760][tier];
                  return (
                    <g key={tier}>
                      <line
                        x1={xPos}
                        y1={32}
                        x2={xPos}
                        y2={305}
                        stroke="#1E293B"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      <text
                        x={xPos}
                        y={20}
                        textAnchor="middle"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {TIER_LABELS[tier]}
                      </text>
                    </g>
                  );
                })}

                {/* Edges */}
                {blastRadius.edges.map((edge, idx) => {
                  const src = nodeMap.get(edge.source);
                  const tgt = nodeMap.get(edge.target);
                  if (!src || !tgt) return null;

                  const isConnectedToSelected =
                    selectedNode &&
                    (edge.source === selectedNode.id || edge.target === selectedNode.id);

                  const strokeColor = edge.isBreakingChange
                    ? '#F43F5E'
                    : isConnectedToSelected
                    ? '#38BDF8'
                    : '#475569';

                  const midX = (src.cx + tgt.cx) / 2;
                  const pathD = `M ${src.cx + 68} ${src.cy} C ${midX} ${src.cy}, ${midX} ${tgt.cy}, ${tgt.cx - 68} ${tgt.cy}`;

                  return (
                    <g key={`${edge.source}-${edge.target}-${idx}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isConnectedToSelected ? 2.2 : 1.5}
                        strokeDasharray={edge.isBreakingChange ? '5 4' : undefined}
                        opacity={
                          !selectedNode || isConnectedToSelected ? 0.95 : 0.35
                        }
                      />
                      <text
                        x={midX}
                        y={(src.cy + tgt.cy) / 2 - 5}
                        textAnchor="middle"
                        className="fill-slate-400 text-[9px] font-mono"
                      >
                        {edge.relation}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {layoutNodes.map((node) => {
                  const riskColors = getRiskColor(node.risk);
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.cx - 68}, ${node.cy - 22})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        width={136}
                        height={44}
                        rx={6}
                        fill={isSelected ? riskColors.fill : '#0D131F'}
                        stroke={isSelected ? '#38BDF8' : riskColors.stroke}
                        strokeWidth={isSelected ? 2 : 1.2}
                      />
                      <text
                        x={10}
                        y={18}
                        className="fill-slate-100 text-[11px] font-mono font-semibold"
                      >
                        {node.label.length > 16
                          ? `${node.label.slice(0, 15)}…`
                          : node.label}
                      </text>
                      <text
                        x={10}
                        y={34}
                        className="fill-slate-400 text-[9px] font-mono"
                      >
                        {node.risk.toUpperCase()} · fanout:{node.fanoutCount}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Selected Node Inspector Footer */}
          {selectedNode && (
            <div className="px-4 py-3 bg-[#0D131F] border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-semibold text-sky-400">
                  {selectedNode.label}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">{selectedNode.description}</span>
              </div>
              <div className="font-mono text-slate-400 tabular-nums">
                Tier {selectedNode.tier} · Fanout: {selectedNode.fanoutCount} callers · Risk:{' '}
                <span className={getRiskColor(selectedNode.risk).text}>
                  {selectedNode.risk.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Downstream Impact Table + Release Readiness & Rollback Brief */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Downstream Impact & Regression Test Table (7 cols) */}
        <div className="xl:col-span-7 border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[#090D16] border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Downstream Impact & Regression Verification Matrix
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {blastRadius.table.length} affected components
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#090D16]/50 text-slate-400 font-mono">
                  <th className="py-2.5 px-4 font-medium">Component</th>
                  <th className="py-2.5 px-3 font-medium">Impact Vector</th>
                  <th className="py-2.5 px-3 font-medium text-right">Callers</th>
                  <th className="py-2.5 px-4 font-medium">Recommended Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60">
                {blastRadius.table.map((row) => {
                  const sevStyle = getRiskColor(row.severity);
                  return (
                    <tr key={row.dependentComponent} className="hover:bg-[#111827]/60">
                      <td className="py-3 px-4 align-top">
                        <div className="font-mono text-slate-100 font-medium">
                          {row.dependentComponent}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.componentType} ·{' '}
                          <span className={`font-mono ${sevStyle.text}`}>
                            {row.severity.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top text-slate-300">
                        {row.impactType}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums text-slate-200">
                        {row.affectedCallers}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#090D16] border border-[#1E293B] font-mono text-[11px] text-emerald-300">
                          <span className="truncate">{row.recommendedTest}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyTestCmd(row.recommendedTest)}
                            className="text-slate-400 hover:text-white shrink-0"
                            title="Copy test command"
                          >
                            {copiedCmd === row.recommendedTest ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Release Readiness & Rollback Brief (5 cols) */}
        <div className="xl:col-span-5 border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[#090D16] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Release Readiness & Rollback Brief
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-white bg-[#131C2E] border border-[#1E293B] rounded transition-colors"
              >
                {copiedMarkdown ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy MD</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Release Header & Executive Summary */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-xs font-semibold text-slate-100">
                  {releaseNotes.title}
                </h4>
                <span className="font-mono text-xs text-sky-400">
                  {releaseNotes.versionTarget}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {releaseNotes.executiveSummary}
              </p>
            </div>

            {/* Breaking Changes */}
            {releaseNotes.breakingChanges.length > 0 && (
              <div className="p-3 rounded bg-rose-950/20 border border-rose-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                  <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                  <span>Breaking API & Contract Changes</span>
                </div>
                <ul className="space-y-1 text-xs text-rose-200/90 list-disc list-inside">
                  {releaseNotes.breakingChanges.map((bc, idx) => (
                    <li key={idx}>{bc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* PM / Downstream Squad Alerts */}
            {releaseNotes.downstreamServicesToAlert.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  <span>Downstream Squads & PM Alerts</span>
                </div>
                <div className="space-y-1">
                  {releaseNotes.downstreamServicesToAlert.map((service, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-300"
                    >
                      {service}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive QA Checklist */}
            {releaseNotes.qaChecklist.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-200">
                  Pre-Production QA Verification Checklist
                </div>
                <div className="space-y-1">
                  {releaseNotes.qaChecklist.map((item) => {
                    const checked = isQaChecked(item.id, item.checked);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleQaItem(item.id, item.checked)}
                        className="w-full flex items-start gap-2 p-2 rounded bg-[#090D16] border border-[#1E293B] text-left text-xs hover:border-slate-700 transition-colors"
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        )}
                        <span
                          className={
                            checked ? 'text-slate-400 line-through' : 'text-slate-200'
                          }
                        >
                          {item.item}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Automated Rollback Runbook */}
            {releaseNotes.rollbackPlan.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Automated Rollback Runbook</span>
                </div>
                <div className="p-3 rounded bg-[#090D16] border border-[#1E293B] space-y-1.5 font-mono text-[11px] text-slate-300">
                  {releaseNotes.rollbackPlan.map((step, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
