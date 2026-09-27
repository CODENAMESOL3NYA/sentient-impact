import { useState } from 'react';
import { CheckSquare, Square, FileText, AlertOctagon, Bell, ClipboardList, RotateCcw } from 'lucide-react';
import type { ReleaseNotes } from '../types/sentinal';

interface Props {
  releaseNotes: ReleaseNotes | null;
  isLoading: boolean;
}

function Skeleton() {
  return (
    <div style={{ padding: 14 }}>
      {[70, 100, 55, 80, 65].map((w, i) => (
        <div key={i} style={{
          height: 10, width: `${w}%`,
          backgroundColor: '#21262d', borderRadius: 4,
          marginBottom: 10,
          animation: `rnpulse 1.5s ease-in-out ${i * 0.1}s infinite alternate`,
        }} />
      ))}
      <style>{`@keyframes rnpulse { from { opacity: 1 } to { opacity: 0.4 } }`}</style>
    </div>
  );
}

function Section({ icon, label, color, children }: {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function StringList({ items, color = '#8b949e' }: { items: string[]; color?: string }) {
  if (items.length === 0) return <p style={{ fontSize: 12, color: '#484f58', fontStyle: 'italic' }}>None</p>;
  return (
    <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12, color, lineHeight: 1.6, marginBottom: 2 }}>{item}</li>
      ))}
    </ul>
  );
}

export default function ReleaseNotesPanel({ releaseNotes, isLoading }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (isLoading) return <div style={{ height: '100%', backgroundColor: '#0d1117' }}><Skeleton /></div>;

  if (!releaseNotes) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', fontSize: 13 }}>
        Run analysis to generate release notes
      </div>
    );
  }

  function toggleCheck(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 14, backgroundColor: '#0d1117' }}>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', marginBottom: 2 }}>{releaseNotes.title}</div>
        <div style={{ fontSize: 11, color: '#8b949e' }}>Target: <span style={{ color: '#58a6ff' }}>{releaseNotes.versionTarget}</span></div>
      </div>

      {/* Executive summary */}
      <Section icon={<FileText size={12} />} label="Executive Summary" color="#58a6ff">
        <p style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.6, margin: 0 }}>
          {releaseNotes.executiveSummary || <span style={{ color: '#484f58', fontStyle: 'italic' }}>No summary provided.</span>}
        </p>
      </Section>

      {/* Breaking changes */}
      <Section icon={<AlertOctagon size={12} />} label="Breaking Changes" color="#f85149">
        <StringList items={releaseNotes.breakingChanges} color="#f85149" />
      </Section>

      {/* Downstream services */}
      <Section icon={<Bell size={12} />} label="Services to Alert" color="#d29922">
        <StringList items={releaseNotes.downstreamServicesToAlert} color="#d29922" />
      </Section>

      {/* QA Checklist */}
      <Section icon={<ClipboardList size={12} />} label="QA Checklist" color="#3fb950">
        {releaseNotes.qaChecklist.length === 0
          ? <p style={{ fontSize: 12, color: '#484f58', fontStyle: 'italic' }}>None</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {releaseNotes.qaChecklist.map(item => {
                const isChecked = checked[item.id] ?? item.checked;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '3px 0', textAlign: 'left',
                    }}
                  >
                    <span style={{ color: isChecked ? '#3fb950' : '#484f58', flexShrink: 0, marginTop: 1 }}>
                      {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
                    </span>
                    <span style={{ fontSize: 12, color: isChecked ? '#8b949e' : '#c9d1d9', textDecoration: isChecked ? 'line-through' : 'none', lineHeight: 1.5 }}>
                      {item.item}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
      </Section>

      {/* Rollback plan */}
      <Section icon={<RotateCcw size={12} />} label="Rollback Plan" color="#8b949e">
        <StringList items={releaseNotes.rollbackPlan} />
      </Section>
    </div>
  );
}
