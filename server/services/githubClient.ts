import { AppError } from '../middleware/errorHandler.js';

/** Default maximum diff size forwarded to the analysis pipeline. */
const DEFAULT_DIFF_MAX_CHARS = 40_000;

/** Lightweight PR metadata returned by listPullRequests. */
export interface GitHubPRSummary {
    number: number;
    title: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    changedFiles: number;
    additions: number;
    deletions: number;
    state: string;
}

/** Full diff + metadata returned by getPullRequestDiff. */
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

/** Shape of a single file entry from GitHub's /pulls/{n}/files endpoint. */
interface GitHubFileEntry {
    filename: string;
    patch?: string;
    status: string;
}

/**
 * Thin GitHub REST API client.
 * Uses native Node 18+ `fetch` — no additional npm packages required.
 *
 * Optional env vars:
 *   GITHUB_TOKEN     – Personal access token. Required for private repos;
 *                      unauthenticated requests are limited to 60 req/hr.
 *   DIFF_MAX_CHARS   – Max diff characters forwarded to the pipeline (default 40 000).
 */
class GitHubClient {
    private readonly token: string | undefined;
    private readonly diffMaxChars: number;
    private readonly baseUrl = 'https://api.github.com';

    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.diffMaxChars = Number(process.env.DIFF_MAX_CHARS) || DEFAULT_DIFF_MAX_CHARS;

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

    private async githubFetch(url: string): Promise<Response> {
        const response = await fetch(url, { headers: this.buildHeaders() });

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
}

// Lazily initialised singleton — mirrors the getWatsonxClient() pattern.
let _instance: GitHubClient | null = null;

export function getGitHubClient(): GitHubClient {
    if (!_instance) {
        _instance = new GitHubClient();
    }
    return _instance;
}
