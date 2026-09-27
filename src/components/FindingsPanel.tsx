import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert, Zap, Layers, FileCode, TestTube, Building2,
  ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';
import type { CoachFinding, SeverityLevel, StandardCategory } from '../types/sentinal';

interface Props {
  findings: CoachFinding[] | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  critical: '#f85149',
  high:     '#ff7b72',
  medium:   '#d29922',
  low:      '#3fb950',
  info:     '#58a6ff',
};

const SEVERITY_BG: Record<SeverityLevel, string> = {
  critical: '#3d1a1a',
  high:     '#2b1a10',
  medium:   '#2b1d09',
  low:      '#0d2b0d',
  info:     '#0d1b2b',
};

const CATEGORY_ICON: Record<StandardCategory, React.ReactNode> = {
  security:       <ShieldAlert size={12} />,
  performance:    <Zap size={12} />,
  solid_dry:      <Layers size={12} />,
  type_safety:    <FileCode size={12} />,
  test_coverage:  <TestTube size={12} />,
  architectural:  <Building2 size={12} />,
};

const CATEGORY_LABEL: Record<StandardCategory, string> = {
  security:      'Security',
  performance:   'Performance',
  solid_dry:     'SOLID/DRY',
  type_safety:   'Type Safety',
  test_coverage: 'Test Coverage',
  architectural: 'Architectural',
};

const SEVERITY_ORDER: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

// ---------------------------------------------------------------------------
// Severity summary bar
// ---------------------------------------------------------------------------

function SeveritySummaryBar({ findings }: { findings: CoachFinding[] }) {
  const counts = SEVERITY_ORDER.reduce<Partial<Record<SeverityLevel, number>>>((acc, s) => {
    acc[s] = findings.filter(f => f.severity === s).length;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid #21262d', backgroundColor: '#161b22' }}>
      {SEVERITY_ORDER.map(s => {
        const n = counts[s] ?? 0;
        if (n === 0) return null;
        return (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600,
            color: SEVERITY_COLOR[s],
            backgroundColor: SEVERITY_BG[s],
            border: `1px solid ${SEVERITY_COLOR[s]}30`,
            borderRadius: 4, padding: '2px 7px',
          }}>
            {n} {s}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finding card
// ---------------------------------------------------------------------------

function FindingCard({ finding, index }: { finding: CoachFinding; index: number }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY_COLOR[finding.severity];
  const bg = SEVERITY_BG[finding.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      style={{
        margin: '6px 10px',
        borderRadius: 6,
        border: `1px solid ${color}30`,
        backgroundColor: '#0d1117',
        overflow: 'hidden',
      }}
    >
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          width: '100%', textAlign: 'left', background: 'none',
          border: 'none', cursor: 'pointer', padding: '10px 12px',
        }}
      >
        {/* Severity stripe */}
        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{finding.title}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, color: SEVERITY_COLOR[finding.severity],
              backgroundColor: bg, border: `1px solid ${color}30`,
              borderRadius: 3, padding: '1px 5px',
            }}>
              {finding.severity.toUpperCase()}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, color: '#8b949e',
              backgroundColor: '#21262d', border: '1px solid #30363d',
              borderRadius: 3, padding: '1px 5px',
            }}>
              {CATEGORY_ICON[finding.category]}
              {CATEGORY_LABEL[finding.category]}
            </span>
          </div>

          {/* File + line */}
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 3, fontFamily: 'monospace' }}>
            {finding.file}:{finding.line}{finding.endLine ? `–${finding.endLine}` : ''}
          </div>

          {/* Rule */}
          <div style={{ fontSize: 11, color: '#484f58', marginTop: 2 }}>
            {finding.ruleViolated}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ color: '#484f58', flexShrink: 0, marginTop: 2 }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 12px 12px 23px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Description */}
              <p style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.5 }}>{finding.description}</p>

              {/* Educational rationale */}
              {finding.educationalRationale && (
                <div style={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#58a6ff', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                    Why this matters
                  </div>
                  <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.5 }}>{finding.educationalRationale}</p>
                </div>
              )}

              {/* Suggested fix */}
              {finding.suggestedFix && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#3fb950', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                    Suggested Fix
                  </div>
                  <pre style={{
                    fontSize: 11, color: '#3fb950',
                    backgroundColor: '#0d2b0d', border: '1px solid #2ea04330',
                    borderRadius: 4, padding: '8px 10px', margin: 0,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                  }}>
                    {finding.suggestedFix}
                  </pre>
                </div>
              )}

              {/* Code snippet */}
              {finding.codeSnippet && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#f85149', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                    Flagged Code
                  </div>
                  <pre style={{
                    fontSize: 11, color: '#f85149',
                    backgroundColor: '#2b0d0d', border: '1px solid #f8514930',
                    borderRadius: 4, padding: '8px 10px', margin: 0,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                  }}>
                    {finding.codeSnippet}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function FindingSkeleton({ index }: { index: number }) {
  return (
    <div style={{
      margin: '6px 10px', borderRadius: 6,
      border: '1px solid #21262d', backgroundColor: '#161b22',
      padding: '10px 12px',
      animation: `pulse 1.5s ease-in-out ${index * 0.15}s infinite alternate`,
    }}>
      <div style={{ height: 12, width: '60%', backgroundColor: '#21262d', borderRadius: 3, marginBottom: 6 }} />
      <div style={{ height: 10, width: '40%', backgroundColor: '#21262d', borderRadius: 3 }} />
      <style>{`@keyframes pulse { from { opacity: 1 } to { opacity: 0.4 } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function FindingsPanel({ findings, isLoading }: Props) {
  if (isLoading) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#0d1117' }}>
        {[0, 1, 2].map(i => <FindingSkeleton key={i} index={i} />)}
      </div>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#484f58' }}>
        <CheckCircle2 size={32} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 13 }}>
          {findings === null ? 'Run analysis to see findings' : 'No findings — clean diff ✓'}
        </span>
      </div>
    );
  }

  // Sort: critical → high → medium → low → info
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>
      <SeveritySummaryBar findings={sorted} />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {sorted.map((f, i) => <FindingCard key={f.id} finding={f} index={i} />)}
      </div>
    </div>
  );
}
