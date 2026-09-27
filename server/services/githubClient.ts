import { MOCK_PRS } from '../../src/data/mockPrData';

/** Default maximum diff size forwarded to the analysis pipeline. */
const DEFAULT_DIFF_MAX_CHARS = 40_000;

/**
 * Default request timeout in milliseconds.
 * Override via GITHUB_REQUEST_TIMEOUT_MS env var.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/** Maximum number of attempts before failing (1 = no retry). */
const MAX_ATTEMPTS = 2;

/** Lightweight PR metadata returned by listPullRequests. */
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
class GitHubClient {
    private readonly token: string | undefined;
    private readonly diffMaxChars: number;
    private readonly timeoutMs: number;
    private readonly baseUrl = 'https://api.github.com';

    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.diffMaxChars = Number(process.env.DIFF_MAX_CHARS) || DEFAULT_DIFF_MAX_CHARS;
        this.timeoutMs = Number(process.env.GITHUB_REQUEST_TIMEOUT_MS) || DEFAULT_REQUEST_TIMEOUT_MS;

        if (!this.token) {
            console.warn(
                '[GitHubClient] GITHUB_TOKEN is not set. ' +
                'Requests to public repos will be subject to the 60 req/hr unauthenticated rate limit. ' +
                'Private repos will not be accessible.'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    private async githubFetch(url: string, attempt = 1): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
            response = await fetch(url, {
                headers: this.buildHeaders(),
                signal: controller.signal,
            });
        } catch (err) {
            clearTimeout(timer);
            const isTimeout =
                err instanceof Error &&
                (err.name === 'AbortError' ||
                 // undici surfaces connect timeouts as TypeError with a ConnectTimeoutError cause
                 (err.name === 'TypeError' && (err as NodeJS.ErrnoException).cause !== undefined));

            if (isTimeout && attempt < MAX_ATTEMPTS) {
                console.warn(`[GitHubClient] Request timed out (attempt ${attempt}/${MAX_ATTEMPTS}), retrying: ${url}`);
                // Brief back-off before retry (500 ms × attempt number).
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                return this.githubFetch(url, attempt + 1);
            }

            throw new AppError(
                `GitHub API request timed out after ${this.timeoutMs}ms. ` +
                'Check your network connectivity or set GITHUB_REQUEST_TIMEOUT_MS to a higher value.',
                504
            );
        } finally {
            clearTimeout(timer);
        }

        // Warn when approaching the rate limit.
        const remaining = Number(response.headers.get('X-RateLimit-Remaining') ?? Infinity);
        if (remaining < 10) {
            console.warn(`[GitHubClient] Rate limit warning: only ${remaining} requests remaining.`);
        }

        if (!response.ok) {
            await this.handleGitHubError(response);
        }

        return response;
    }

    private async handleGitHubError(response: Response): Promise<never> {
        const body = await response.json().catch(() => ({})) as { message?: string };
        const githubMessage = body.message ?? 'Unknown GitHub API error';

        switch (response.status) {
            case 401:
                throw new AppError(`GitHub authentication failed: ${githubMessage}`, 401);
            case 403:
                throw new AppError(`GitHub access forbidden: ${githubMessage}`, 403);
            case 404:
                // A 404 on a private repo without a token is misleading — surface a 401 instead.
                if (!this.token) {
                    throw new AppError(
                        'GitHub returned 404. If this is a private repository, set GITHUB_TOKEN in your environment.',
                        401
                    );
                }
                throw new AppError(`GitHub resource not found: ${githubMessage}`, 404);
            case 422:
                throw new AppError(`GitHub validation error: ${githubMessage}`, 422);
            default:
                throw new AppError(`GitHub API error (${response.status}): ${githubMessage}`, 502);
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * List open pull requests for a repository.
     * Maps to: GET /repos/{owner}/{repo}/pulls?state=open&per_page=20
     */
    async listPullRequests(owner: string, repo: string): Promise<GitHubPRSummary[]> {
        const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=20`;
        const response = await this.githubFetch(url);
        const data = await response.json() as Array<{
            number: number;
            title: string;
            user: { login: string };
            head: { ref: string };
            base: { ref: string };
            changed_files: number;
            additions: number;
            deletions: number;
            state: string;
        }>;

        return data.map(pr => ({
            number: pr.number,
            title: pr.title,
            author: pr.user?.login ?? 'unknown',
            sourceBranch: pr.head?.ref ?? '',
            targetBranch: pr.base?.ref ?? '',
            changedFiles: pr.changed_files ?? 0,
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            state: pr.state,
        }));
    }

    /**
     * Fetch a single PR's unified diff and file list.
     * Uses the /pulls/{n}/files endpoint to get per-file patches and assembles
     * them into a unified diff string prefixed with standard `diff --git` headers.
     * Enforces DIFF_MAX_CHARS truncation before returning.
     */
    async getPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<GitHubPRDiff> {
        if (!Number.isInteger(prNumber) || prNumber < 1) {
            throw new AppError('prNumber must be a positive integer.', 400);
        }

        const base = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

        // Fetch PR metadata and file list in parallel.
        const [metaResponse, filesResponse] = await Promise.all([
            this.githubFetch(`${base}/pulls/${prNumber}`),
            this.githubFetch(`${base}/pulls/${prNumber}/files?per_page=300`),
        ]);

        const meta = await metaResponse.json() as {
            title: string;
            user: { login: string };
            head: { ref: string };
            base: { ref: string };
            changed_files: number;
        };

        const files = await filesResponse.json() as GitHubFileEntry[];

        if (meta.changed_files >= 300) {
            console.warn(
                `[GitHubClient] PR #${prNumber} has ${meta.changed_files} changed files. ` +
                'GitHub caps the /files endpoint at 300 — some files may be missing from the diff.'
            );
        }

        // Assemble unified diff from per-file patches.
        const diffParts: string[] = [];
        const modifiedFiles: string[] = [];

        for (const file of files) {
            modifiedFiles.push(file.filename);
            if (file.patch) {
                diffParts.push(
                    `diff --git a/${file.filename} b/${file.filename}\n` +
                    `--- a/${file.filename}\n` +
                    `+++ b/${file.filename}\n` +
                    file.patch
                );
            }
        }

        let diff = diffParts.join('\n');
        const diffTruncated = diff.length > this.diffMaxChars;
        if (diffTruncated) {
            diff = diff.slice(0, this.diffMaxChars);
        }

        return {
            diff,
            diffTruncated,
            modifiedFiles,
            prMeta: {
                title: meta.title,
                author: meta.user?.login ?? 'unknown',
                sourceBranch: meta.head?.ref ?? '',
                targetBranch: meta.base?.ref ?? '',
            },
        };
    }
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
