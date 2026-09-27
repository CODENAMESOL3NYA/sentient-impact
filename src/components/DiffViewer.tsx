import { useMemo } from 'react';
import { GitBranch, AlertTriangle, User } from 'lucide-react';
import type { GitHubPRDiff } from '../../server/services/githubClient';

interface Props {
  diff: string | null;
  prMeta: GitHubPRDiff['prMeta'] | null;
  diffTruncated: boolean;
}

// ---------------------------------------------------------------------------
// Diff parser
// ---------------------------------------------------------------------------

type LineType = 'addition' | 'deletion' | 'context' | 'header' | 'file';

interface ParsedLine {
  type: LineType;
  content: string;
  lineNum: number;
}

function parseDiff(raw: string): ParsedLine[] {
  return raw.split('\n').map((content, i) => {
    let type: LineType = 'context';
    if (content.startsWith('diff --git') || content.startsWith('---') || content.startsWith('+++')) {
      type = 'file';
    } else if (content.startsWith('@@')) {
      type = 'header';
    } else if (content.startsWith('+')) {
      type = 'addition';
    } else if (content.startsWith('-')) {
      type = 'deletion';
    }
    return { type, content, lineNum: i + 1 };
  });
}

// ---------------------------------------------------------------------------
// Line colours
// ---------------------------------------------------------------------------

const LINE_STYLES: Record<LineType, { bg: string; color: string; gutterBg: string; gutterColor: string }> = {
  addition:  { bg: '#0d2b0d', color: '#3fb950', gutterBg: '#0d2b0d', gutterColor: '#2ea04360' },
  deletion:  { bg: '#2b0d0d', color: '#f85149', gutterBg: '#2b0d0d', gutterColor: '#f8514960' },
  header:    { bg: '#0d1b2b', color: '#58a6ff', gutterBg: '#0d1b2b', gutterColor: '#58a6ff40' },
  file:      { bg: '#161b22', color: '#8b949e', gutterBg: '#161b22', gutterColor: '#30363d' },
  context:   { bg: 'transparent', color: '#c9d1d9', gutterBg: 'transparent', gutterColor: '#30363d' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiffViewer({ diff, prMeta, diffTruncated }: Props) {
  const lines = useMemo(() => (diff ? parseDiff(diff) : []), [diff]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>

      {/* ── PR Header Bar ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #21262d',
        flexShrink: 0,
        backgroundColor: '#161b22',
        minHeight: 44,
      }}>
        {prMeta ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prMeta.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#8b949e' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <GitBranch size={11} />
                <span style={{ color: '#58a6ff' }}>{prMeta.sourceBranch}</span>
                {' → '}
                <span>{prMeta.targetBranch}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={11} />
                {prMeta.author}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#484f58' }}>No PR selected</div>
        )}
      </div>

      {/* ── Truncation Warning ── */}
      {diffTruncated && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 16px',
          backgroundColor: '#2b1d09',
          borderBottom: '1px solid #d29922 40',
          flexShrink: 0,
          fontSize: 12,
          color: '#d29922',
        }}>
          <AlertTriangle size={12} />
          Diff truncated — only the first {(40_000).toLocaleString()} characters are shown. Analysis used the same truncated diff.
        </div>
      )}

      {/* ── Diff body ── */}
      {!diff ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#484f58' }}>
          <GitBranch size={32} style={{ opacity: 0.4 }} />
          <span style={{ fontSize: 14 }}>Select a PR and click Analyse to view its diff</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace", fontSize: 12 }}>
            <tbody>
              {lines.map((line, idx) => {
                const s = LINE_STYLES[line.type];
                return (
                  <tr key={idx} style={{ backgroundColor: s.bg }}>
                    {/* Gutter */}
                    <td style={{
                      width: 40,
                      minWidth: 40,
                      padding: '0 8px',
                      textAlign: 'right',
                      color: s.gutterColor,
                      backgroundColor: s.gutterBg,
                      userSelect: 'none',
                      fontSize: 11,
                      verticalAlign: 'top',
                      lineHeight: '20px',
                      borderRight: '1px solid #21262d',
                    }}>
                      {line.type !== 'file' ? line.lineNum : ''}
                    </td>
                    {/* Content */}
                    <td style={{
                      padding: '0 12px',
                      color: s.color,
                      whiteSpace: 'pre',
                      lineHeight: '20px',
                      verticalAlign: 'top',
                    }}>
                      {line.content || ' '}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
