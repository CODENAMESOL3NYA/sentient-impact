import type { GitHubPRDiff } from '../../server/services/githubClient';
import { MOCK_PRS } from '../data/mockPrData';
import type { DiffLine } from '../types/sentinal';

interface DiffViewerProps {
  diff: string | null;
  prMeta: GitHubPRDiff['prMeta'] | null;
  diffTruncated: boolean;
}

interface ParsedFileDiff {
  filename: string;
  additions: number;
  deletions: number;
  diffLines: DiffLine[];
}

function parseRawUnifiedDiff(rawDiff: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const lines = rawDiff.split('\n');
  let currentFile: ParsedFileDiff | null = null;
  let oldLine = 1;
  let newLine = 1;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      const filename = line.slice(6).trim();
      currentFile = { filename, additions: 0, deletions: 0, diffLines: [] };
      files.push(currentFile);
      continue;
    }
    if (line.startsWith('--- a/')) {
      continue;
    }
    if (!currentFile) continue;

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      currentFile.diffLines.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      currentFile.additions += 1;
      currentFile.diffLines.push({
        type: 'addition',
        newLineNumber: newLine++,
        content: line,
      });
    } else if (line.startsWith('-')) {
      currentFile.deletions += 1;
      currentFile.diffLines.push({
        type: 'deletion',
        oldLineNumber: oldLine++,
        content: line,
      });
    } else {
      currentFile.diffLines.push({
        type: 'context',
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line,
      });
    }
  }

  return files;
}

export default function DiffViewer({ diff, prMeta, diffTruncated }: DiffViewerProps) {
  const matchedMock = prMeta
    ? MOCK_PRS.find(
        p => p.sourceBranch === prMeta.sourceBranch || p.title === prMeta.title
      )
    : null;

  const filesToRender: ParsedFileDiff[] = matchedMock
    ? matchedMock.files.map(f => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        diffLines: f.diffLines,
      }))
    : diff
    ? parseRawUnifiedDiff(diff)
    : [];

  if (!prMeta && !diff) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          color: '#8b949e',
          textAlign: 'center',
          backgroundColor: '#0d1117',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            marginBottom: 14,
            color: '#58a6ff',
          }}
        >
          ⇄
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 6 }}>
          Ready for Pull Request Analysis
        </div>
        <div style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.5 }}>
          Select a Pull Request from the sidebar and click <strong>Analyze PR</strong> to inspect unified diffs, inline security & architecture coaching notes, and the downstream blast-radius graph.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>
      {/* PR Meta Header */}
      {prMeta && (
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #21262d',
            backgroundColor: '#161b22',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>
            {prMeta.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#8b949e' }}>
            <span>
              Author: <strong style={{ color: '#c9d1d9' }}>{prMeta.author}</strong>
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                backgroundColor: '#21262d',
                border: '1px solid #30363d',
                padding: '1px 6px',
                borderRadius: 4,
                color: '#58a6ff',
              }}
            >
              {prMeta.sourceBranch} → {prMeta.targetBranch}
            </span>
          </div>
        </div>
      )}

      {diffTruncated && (
        <div
          style={{
            padding: '6px 20px',
            backgroundColor: '#3b2e00',
            borderBottom: '1px solid #9e6a03',
            color: '#e3b341',
            fontSize: 12,
          }}
        >
          Note: Large diff was truncated to fit within the subagent token budget.
        </div>
      )}

      {/* Diff Files Scroll Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filesToRender.map(file => (
          <div
            key={file.filename}
            style={{
              border: '1px solid #30363d',
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#0d1117',
            }}
          >
            {/* File Header */}
            <div
              style={{
                padding: '8px 14px',
                backgroundColor: '#161b22',
                borderBottom: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#e6edf3', fontWeight: 600 }}>{file.filename}</span>
              <div>
                <span style={{ color: '#3fb950', marginRight: 8 }}>+{file.additions}</span>
                <span style={{ color: '#f85149' }}>-{file.deletions}</span>
              </div>
            </div>

            {/* Diff Lines */}
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>
              {file.diffLines.map((line, idx) => {
                let bg = 'transparent';
                let textColor = '#c9d1d9';

                if (line.type === 'header') {
                  bg = 'rgba(56, 139, 253, 0.12)';
                  textColor = '#79c0ff';
                } else if (line.type === 'addition') {
                  bg = line.hasFinding ? 'rgba(210, 153, 34, 0.22)' : 'rgba(46, 160, 67, 0.15)';
                  textColor = '#e6edf3';
                } else if (line.type === 'deletion') {
                  bg = 'rgba(248, 81, 73, 0.15)';
                  textColor = '#ffa198';
                }

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      backgroundColor: bg,
                      borderLeft: line.hasFinding ? '3px solid #d29922' : '3px solid transparent',
                      padding: '2px 10px',
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        color: '#6e7681',
                        userSelect: 'none',
                        textAlign: 'right',
                        paddingRight: 8,
                        flexShrink: 0,
                      }}
                    >
                      {line.oldLineNumber ?? ''}
                    </span>
                    <span
                      style={{
                        width: 36,
                        color: '#6e7681',
                        userSelect: 'none',
                        textAlign: 'right',
                        paddingRight: 10,
                        flexShrink: 0,
                      }}
                    >
                      {line.newLineNumber ?? ''}
                    </span>
                    <span
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: textColor,
                        flex: 1,
                      }}
                    >
                      {line.content}
                    </span>
                    {line.hasFinding && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          padding: '0 6px',
                          borderRadius: 4,
                          backgroundColor: '#d2992233',
                          border: '1px solid #d29922',
                          color: '#e3b341',
                          alignSelf: 'center',
                          flexShrink: 0,
                        }}
                      >
                        Coach Flag
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
