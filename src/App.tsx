import { useState, useEffect } from 'react';
import type { CoachFinding, RiskScoreBreakdown, ReleaseNotes } from './types/sentinal';
import type { BlastRadiusGraphPayload, PRAnalysisResponse } from '../server/adapters/agentAdapters';
import type { GitHubPRSummary, GitHubPRDiff } from '../server/services/githubClient';

// Lazy imports — components filled in by sub-tasks 2-6
import Sidebar from './components/Sidebar';
import DiffViewer from './components/DiffViewer';
import ResultsTabs from './components/ResultsTabs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  findings: CoachFinding[];
  blastRadius: BlastRadiusGraphPayload;
  riskScore: RiskScoreBreakdown;
  releaseNotes: ReleaseNotes;
  cacheHit: boolean;
  diffTruncated: boolean;
  executionTimeMs: number;
  bobcoinsBilled: number;
  source: 'cache' | 'mock_adapter' | 'watsonx_live';
  githubPR: {
    owner: string;
    repo: string;
    number: number;
    title: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    modifiedFiles: string[];
  };
}

type TabId = 'findings' | 'blast-radius' | 'release-notes';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  // --- Server health ---
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // --- Sidebar / selection state ---
  const [selectedPR, setSelectedPR] = useState<GitHubPRSummary | null>(null);
  // Maps PR number → { owner, repo } so handleAnalyze always has the coordinates.
  const [prCoords, setPrCoords] = useState<Map<number, { owner: string; repo: string }>>(new Map());

  // --- Analysis state ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // --- Diff viewer state ---
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [prMeta, setPrMeta] = useState<GitHubPRDiff['prMeta'] | null>(null);
  const [diffTruncated, setDiffTruncated] = useState(false);

  // --- Tabs state ---
  const [activeTab, setActiveTab] = useState<TabId>('findings');

  // -------------------------------------------------------------------------
  // Health check on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/health')
      .then(r => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
  }, []);

  // -------------------------------------------------------------------------
  // Analyse a GitHub PR
  // -------------------------------------------------------------------------
  async function handleAnalyze(pr: GitHubPRSummary) {
    if (isAnalyzing) return;

    const coords = prCoords.get(pr.number);
    if (!coords) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setDiffContent(null);
    setPrMeta(null);
    setDiffTruncated(false);

    try {
      const response = await fetch('/api/analyze-github-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: coords.owner,
          repo: coords.repo,
          prNumber: pr.number,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? `Server error ${response.status}`);
      }

      const result = data as AnalysisResult;
      setAnalysisResult(result);
      setDiffTruncated(result.diffTruncated ?? false);

      // Build a minimal diff representation from the prMeta for the viewer.
      // The full diff isn't returned in the response body, but prMeta + modifiedFiles
      // give us enough to show context. DiffViewer handles null diff gracefully.
      setPrMeta({
        title: result.githubPR.title,
        author: result.githubPR.author,
        sourceBranch: result.githubPR.sourceBranch,
        targetBranch: result.githubPR.targetBranch,
      });

      // Auto-switch to Findings tab when analysis completes.
      setActiveTab('findings');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Sidebar calls this with owner/repo attached on the PR object so App.tsx
  // can forward them to the API without needing separate state.
  function handleSelectPR(pr: GitHubPRSummary, owner: string, repo: string) {
    setPrCoords(prev => new Map(prev).set(pr.number, { owner, repo }));
    setSelectedPR(pr);
    // Clear previous results when a new PR is selected.
    setAnalysisResult(null);
    setDiffContent(null);
    setPrMeta(null);
    setDiffTruncated(false);
    setAnalysisError(null);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── App Header ───────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: 48,
        borderBottom: '1px solid #21262d',
        backgroundColor: '#161b22',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.3px' }}>
            Sentient Analyst
          </span>
          <span style={{
            fontSize: 11,
            color: '#8b949e',
            backgroundColor: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 4,
            padding: '1px 6px',
          }}>
            PR Analysis
          </span>
        </div>

        {/* Health indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor:
              serverOnline === null ? '#484f58' :
              serverOnline ? '#2ea043' : '#f85149',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, color: '#8b949e' }}>
            {serverOnline === null ? 'Connecting…' : serverOnline ? 'API online' : 'API offline'}
          </span>
        </div>
      </header>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {analysisError && (
        <div style={{
          backgroundColor: '#3d1a1a',
          borderBottom: '1px solid #f8514940',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ color: '#f85149', fontSize: 13 }}>⚠ {analysisError}</span>
          <button
            onClick={() => setAnalysisError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main three-column layout ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: Sidebar */}
        <div style={{
          width: 288,
          flexShrink: 0,
          borderRight: '1px solid #21262d',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Sidebar
            selectedPR={selectedPR}
            isAnalyzing={isAnalyzing}
            onSelectPR={handleSelectPR}
            onAnalyze={(pr) => handleAnalyze(pr)}
          />
        </div>

        {/* Centre: Diff Viewer */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DiffViewer
            diff={diffContent}
            prMeta={prMeta}
            diffTruncated={diffTruncated}
          />
        </div>

        {/* Right: Tabbed Results */}
        <div style={{
          width: 440,
          flexShrink: 0,
          borderLeft: '1px solid #21262d',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <ResultsTabs
            findings={analysisResult?.findings ?? null}
            blastRadius={analysisResult?.blastRadius ?? null}
            riskScore={analysisResult?.riskScore ?? null}
            releaseNotes={analysisResult?.releaseNotes ?? null}
            isLoading={isAnalyzing}
            hasResult={analysisResult !== null}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

      </div>
    </div>
  );
}
