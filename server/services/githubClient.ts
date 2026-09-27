import { MOCK_PRS } from '../../src/data/mockPrData';

export interface GitHubPRSummary {
  number: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  updatedAt?: string;
  additions?: number;
  deletions?: number;
  changedFilesCount?: number;
}

export interface GitHubPRDiff {
  diff: string;
  diffTruncated: boolean;
  modifiedFiles: string[];
  prMeta: {
    title: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
  };
}

/**
 * Formats a seeded Mock PR's diffLines into a standard unified git diff string.
 */
export function buildUnifiedDiffFromMockPR(prIdOrNumber: string | number): string {
  const matched = MOCK_PRS.find(
    (p) => p.id === prIdOrNumber || p.number === Number(prIdOrNumber)
  );
  if (!matched) return '';

  return matched.files
    .map((file) => {
      if (file.rawDiff && file.rawDiff.trim().length > 0) {
        return file.rawDiff;
      }
      const header = `diff --git a/${file.filename} b/${file.filename}\n--- a/${file.filename}\n+++ b/${file.filename}`;
      const lines = file.diffLines.map((dl) => dl.content).join('\n');
      return `${header}\n${lines}`;
    })
    .join('\n\n');
}

export async function listRepositoryPRs(owner: string, repo: string): Promise<GitHubPRSummary[]> {
  const isDemoRepo =
    owner.toLowerCase().includes('sentinel') ||
    owner.toLowerCase().includes('demo') ||
    repo.toLowerCase().includes('sentinel');

  if (isDemoRepo) {
    return MOCK_PRS.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author,
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
    }));
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Impact-Sentinel-Bridge',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=25`,
    { headers }
  );

  if (!response.ok) {
    return MOCK_PRS.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author,
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
    }));
  }

  const data = (await response.json()) as Array<{
    number: number;
    title: string;
    user?: { login?: string };
    head?: { ref?: string };
    base?: { ref?: string };
    updated_at?: string;
  }>;

  return data.map((item) => ({
    number: item.number,
    title: item.title,
    author: item.user?.login ?? 'unknown',
    sourceBranch: item.head?.ref ?? 'feature',
    targetBranch: item.base?.ref ?? 'main',
    updatedAt: item.updated_at,
  }));
}

export async function fetchGitHubPRDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPRDiff> {
  const matchedMock = MOCK_PRS.find((p) => p.number === Number(prNumber));
  if (matchedMock) {
    return {
      diff: buildUnifiedDiffFromMockPR(matchedMock.id),
      diffTruncated: false,
      modifiedFiles: matchedMock.files.map((f) => f.filename),
      prMeta: {
        title: matchedMock.title,
        author: matchedMock.author,
        sourceBranch: matchedMock.sourceBranch,
        targetBranch: matchedMock.targetBranch,
      },
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Impact-Sentinel-Bridge',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const metaRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`,
    { headers }
  );
  if (!metaRes.ok) {
    throw new Error(`Failed to fetch PR #${prNumber} from ${owner}/${repo} (HTTP ${metaRes.status})`);
  }
  const metaJson = (await metaRes.json()) as {
    title?: string;
    user?: { login?: string };
    head?: { ref?: string };
    base?: { ref?: string };
  };

  const diffRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`,
    {
      headers: {
        ...headers,
        Accept: 'application/vnd.github.v3.diff',
      },
    }
  );
  const rawDiff = diffRes.ok ? await diffRes.text() : '';
  const MAX_DIFF_CHARS = 60_000;
  const diffTruncated = rawDiff.length > MAX_DIFF_CHARS;
  const diff = diffTruncated ? rawDiff.slice(0, MAX_DIFF_CHARS) : rawDiff;
  const modifiedFiles = [...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);

  return {
    diff: diff || `--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new`,
    diffTruncated,
    modifiedFiles,
    prMeta: {
      title: metaJson.title ?? `PR #${prNumber}`,
      author: metaJson.user?.login ?? 'github-user',
      sourceBranch: metaJson.head?.ref ?? 'feature',
      targetBranch: metaJson.base?.ref ?? 'main',
    },
  };
}
