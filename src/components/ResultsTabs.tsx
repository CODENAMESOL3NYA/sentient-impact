import { ShieldAlert, Activity, FileText } from 'lucide-react';
import type { CoachFinding, RiskScoreBreakdown, ReleaseNotes } from '../types/sentinal';
import type { BlastRadiusGraphPayload } from '../../server/adapters/agentAdapters';
import FindingsPanel from './FindingsPanel';
import BlastRadiusPanel from './BlastRadiusPanel';
import ReleaseNotesPanel from './ReleaseNotesPanel';

export type TabId = 'findings' | 'blast-radius' | 'release-notes';

interface Props {
  findings: CoachFinding[] | null;
  blastRadius: BlastRadiusGraphPayload | null;
  riskScore: RiskScoreBreakdown | null;
  releaseNotes: ReleaseNotes | null;
  isLoading: boolean;
  hasResult: boolean;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge: string | null;
}

export default function ResultsTabs({
  findings, blastRadius, riskScore, releaseNotes,
  isLoading, hasResult, activeTab, onTabChange,
}: Props) {

  const tabs: TabDef[] = [
    {
      id: 'findings',
      label: 'Findings',
      icon: <ShieldAlert size={12} />,
      badge: isLoading ? null : findings ? String(findings.length) : null,
    },
    {
      id: 'blast-radius',
      label: 'Blast Radius',
      icon: <Activity size={12} />,
      badge: isLoading ? null : riskScore ? riskScore.riskTier : null,
    },
    {
      id: 'release-notes',
      label: 'Release Notes',
      icon: <FileText size={12} />,
      badge: isLoading ? null : releaseNotes ? releaseNotes.versionTarget : null,
    },
  ];

  const tabsEnabled = isLoading || hasResult;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #21262d',
        backgroundColor: '#161b22',
        flexShrink: 0,
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const disabled = !tabsEnabled;
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && onTabChange(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '9px 4px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #58a6ff' : '2px solid transparent',
                color: isActive ? '#e6edf3' : disabled ? '#30363d' : '#8b949e',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: isActive ? '#58a6ff' : disabled ? '#30363d' : '#484f58' }}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.badge && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  backgroundColor: isActive ? '#1f3a5f' : '#21262d',
                  color: isActive ? '#58a6ff' : '#8b949e',
                  border: `1px solid ${isActive ? '#58a6ff40' : '#30363d'}`,
                  borderRadius: 10,
                  padding: '0 5px',
                  lineHeight: '16px',
                  minWidth: 16,
                  textAlign: 'center',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Panel area ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Placeholder before first analysis */}
        {!isLoading && !hasResult && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, color: '#484f58',
          }}>
            <Activity size={32} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: 13 }}>Select a PR and click Analyse</span>
          </div>
        )}

        {/* Findings */}
        <div style={{ display: activeTab === 'findings' && (isLoading || hasResult) ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <FindingsPanel findings={findings} isLoading={isLoading} />
        </div>

        {/* Blast Radius */}
        <div style={{ display: activeTab === 'blast-radius' && (isLoading || hasResult) ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <BlastRadiusPanel blastRadius={blastRadius} riskScore={riskScore} isLoading={isLoading} />
        </div>

        {/* Release Notes */}
        <div style={{ display: activeTab === 'release-notes' && (isLoading || hasResult) ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ReleaseNotesPanel releaseNotes={releaseNotes} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
