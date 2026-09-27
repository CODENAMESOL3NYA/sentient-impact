import { useState } from 'react';
import type { CoachFinding, RiskScoreBreakdown, ReleaseNotes, SeverityLevel } from '../types/sentinal';
import type { BlastRadiusGraphPayload } from '../../server/adapters/agentAdapters';

type TabId = 'findings' | 'blast-radius' | 'release-notes';

interface ResultsTabsProps {
  findings: CoachFinding[] | null;
  blastRadius: BlastRadiusGraphPayload | null;
  riskScore: RiskScoreBreakdown | null;
  releaseNotes: ReleaseNotes | null;
  isLoading: boolean;
  hasResult: boolean;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function severityColor(severity: SeverityLevel): { bg: string; border: string; text: string } {
  switch (severity) {
    case 'critical':
      return { bg: '#3d1a1a', border: '#f85149', text: '#ff7b72' };
    case 'high':
      return { bg: '#3b2314', border: '#db6d28', text: '#ffa657' };
    case 'medium':
      return { bg: '#3b2e00', border: '#d29922', text: '#e3b341' };
    case 'low':
    case 'info':
    default:
      return { bg: '#122d42', border: '#388bfd', text: '#79c0ff' };
  }
}

export default function ResultsTabs({
  findings,
  blastRadius,
  riskScore,
  releaseNotes,
  isLoading,
  hasResult,
  activeTab,
  onTabChange,
}: ResultsTabsProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const tabs: { id: TabId; label: string; badge?: string | number }[] = [
    {
      id: 'findings',
      label: 'Coach Findings',
      badge: findings ? findings.length : undefined,
    },
    {
      id: 'blast-radius',
      label: 'Blast Radius',
      badge: riskScore ? `${riskScore.overallScore}` : undefined,
    },
    {
      id: 'release-notes',
      label: 'Release Notes',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>
      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #21262d',
          backgroundColor: '#161b22',
          flexShrink: 0,
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                padding: '11px 8px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #f78166' : '2px solid transparent',
                color: isActive ? '#e6edf3' : '#8b949e',
                fontWeight: isActive ? 600 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 10,
                    backgroundColor: '#21262d',
                    color: '#c9d1d9',
                    border: '1px solid #30363d',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#8b949e' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3', marginBottom: 6 }}>
              Orchestrating Subagents A & B…
            </div>
            <div style={{ fontSize: 12 }}>
              Evaluating OWASP/SOLID rules and computing downstream dependency fan-out.
            </div>
          </div>
        )}

        {!isLoading && !hasResult && (
          <div style={{ padding: 32, textAlign: 'center', color: '#8b949e' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3', marginBottom: 6 }}>
              No Analysis Results Yet
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              Click <strong>Analyze PR</strong> in the sidebar to run Agent A (The Code Review Coach) and Agent B (The Blast-Radius Radar).
            </div>
          </div>
        )}

        {/* TAB 1: COACH FINDINGS */}
        {!isLoading && hasResult && activeTab === 'findings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(!findings || findings.length === 0) ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 8,
                  border: '1px solid #238636',
                  backgroundColor: 'rgba(46, 160, 67, 0.1)',
                  color: '#3fb950',
                  fontSize: 13,
                }}
              >
                ✓ Zero standard violations detected by Agent A (The Coach).
              </div>
            ) : (
              findings.map(finding => {
                const colors = severityColor(finding.severity);
                return (
                  <div
                    key={finding.id}
                    style={{
                      border: `1px solid ${colors.border}55`,
                      borderRadius: 8,
                      backgroundColor: '#161b22',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 7px',
                          borderRadius: 4,
                          backgroundColor: colors.bg,
                          border: `1px solid ${colors.border}`,
                          color: colors.text,
                        }}
                      >
                        {finding.severity} · {finding.category.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e' }}>
                        {finding.file}:{finding.line}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>
                      {finding.title}
                    </div>

                    <div style={{ fontSize: 11, color: '#79c0ff', fontFamily: 'monospace' }}>
                      {finding.ruleViolated}
                    </div>

                    <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.5 }}>
                      {finding.description}
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        backgroundColor: '#0d1117',
                        border: '1px solid #21262d',
                        fontSize: 12,
                        color: '#8b949e',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong style={{ color: '#e6edf3' }}>Coaching Rationale: </strong>
                      {finding.educationalRationale}
                    </div>

                    {finding.suggestedFix && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#3fb950', marginBottom: 4 }}>
                          Suggested Fix:
                        </div>
                        <pre
                          style={{
                            padding: 10,
                            borderRadius: 6,
                            backgroundColor: '#0d1117',
                            border: '1px solid #30363d',
                            color: '#e6edf3',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            overflowX: 'auto',
                            margin: 0,
                          }}
                        >
                          {finding.suggestedFix}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: BLAST RADIUS & RISK SCORE */}
        {!isLoading && hasResult && activeTab === 'blast-radius' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {riskScore && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  backgroundColor: '#161b22',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>
                      Composite Risk Score
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#e6edf3' }}>
                      {riskScore.overallScore}
                      <span style={{ fontSize: 13, color: '#8b949e', fontWeight: 400 }}> / 100</span>
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: 12,
                      backgroundColor:
                        riskScore.riskTier === 'CRITICAL'
                          ? '#3d1a1a'
                          : riskScore.riskTier === 'HIGH'
                          ? '#3b2314'
                          : riskScore.riskTier === 'MODERATE'
                          ? '#3b2e00'
                          : '#122d42',
                      color:
                        riskScore.riskTier === 'CRITICAL'
                          ? '#ff7b72'
                          : riskScore.riskTier === 'HIGH'
                          ? '#ffa657'
                          : riskScore.riskTier === 'MODERATE'
                          ? '#e3b341'
                          : '#79c0ff',
                      border: '1px solid #30363d',
                    }}
                  >
                    {riskScore.riskTier} RISK
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#c9d1d9', marginBottom: 12, lineHeight: 1.5 }}>
                  {riskScore.summary}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginBottom: 2 }}>
                      <span>Breaking API Surface</span>
                      <span>{riskScore.factors.breakingApiSurface} / 35</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: '#0d1117', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(riskScore.factors.breakingApiSurface / 35) * 100}%`,
                          height: '100%',
                          backgroundColor: '#f85149',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginBottom: 2 }}>
                      <span>Downstream Fanout</span>
                      <span>{riskScore.factors.downstreamFanout} / 25</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: '#0d1117', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(riskScore.factors.downstreamFanout / 25) * 100}%`,
                          height: '100%',
                          backgroundColor: '#db6d28',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginBottom: 2 }}>
                      <span>Security Criticality</span>
                      <span>{riskScore.factors.securityCriticality} / 25</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: '#0d1117', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(riskScore.factors.securityCriticality / 25) * 100}%`,
                          height: '100%',
                          backgroundColor: '#d29922',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginBottom: 2 }}>
                      <span>Test Coverage Delta</span>
                      <span>{riskScore.factors.testCoverageDelta} / 15</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: '#0d1117', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(riskScore.factors.testCoverageDelta / 15) * 100}%`,
                          height: '100%',
                          backgroundColor: '#58a6ff',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dependency Graph Nodes */}
            {blastRadius && blastRadius.nodes.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  backgroundColor: '#161b22',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3', marginBottom: 10 }}>
                  Dependency Propagation Graph ({blastRadius.nodes.length} nodes, {blastRadius.edges.length} edges)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blastRadius.nodes.map(node => {
                    const colors = severityColor(node.risk);
                    return (
                      <div
                        key={node.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          backgroundColor: '#0d1117',
                          border: `1px solid ${colors.border}55`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', fontFamily: 'monospace' }}>
                            [Tier {node.tier}] {node.label}
                          </span>
                          <span style={{ fontSize: 10, color: colors.text, textTransform: 'uppercase', fontWeight: 700 }}>
                            {node.risk} · fanout {node.fanoutCount}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#8b949e' }}>{node.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Blast Radius Impact Table */}
            {blastRadius && blastRadius.table.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  backgroundColor: '#161b22',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3', marginBottom: 10 }}>
                  Impacted Downstream Components
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {blastRadius.table.map((row, idx) => {
                    const colors = severityColor(row.severity);
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          borderRadius: 6,
                          backgroundColor: '#0d1117',
                          border: '1px solid #21262d',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#58a6ff', fontFamily: 'monospace' }}>
                            {row.dependentComponent}
                          </span>
                          <span style={{ fontSize: 10, color: colors.text, fontWeight: 700, textTransform: 'uppercase' }}>
                            {row.impactType}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                          {row.componentType} · Affected Callers: <strong>{row.affectedCallers}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#3fb950', fontFamily: 'monospace' }}>
                          Test: {row.recommendedTest}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RELEASE NOTES */}
        {!isLoading && hasResult && activeTab === 'release-notes' && releaseNotes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                border: '1px solid #30363d',
                backgroundColor: '#161b22',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#58a6ff', fontWeight: 700, fontFamily: 'monospace' }}>
                  Target: {releaseNotes.versionTarget}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>
                {releaseNotes.title}
              </div>
              <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.5 }}>
                {releaseNotes.executiveSummary}
              </div>
            </div>

            {releaseNotes.breakingChanges.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #f8514955',
                  backgroundColor: '#161b22',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ff7b72', marginBottom: 8 }}>
                  Breaking Changes
                </div>
                <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#c9d1d9' }}>
                  {releaseNotes.breakingChanges.map((bc, i) => (
                    <li key={i}>{bc}</li>
                  ))}
                </ul>
              </div>
            )}

            {releaseNotes.qaChecklist.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  backgroundColor: '#161b22',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>
                  QA Verification Checklist
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {releaseNotes.qaChecklist.map(item => {
                    const isChecked = checkedItems[item.id] ?? item.checked;
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          fontSize: 12,
                          color: isChecked ? '#8b949e' : '#c9d1d9',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setCheckedItems(prev => ({ ...prev, [item.id]: !isChecked }))
                          }
                          style={{ marginTop: 3 }}
                        />
                        <span style={{ textDecoration: isChecked ? 'line-through' : 'none' }}>
                          {item.item}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {releaseNotes.rollbackPlan.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  backgroundColor: '#161b22',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e3b341', marginBottom: 8 }}>
                  Rollback Playbook
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#c9d1d9' }}>
                  {releaseNotes.rollbackPlan.map((step, i) => (
                    <div key={i}>{step}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
