import { useState } from 'react';
import { Loader2, Search, GitPullRequest, GitBranch, ChevronRight } from 'lucide-react';
import type { GitHubPRSummary } from '../../server/services/githubClient';

interface Props {
  selectedPR: GitHubPRSummary | null;
  isAnalyzing: boolean;
  onSelectPR: (pr: GitHubPRSummary, owner: string, repo: string) => void;
  onAnalyze: (pr: GitHubPRSummary) => void;
}

export default function Sidebar({ selectedPR, isAnalyzing, onSelectPR, onAnalyze }: Props) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [prs, setPrs] = useState<GitHubPRSummary[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<{ owner: string; repo: string } | null>(null);

  async function handleFetch() {
    if (!owner.trim() || !repo.trim()) return;
    setFetchLoading(true);
    setFetchError(null);
    setPrs([]);

    try {
      const res = await fetch(
        `/api/github/prs?owner=${encodeURIComponent(owner.trim())}&repo=${encodeURIComponent(repo.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setPrs(data.pullRequests ?? []);
      setLastFetched({ owner: owner.trim(), repo: repo.trim() });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch PRs.');
    } finally {
      setFetchLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleFetch();
  }

  const canAnalyze = selectedPR !== null && !isAnalyzing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d1117' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Repository
        </div>

        {/* Owner input */}
        <input
          value={owner}
          onChange={e => setOwner(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="owner"
          style={inputStyle}
        />

        {/* Repo input */}
        <input
          value={repo}
          onChange={e => setRepo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="repository"
          style={{ ...inputStyle, marginTop: 6 }}
        />

        {/* Fetch button */}
        <button
          onClick={handleFetch}
          disabled={fetchLoading || !owner.trim() || !repo.trim()}
          style={{
            ...buttonStyle,
            marginTop: 8,
            opacity: fetchLoading || !owner.trim() || !repo.trim() ? 0.5 : 1,
            cursor: fetchLoading || !owner.trim() || !repo.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {fetchLoading
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Fetching…</>
            : <><Search size={13} /> Fetch PRs</>}
        </button>

        {/* Repo label after fetch */}
        {lastFetched && !fetchLoading && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#58a6ff', display: 'flex', alignItems: 'center', gap: 4 }}>
            <GitBranch size={11} />
            {lastFetched.owner}/{lastFetched.repo}
            <span style={{ color: '#8b949e' }}>· {prs.length} open PR{prs.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Error */}
        {fetchError && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#f85149', lineHeight: 1.4 }}>
            ⚠ {fetchError}
          </div>
        )}
      </div>

      {/* ── PR list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {prs.length === 0 && !fetchLoading && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#484f58', fontSize: 13 }}>
            {lastFetched
              ? 'No open pull requests found.'
              : 'Enter a repo above to load pull requests.'}
          </div>
        )}

        {prs.map(pr => {
          const isSelected = selectedPR?.number === pr.number;
          return (
            <button
              key={pr.number}
              onClick={() => onSelectPR(pr, lastFetched!.owner, lastFetched!.repo)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: isSelected ? '#161b22' : 'transparent',
                border: 'none',
                borderLeft: isSelected ? '2px solid #58a6ff' : '2px solid transparent',
                padding: '10px 14px 10px 12px',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = '#161b2280'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {/* PR number + title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <GitPullRequest size={13} style={{ color: '#3fb950', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: isSelected ? '#e6edf3' : '#c9d1d9', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pr.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                    #{pr.number} · {pr.author}
                  </div>
                </div>
                {isSelected && <ChevronRight size={12} style={{ color: '#58a6ff', flexShrink: 0, marginTop: 2 }} />}
              </div>

              {/* Branch */}
              <div style={{ fontSize: 11, color: '#484f58', marginTop: 4, marginLeft: 19, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pr.sourceBranch} → {pr.targetBranch}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4, marginLeft: 19 }}>
                <span style={{ fontSize: 11, color: '#3fb950' }}>+{pr.additions}</span>
                <span style={{ fontSize: 11, color: '#f85149' }}>-{pr.deletions}</span>
                <span style={{ fontSize: 11, color: '#8b949e' }}>{pr.changedFiles} file{pr.changedFiles !== 1 ? 's' : ''}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Analyse button ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #21262d', flexShrink: 0 }}>
        <button
          onClick={() => selectedPR && onAnalyze(selectedPR)}
          disabled={!canAnalyze}
          style={{
            ...buttonStyle,
            backgroundColor: canAnalyze ? '#238636' : '#21262d',
            borderColor: canAnalyze ? '#2ea043' : '#30363d',
            opacity: canAnalyze ? 1 : 0.6,
            cursor: canAnalyze ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {isAnalyzing
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</>
            : '⚡ Analyse PR'}
        </button>

        {selectedPR && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#8b949e', textAlign: 'center' }}>
            PR #{selectedPR.number} selected
          </div>
        )}
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared micro-styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: '#e6edf3',
  fontSize: 13,
  padding: '6px 10px',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  padding: '7px 12px',
  borderRadius: 6,
  border: '1px solid #30363d',
  backgroundColor: '#21262d',
  color: '#e6edf3',
  fontSize: 12,
  cursor: 'pointer',
};
