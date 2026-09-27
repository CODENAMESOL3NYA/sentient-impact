import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import type { DependencyNode, DependencyEdge, BlastRadiusImpact, RiskScoreBreakdown, SeverityLevel } from '../types/sentinal';
import type { BlastRadiusGraphPayload } from '../../server/adapters/agentAdapters';

interface Props {
  blastRadius: BlastRadiusGraphPayload | null;
  riskScore: RiskScoreBreakdown | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const RISK_COLOR: Record<SeverityLevel, string> = {
  critical: '#f85149',
  high:     '#ff7b72',
  medium:   '#d29922',
  low:      '#3fb950',
  info:     '#58a6ff',
};

const TIER_COLOR: Record<string, string> = {
  CRITICAL: '#f85149',
  HIGH:     '#ff7b72',
  MODERATE: '#d29922',
  LOW:      '#3fb950',
};

const SEV_COLOR: Record<string, string> = {
  critical: '#f85149',
  high:     '#ff7b72',
  medium:   '#d29922',
  low:      '#3fb950',
};

// ---------------------------------------------------------------------------
// Risk Score Dial
// ---------------------------------------------------------------------------

function RiskScoreDial({ riskScore }: { riskScore: RiskScoreBreakdown }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => Math.round(v));
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(mv, riskScore.overallScore, { duration: 1, ease: 'easeOut' });
    const unsub = rounded.on('change', v => {
      if (displayRef.current) displayRef.current.textContent = String(v);
    });
    return () => { controls.stop(); unsub(); };
  }, [riskScore.overallScore, mv, rounded]);

  const tierColor = TIER_COLOR[riskScore.riskTier] ?? '#8b949e';
  const factors = riskScore.factors;

  return (
    <div style={{ padding: '14px 14px 10px' }}>
      {/* Score + tier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <span ref={displayRef} style={{ fontSize: 48, fontWeight: 800, color: tierColor, lineHeight: 1 }}>0</span>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>/100</div>
        </div>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: tierColor,
            backgroundColor: `${tierColor}18`,
            border: `1px solid ${tierColor}40`,
            borderRadius: 4, padding: '3px 10px', display: 'inline-block',
          }}>
            {riskScore.riskTier}
          </div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 5, lineHeight: 1.4, maxWidth: 240 }}>
            {riskScore.summary}
          </div>
        </div>
      </div>

      {/* Factor bars */}
      {([
        ['Breaking API Surface', factors.breakingApiSurface, 35],
        ['Downstream Fanout',    factors.downstreamFanout,   25],
        ['Security Criticality', factors.securityCriticality, 25],
        ['Test Coverage Delta',  factors.testCoverageDelta,   15],
      ] as [string, number, number][]).map(([label, val, max]) => (
        <div key={label} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b949e', marginBottom: 3 }}>
            <span>{label}</span>
            <span style={{ color: '#e6edf3' }}>{val} / {max}</span>
          </div>
          <div style={{ height: 5, backgroundColor: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(val / max) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ height: '100%', backgroundColor: tierColor, borderRadius: 3 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dependency Graph (SVG DAG)
// ---------------------------------------------------------------------------

const NODE_W = 120;
const NODE_H = 36;
const TIER_GAP_X = 160;
const NODE_GAP_Y = 52;
const PAD_X = 20;
const PAD_Y = 20;

function layoutNodes(nodes: DependencyNode[]) {
  const byTier: Record<number, DependencyNode[]> = {};
  for (const n of nodes) {
    (byTier[n.tier] ??= []).push(n);
  }
  const positioned: Record<string, { x: number; y: number }> = {};
  for (const [tier, group] of Object.entries(byTier)) {
    const t = Number(tier);
    group.forEach((n, i) => {
      positioned[n.id] = {
        x: PAD_X + t * TIER_GAP_X,
        y: PAD_Y + i * NODE_GAP_Y,
      };
    });
  }
  return positioned;
}

function DependencyGraph({ nodes, edges }: { nodes: DependencyNode[]; edges: DependencyEdge[] }) {
  if (nodes.length === 0) return null;

  const positions = layoutNodes(nodes);
  const maxTier = Math.max(...nodes.map(n => n.tier));
  const maxPerTier = Math.max(...Object.values(
    nodes.reduce<Record<number, number>>((acc, n) => { acc[n.tier] = (acc[n.tier] ?? 0) + 1; return acc; }, {})
  ));

  const svgW = PAD_X * 2 + (maxTier + 1) * TIER_GAP_X;
  const svgH = PAD_Y * 2 + maxPerTier * NODE_GAP_Y;

  return (
    <div style={{ overflowX: 'auto', borderTop: '1px solid #21262d' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#484f58" />
          </marker>
          <marker id="arrow-break" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#f85149" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const src = positions[edge.source];
          const tgt = positions[edge.target];
          if (!src || !tgt) return null;
          const x1 = src.x + NODE_W;
          const y1 = src.y + NODE_H / 2;
          const x2 = tgt.x;
          const y2 = tgt.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const color = edge.isBreakingChange ? '#f85149' : '#30363d';
          return (
            <path
              key={i}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              stroke={color}
              strokeWidth={edge.isBreakingChange ? 1.5 : 1}
              fill="none"
              markerEnd={edge.isBreakingChange ? 'url(#arrow-break)' : 'url(#arrow)'}
              strokeDasharray={edge.isBreakingChange ? '3,2' : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const color = RISK_COLOR[node.risk as SeverityLevel] ?? '#8b949e';
          return (
            <g key={node.id}>
              <rect
                x={pos.x} y={pos.y}
                width={NODE_W} height={NODE_H}
                rx={4}
                fill="#161b22"
                stroke={color}
                strokeWidth={node.tier === 0 ? 1.5 : 1}
                strokeOpacity={0.6}
              />
              <text
                x={pos.x + NODE_W / 2} y={pos.y + 13}
                textAnchor="middle"
                fill={node.tier === 0 ? color : '#c9d1d9'}
                fontSize={10}
                fontWeight={node.tier === 0 ? 700 : 400}
                fontFamily="system-ui, sans-serif"
              >
                {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
              </text>
              <text
                x={pos.x + NODE_W / 2} y={pos.y + 26}
                textAnchor="middle"
                fill="#484f58"
                fontSize={9}
                fontFamily="system-ui, sans-serif"
              >
                {node.type.replace('_', ' ')} · {node.fanoutCount} deps
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blast Radius Table
// ---------------------------------------------------------------------------

function BlastRadiusTable({ table }: { table: BlastRadiusImpact[] }) {
  if (table.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', borderTop: '1px solid #21262d' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: '#161b22' }}>
            {['Component', 'Type', 'Impact', 'Sev', 'Callers'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#8b949e', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #21262d' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const color = SEV_COLOR[row.severity] ?? '#8b949e';
            return (
              <tr key={i} style={{ borderBottom: '1px solid #21262d', borderLeft: `2px solid ${color}` }}>
                <td style={{ padding: '6px 10px', color: '#c9d1d9', fontFamily: 'monospace', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.dependentComponent.split('/').pop()}
                </td>
                <td style={{ padding: '6px 10px', color: '#8b949e', whiteSpace: 'nowrap' }}>{row.componentType}</td>
                <td style={{ padding: '6px 10px', color: '#8b949e', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.impactType}</td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color, backgroundColor: `${color}15`, border: `1px solid ${color}30`, borderRadius: 3, padding: '1px 5px' }}>
                    {row.severity}
                  </span>
                </td>
                <td style={{ padding: '6px 10px', color: '#e6edf3', textAlign: 'center' }}>{row.affectedCallers}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div style={{ padding: 14 }}>
      {[80, 60, 90, 50].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 48 : 10,
          width: `${w}%`,
          backgroundColor: '#21262d',
          borderRadius: 4,
          marginBottom: 10,
          animation: `pulse 1.5s ease-in-out ${i * 0.15}s infinite alternate`,
        }} />
      ))}
      <style>{`@keyframes pulse { from { opacity: 1 } to { opacity: 0.4 } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function BlastRadiusPanel({ blastRadius, riskScore, isLoading }: Props) {
  if (isLoading) return <div style={{ height: '100%', backgroundColor: '#0d1117' }}><Skeleton /></div>;

  if (!riskScore || !blastRadius) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', fontSize: 13 }}>
        Run analysis to see blast-radius data
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#0d1117' }}>
      <RiskScoreDial riskScore={riskScore} />
      <DependencyGraph nodes={blastRadius.nodes} edges={blastRadius.edges} />
      <BlastRadiusTable table={blastRadius.table} />
    </div>
  );
}
