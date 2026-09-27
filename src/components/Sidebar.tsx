import { useState, useEffect } from 'react';
import type { GitHubPRSummary } from '../../server/services/githubClient';
import { MOCK_PRS } from '../data/mockPrData';

interface SidebarProps {
  selectedPR: GitHubPRSummary | null;
  isAnalyzing: boolean;
  onSelectPR: (pr: GitHubPRSummary, owner: string, repo: string) => void;
  onAnalyze: (pr: GitHubPRSummary) => void;
}

const DEFAULT_PRS: GitHubPRSummary[] = MOCK_PRS.map(pr => ({
  number: pr.number,
  title: pr.title,
  author: pr.author,
  sourceBranch: pr.sourceBranch,
  targetBranch: pr.targetBranch,
  additions: pr.additions,
  deletions: pr.deletions,
  changedFilesCount: pr.changedFilesCount,
}));

export default function Sidebar({
  selectedPR,
  isAnalyzing,
  onSelectPR,
  onAnalyze,
}: SidebarProps) {
  const [owner, setOwner] = useState('21Tech');
  const [repo, setRepo] = useState('sentinel-impact');
  const [prs, setPrs] = useState<GitHubPRSummary[]>(DEFAULT_PRS);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPR && DEFAULT_PRS.length > 0) {
      onSelectPR(DEFAULT_PRS[0], '21Tech', 'sentinel-impact');
    }
  }, []);

  async function handleFetchPRs(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!owner.trim() || !repo.trim()) return;

    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(
        `/api/github/prs?owner=${encodeURIComponent(owner.trim())}&repo=${encodeURIComponent(repo.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to load PRs (${res.status})`);
      }
      const fetched: GitHubPRSummary[] = Array.isArray(data.prs) ? data.prs : DEFAULT_PRS;
      setPrs(fetched);
      if (fetched.length > 0) {
        onSelectPR(fetched[0], owner.trim(), repo.trim());
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not fetch PR list');
    } finally {
      setLoadingList(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>
      {/* Repository selector */}
      <form
        onSubmit={handleFetchPRs}
        style={{
          padding: 14,
          borderBottom: '1px solid #21262d',
          backgroundColor: '#161b22',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          GitHub Repository
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={owner}
            onChange={e => setOwner(e.target.value)}
            placeholder="owner"
            style={{
              flex: 1,
              minWidth: 0,
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '5px 8px',
              color: '#e6edf3',
              fontSize: 12,
            }}
          />
          <span style={{ color: '#8b949e', alignSelf: 'center' }}>/</span>
          <input
            type="text"
            value={repo}
            onChange={e => setRepo(e.target.value)}
            placeholder="repo"
            style={{
              flex: 1.3,
              minWidth: 0,
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '5px 8px',
              color: '#e6edf3',
              fontSize: 12,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loadingList}
          style={{
            backgroundColor: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '5px 10px',
            color: '#c9d1d9',
            fontSize: 12,
            fontWeight: 500,
            cursor: loadingList ? 'not-allowed' : 'pointer',
          }}
        >
          {loadingList ? 'Loading PRs…' : 'Load Open PRs'}
        </button>
        {listError && (
          <div style={{ fontSize: 11, color: '#f85149' }}>{listError}</div>
        )}
      </form>

      {/* Pull Request List Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
          Pull Requests ({prs.length})
        </span>
        <span style={{ fontSize: 11, color: '#58a6ff' }}>
          {owner}/{repo}
        </span>
      </div>

      {/* PR Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {prs.map(pr => {
          const isSelected = selectedPR?.number === pr.number;
          return (
            <div
              key={pr.number}
              onClick={() => onSelectPR(pr, owner.trim(), repo.trim())}
              style={{
                padding: 12,
                borderRadius: 8,
                border: isSelected ? '1px solid #58a6ff' : '1px solid #21262d',
                backgroundColor: isSelected ? '#161b22' : '#0d1117',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#58a6ff' }}>
                  #{pr.number}
                </span>
                {pr.additions !== undefined && pr.deletions !== undefined && (
                  <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    <span style={{ color: '#3fb950', marginRight: 6 }}>+{pr.additions}</span>
                    <span style={{ color: '#f85149' }}>-{pr.deletions}</span>
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', lineHeight: 1.35, marginBottom: 6 }}>
                {pr.title}
              </div>

              <div style={{ fontSize: 11, color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>by {pr.author}</span>
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: '#8b949e',
                  fontFamily: 'monospace',
                  backgroundColor: '#0d1117',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid #21262d',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pr.sourceBranch} → {pr.targetBranch}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Footer */}
      <div
        style={{
          padding: 14,
          borderTop: '1px solid #21262d',
          backgroundColor: '#161b22',
        }}
      >
        <button
          disabled={!selectedPR || isAnalyzing}
          onClick={() => selectedPR && onAnalyze(selectedPR)}
          style={{
            width: '100%',
            padding: '9px 14px',
            borderRadius: 6,
            border: '1px solid rgba(240, 246, 252, 0.1)',
            backgroundColor: !selectedPR || isAnalyzing ? '#21262d' : '#238636',
            color: !selectedPR || isAnalyzing ? '#8b949e' : '#ffffff',
            fontWeight: 600,
            fontSize: 13,
            cursor: !selectedPR || isAnalyzing ? 'not-allowed' : 'pointer',
          }}
        >
          {isAnalyzing
            ? 'Running Agent A & B…'
            : selectedPR
            ? `Analyze PR #${selectedPR.number}`
            : 'Select a PR to Analyze'}
        </button>
      </div>
    </div>
  );
}
