import type { PullRequest, BobSessionLog } from "../types/sentinal";

export const MORK_PRS: PullRequest[] = [
    {
        id: 'pr-142',
        number: 142,
        title: 'feat(auth): Refactor Auth Middleware & JWT Session Payload',
        author: 'alex-dev (Lead Engineer)',
        targetBranch: 'main',
        sourceBranch: 'refactor/auth-jwt-payload-v2',
        commitHash: 'e4f9b21',
        changedFilesCount: 3,
        additions: 124,
        deletions: 48,
        estimatedTokens: {
            promptTokens: 1420,
            completionTokens: 890,
            bobcoinCost: 0.82
        },
        riskScore: {
            overallScore: 82,
            riskTier: 'CRITICAL',
            factors: {
                breakingApiSurface: 32, // out of 35
                downstreamFanout: 22,    // out of 25
                securityCriticality: 20, // out of 25
                testCoverageDelta: 8     // out of 15
            },
            summary: 'Critical downstream blast radius: 5 core microservices import the modified TokenPayload interface. Missing algorithm verification on JWT decode introduces authentication bypass vulnerability.'
        },
        files: [
            {
                filename: 'src/middleware/authMiddleware.ts',
                additions: 54,
                deletions: 18,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -24,18 +24,24 @@ export async function verifyToken(req: Request, res: Response, next: NextFunction)' },
                    { type: 'context', oldLineNumber: 24, newLineNumber: 24, content: '  const authHeader = req.headers.authorization;' },
                    { type: 'context', oldLineNumber: 25, newLineNumber: 25, content: '  if (!authHeader?.startsWith("Bearer ")) {' },
                    { type: 'context', oldLineNumber: 26, newLineNumber: 26, content: '    return res.status(401).json({ error: "Missing authorization token" });' },
                    { type: 'context', oldLineNumber: 27, newLineNumber: 27, content: '  }' },
                    { type: 'deletion', oldLineNumber: 28, content: '- const token = authHeader.split(" ")[1];' },
                    { type: 'deletion', oldLineNumber: 29, content: '- const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["RS256"] }) as LegacyPayload;' },
                    { type: 'addition', newLineNumber: 28, content: '+ const rawToken = authHeader.substring(7);' },
                    { type: 'addition', newLineNumber: 29, content: '+ // Refactored to allow unverified payload peek for rapid tenant routing', hasFinding: true, findingId: 'finding-1' },
                    { type: 'addition', newLineNumber: 30, content: '+ const decoded = jwt.decode(rawToken) as UserSessionPayload;', hasFinding: true, findingId: 'finding-1' },
                    { type: 'context', oldLineNumber: 30, newLineNumber: 31, content: '  if (!decoded || !decoded.userId) {' },
                    { type: 'context', oldLineNumber: 31, newLineNumber: 32, content: '    return res.status(403).json({ error: "Invalid token payload" });' },
                    { type: 'context', oldLineNumber: 32, newLineNumber: 33, content: '  }' },
                    { type: 'deletion', oldLineNumber: 33, content: '- req.user = { id: decoded.userId, role: decoded.role };' },
                    { type: 'addition', newLineNumber: 34, content: '+ req.user = { id: decoded.userId, orgId: decoded.tenantId, perms: decoded.permissions };', hasFinding: true, findingId: 'finding-2' },
                    { type: 'addition', newLineNumber: 35, content: '+ (req as any).rawToken = rawToken;' },
                    { type: 'context', oldLineNumber: 34, newLineNumber: 36, content: '  next();' },
                    { type: 'header', content: '@@ -62,10 +68,14 @@ export function requirePermission(permission: string)' },
                    { type: 'context', oldLineNumber: 62, newLineNumber: 68, content: '  return (req: Request, res: Response, next: NextFunction) => {' },
                    { type: 'deletion', oldLineNumber: 63, content: '-   if (!req.user?.perms?.includes(permission)) {' },
                    { type: 'addition', newLineNumber: 69, content: '+   const hasRole = req.user?.perms?.some((p: string) => p === permission || p === "admin:*");' },
                    { type: 'addition', newLineNumber: 70, content: '+   if (!hasRole) {' },
                    { type: 'context', oldLineNumber: 64, newLineNumber: 71, content: '      return res.status(403).json({ error: "Forbidden" });' },
                    { type: 'context', oldLineNumber: 65, newLineNumber: 72, content: '    }' },
                    { type: 'addition', newLineNumber: 73, content: '+   // FIXME: Memory cache without TTL eviction could leak during peak load', hasFinding: true, findingId: 'finding-3' },
                    { type: 'addition', newLineNumber: 74, content: '+   sessionMemCache.set(req.user.id, Date.now());', hasFinding: true, findingId: 'finding-3' },
                    { type: 'context', oldLineNumber: 66, newLineNumber: 75, content: '    next();' }
                ]
            },
            {
                filename: 'src/types/auth.ts',
                additions: 38,
                deletions: 16,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -12,12 +12,18 @@ export interface LegacyPayload {' },
                    { type: 'deletion', oldLineNumber: 12, content: '- export interface UserSessionPayload {' },
                    { type: 'deletion', oldLineNumber: 13, content: '-   userId: string;' },
                    { type: 'deletion', oldLineNumber: 14, content: '-   role: "admin" | "member" | "viewer";' },
                    { type: 'deletion', oldLineNumber: 15, content: '-   issuedAt: number;' },
                    { type: 'addition', newLineNumber: 12, content: '+ export interface UserSessionPayload {' },
                    { type: 'addition', newLineNumber: 13, content: '+   userId: string;' },
                    { type: 'addition', newLineNumber: 14, content: '+   tenantId: string; // BREAKING: Replaced workspaceId with tenantId' },
                    { type: 'addition', newLineNumber: 15, content: '+   permissions: string[]; // BREAKING: Removed role in favor of explicit perms' },
                    { type: 'addition', newLineNumber: 16, content: '+   exp: number;' },
                    { type: 'context', oldLineNumber: 16, newLineNumber: 17, content: ' }' }
                ]
            },
            {
                filename: 'src/services/sessionStore.ts',
                additions: 32,
                deletions: 14,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -45,8 +45,15 @@ export class SessionStore {' },
                    { type: 'context', oldLineNumber: 45, newLineNumber: 45, content: '  async revokeSession(userId: string): Promise<void> {' },
                    { type: 'addition', newLineNumber: 46, content: '+   // Unhandled promise rejection if Redis cluster reconnects', hasFinding: true, findingId: 'finding-4' },
                    { type: 'addition', newLineNumber: 47, content: '+   this.redisClient.del(`session:${userId}`);', hasFinding: true, findingId: 'finding-4' },
                    { type: 'context', oldLineNumber: 46, newLineNumber: 48, content: '    this.emit("session:revoked", { userId });' },
                    { type: 'context', oldLineNumber: 47, newLineNumber: 49, content: '  }' }
                ]
            }
        ],
        findings: [
            {
                id: 'finding-1',
                line: 30,
                file: 'src/middleware/authMiddleware.ts',
                category: 'security',
                severity: 'critical',
                title: 'Authentication Bypass: jwt.decode() used instead of jwt.verify()',
                description: 'Line 30 uses `jwt.decode(rawToken)` which decodes the payload WITHOUT verifying cryptographic signature against RS256/HMAC secret.',
                educationalRationale: 'OWASP A07:2021 (Identification and Authentication Failures). Using decode without signature verification allows any malicious actor to forge a JWT with `userId: "superadmin"` and arbitrary permissions.',
                suggestedFix: `const decoded = jwt.verify(rawToken, process.env.JWT_PUBLIC_KEY!, {
  algorithms: ['RS256'],
  issuer: 'auth.sentinel.internal'
}) as UserSessionPayload;`,
                codeSnippet: 'const decoded = jwt.decode(rawToken) as UserSessionPayload;',
                ruleViolated: 'SEC-004: All inbound Bearer tokens must be cryptographically validated with verified algorithms.'
            },
            {
                id: 'finding-2',
                line: 34,
                file: 'src/middleware/authMiddleware.ts',
                category: 'architectural',
                severity: 'high',
                title: 'Breaking Schema Change in req.user Context Interface',
                description: 'Replacing `req.user.role` with `req.user.perms` and `tenantId` breaks existing downstream handlers that expect `req.user.role`.',
                educationalRationale: 'Liskov Substitution & Interface Segregation Principles. Sudden deletion of properties on shared Express request context breaks downstream middleware or controllers without compile-time warnings unless strict typing is enforced.',
                suggestedFix: `// Maintain backward compatibility with deprecated getter or legacy role fallback:
req.user = {
  id: decoded.userId,
  orgId: decoded.tenantId,
  perms: decoded.permissions,
  get role(): string {
    return this.perms.includes('admin:*') ? 'admin' : 'member';
  }
};`,
                codeSnippet: 'req.user = { id: decoded.userId, orgId: decoded.tenantId, perms: decoded.permissions };',
                ruleViolated: 'ARCH-012: Context object properties must be deprecated over a 2-minor release window.'
            },
            {
                id: 'finding-3',
                line: 74,
                file: 'src/middleware/authMiddleware.ts',
                category: 'performance',
                severity: 'high',
                title: 'Unbounded In-Memory Cache Leak in sessionMemCache',
                description: '`sessionMemCache.set(req.user.id, Date.now())` does not enforce maximum size (LRU) or TTL eviction.',
                educationalRationale: 'Under high traffic (e.g. 100k unique visitors), an unbounded V8 Map will grow monotonically until the Node.js process exhausts heap limits and triggers an OOM termination.',
                suggestedFix: `import { LRUCache } from 'lru-cache';

const sessionMemCache = new LRUCache<string, number>({
  max: 50_000,
  ttl: 1000 * 60 * 15 // 15 mins
});`,
                codeSnippet: 'sessionMemCache.set(req.user.id, Date.now());',
                ruleViolated: 'PERF-008: In-memory state collections must be capped with explicit LRU or TTL boundaries.'
            },
            {
                id: 'finding-4',
                line: 47,
                file: 'src/services/sessionStore.ts',
                category: 'solid_dry',
                severity: 'medium',
                title: 'Missing await / Promise Rejection Handling on Redis Del',
                description: 'Calling `this.redisClient.del(...)` without `await` or `.catch()` causes an unhandled promise rejection if Redis disconnects.',
                educationalRationale: 'In Node.js 16+, unhandled rejections terminate the event loop. Furthermore, failure to await means the session is not guaranteed to be revoked when `revokeSession` resolves.',
                suggestedFix: `try {
  await this.redisClient.del(\`session:\${userId}\`);
} catch (err) {
  logger.error({ err, userId }, 'Failed to revoke session from Redis store');
  throw new SessionStoreError('Redis revocation failure', { cause: err });
}`,
                codeSnippet: 'this.redisClient.del(`session:${userId}`);',
                ruleViolated: 'REL-002: All async I/O operations must be awaited with explicit error boundaries.'
            }
        ],
        dependencyGraph: {
            nodes: [
                {
                    id: 'authMiddleware',
                    label: 'authMiddleware.ts',
                    type: 'modified_file',
                    risk: 'critical',
                    fanoutCount: 7,
                    tier: 0,
                    description: 'PR Root: Modified token extraction and validation logic.'
                },
                {
                    id: 'authTypes',
                    label: 'types/auth.ts',
                    type: 'modified_file',
                    risk: 'high',
                    fanoutCount: 5,
                    tier: 0,
                    description: 'PR Root: TokenPayload interface altered (role removed, tenantId added).'
                },
                {
                    id: 'userService',
                    label: 'UserService',
                    type: 'direct_consumer',
                    risk: 'critical',
                    fanoutCount: 3,
                    tier: 1,
                    description: 'Direct consumer: Reads req.user.role to enforce profile update permissions.'
                },
                {
                    id: 'billingService',
                    label: 'BillingGateway',
                    type: 'direct_consumer',
                    risk: 'high',
                    fanoutCount: 2,
                    tier: 1,
                    description: 'Direct consumer: Uses req.user.workspaceId which was renamed to tenantId.'
                },
                {
                    id: 'graphqlGateway',
                    label: 'GraphQL /api/v1/query',
                    type: 'api_endpoint',
                    risk: 'critical',
                    fanoutCount: 12,
                    tier: 2,
                    description: 'Downstream endpoint: 12 external mobile & web clients query this gateway.'
                },
                {
                    id: 'notificationWorker',
                    label: 'NotificationWorker',
                    type: 'service',
                    risk: 'medium',
                    fanoutCount: 1,
                    tier: 2,
                    description: 'Downstream queue listener: Listens for session:revoked events.'
                },
                {
                    id: 'userDbModel',
                    label: 'PostgreSQL "users" Table',
                    type: 'database_model',
                    risk: 'low',
                    fanoutCount: 0,
                    tier: 3,
                    description: 'Underlying data store: Schema intact, but session invalidation table may see surge.'
                }
            ],
            edges: [
                { source: 'authMiddleware', target: 'userService', relation: 'invokes', isBreakingChange: true },
                { source: 'authMiddleware', target: 'billingService', relation: 'invokes', isBreakingChange: true },
                { source: 'authTypes', target: 'userService', relation: 'imports', isBreakingChange: true },
                { source: 'authTypes', target: 'billingService', relation: 'imports', isBreakingChange: true },
                { source: 'userService', target: 'graphqlGateway', relation: 'exposes', isBreakingChange: true },
                { source: 'billingService', target: 'graphqlGateway', relation: 'exposes', isBreakingChange: false },
                { source: 'authMiddleware', target: 'notificationWorker', relation: 'invokes', isBreakingChange: false },
                { source: 'userService', target: 'userDbModel', relation: 'queries', isBreakingChange: false }
            ]
        },
        blastRadiusTable: [
            {
                dependentComponent: 'src/services/billingGateway.ts',
                componentType: 'Microservice',
                impactType: 'Breaking API Contract',
                severity: 'critical',
                affectedCallers: 8,
                recommendedTest: 'Run e2e/billing-checkout.spec.ts with new UserSessionPayload'
            },
            {
                dependentComponent: 'src/controllers/userController.ts',
                componentType: 'Express Controller',
                impactType: 'Runtime Error Risk',
                severity: 'high',
                affectedCallers: 14,
                recommendedTest: 'Unit test userController with mocked req.user.role undefined'
            },
            {
                dependentComponent: 'src/api/graphql/context.ts',
                componentType: 'API Gateway Context',
                impactType: 'Breaking API Contract',
                severity: 'critical',
                affectedCallers: 22,
                recommendedTest: 'Verify Apollo GraphQL Context builder against new JWT claim shape'
            },
            {
                dependentComponent: 'src/workers/notificationQueue.ts',
                componentType: 'Background Worker',
                impactType: 'Cache Invalidation Gap',
                severity: 'medium',
                affectedCallers: 4,
                recommendedTest: 'Assert session:revoked event payload emits numeric userId string'
            }
        ],
        releaseNotes: {
            title: 'Release Notes: Auth Token Modernization & RBAC Transition (PR #142)',
            versionTarget: 'v2.14.0',
            executiveSummary: 'This PR overhauls JWT session verification to support multi-tenant granular permissions. NOTE: Contains BREAKING CHANGES to req.user context and requires coordinated deployment across User and Billing services.',
            breakingChanges: [
                'Removed `req.user.role` in favor of array-based `req.user.perms`. Any controller reading `req.user.role` will receive undefined unless patched.',
                'Renamed `workspaceId` claim to `tenantId` in the JWT payload.',
                'Token payload now requires RS256 signature verification with public key rotation.'
            ],
            downstreamServicesToAlert: [
                'Billing Team (@billing-squad): Update webhook authentication to read tenantId.',
                'Frontend Web Team (@core-ui): Update client-side JWT decoder for new claims structure.',
                'Mobile Team (@ios-android-squad): Minimum app version v3.4 required for new token claims.'
            ],
            qaChecklist: [
                { id: 'qa-1', item: 'Verify unauthenticated request returns HTTP 401 with structured JSON error', checked: true },
                { id: 'qa-2', item: 'Test invalid/tampered signature rejection with HTTP 403', checked: false },
                { id: 'qa-3', item: 'Assert backward-compatibility fallback for legacy mobile tokens with "role" field', checked: false },
                { id: 'qa-4', item: 'Stress test in-memory cache under 5,000 req/sec for memory leaks', checked: false },
                { id: 'qa-5', item: 'Simulate Redis disconnection during session revocation', checked: true }
            ],
            rollbackPlan: [
                '1. Set FEATURE_FLAG_NEW_JWT_VERIFIER=false in LaunchDarkly / env vars to switch back to v1 RS256 validator.',
                '2. If Docker containers have deployed, run `kubectl rollout undo deployment/api-gateway`.',
                '3. Invalidate active Redis session cache keys matching pattern `session:*` if corrupted.'
            ]
        }
    },
    {
        id: 'pr-143',
        number: 143,
        title: 'perf(db): Connection Pooling & Read-Replica Query Routing',
        author: 'sara-backend (Senior DB Architect)',
        targetBranch: 'main',
        sourceBranch: 'perf/db-pool-routing',
        commitHash: '8b71a0c',
        changedFilesCount: 2,
        additions: 86,
        deletions: 34,
        estimatedTokens: {
            promptTokens: 1100,
            completionTokens: 620,
            bobcoinCost: 0.58
        },
        riskScore: {
            overallScore: 54,
            riskTier: 'MODERATE',
            factors: {
                breakingApiSurface: 10,
                downstreamFanout: 18,
                securityCriticality: 12,
                testCoverageDelta: 14
            },
            summary: 'Moderate blast radius: Changes connection lifecycle for all read operations across Order and Inventory domains. Risk of connection starvation if client release is missed in catch blocks.'
        },
        files: [
            {
                filename: 'src/database/connectionPool.ts',
                additions: 48,
                deletions: 16,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -30,12 +30,18 @@ export class DatabaseManager {' },
                    { type: 'context', oldLineNumber: 30, newLineNumber: 30, content: '  async executeQuery<T>(sql: string, params: any[]): Promise<T[]> {' },
                    { type: 'deletion', oldLineNumber: 31, content: '-   const client = await this.primaryPool.connect();' },
                    { type: 'addition', newLineNumber: 31, content: '+   const pool = this.isReadOnlyQuery(sql) ? this.replicaPool : this.primaryPool;' },
                    { type: 'addition', newLineNumber: 32, content: '+   const client = await pool.connect();' },
                    { type: 'context', oldLineNumber: 32, newLineNumber: 33, content: '    try {' },
                    { type: 'context', oldLineNumber: 33, newLineNumber: 34, content: '      const result = await client.query(sql, params);' },
                    { type: 'context', oldLineNumber: 34, newLineNumber: 35, content: '      return result.rows;' },
                    { type: 'addition', newLineNumber: 36, content: '+   } catch (err) {' },
                    { type: 'addition', newLineNumber: 37, content: '+     // Potential connection leak: client.release() is missing in error block', hasFinding: true, findingId: 'finding-db-1' },
                    { type: 'addition', newLineNumber: 38, content: '+     throw err;' },
                    { type: 'context', oldLineNumber: 35, newLineNumber: 39, content: '    } finally {' },
                    { type: 'context', oldLineNumber: 36, newLineNumber: 40, content: '      client.release();' },
                    { type: 'context', oldLineNumber: 37, newLineNumber: 41, content: '    }' }
                ]
            },
            {
                filename: 'src/database/queryRouter.ts',
                additions: 38,
                deletions: 18,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -15,8 +15,12 @@ export function isReadOnlyQuery(sql: string): boolean {' },
                    { type: 'context', oldLineNumber: 15, newLineNumber: 15, content: '  const trimmed = sql.trim().toLowerCase();' },
                    { type: 'addition', newLineNumber: 16, content: '+ // Flawed heuristic: "SELECT ... FOR UPDATE" routes to read replica', hasFinding: true, findingId: 'finding-db-2' },
                    { type: 'addition', newLineNumber: 17, content: '+ return trimmed.startsWith("select");', hasFinding: true, findingId: 'finding-db-2' },
                    { type: 'deletion', oldLineNumber: 16, content: '- return /^select(?!.*for\\s+update)/i.test(trimmed);' }
                ]
            }
        ],
        findings: [
            {
                id: 'finding-db-1',
                line: 37,
                file: 'src/database/connectionPool.ts',
                category: 'performance',
                severity: 'medium',
                title: 'Redundant catch block with missing structured logging',
                description: 'While `client.release()` is called in `finally`, the raw `throw err` does not annotate the query context or pool metrics.',
                educationalRationale: 'Clean Code & Reliability: Re-throwing raw database driver errors directly exposes internal SQL table topologies in API error responses.',
                suggestedFix: `} catch (err) {
  logger.error({ sql, params, error: err }, 'Database query execution failed');
  throw new DatabaseQueryError('Failed to execute database query', { cause: err });
}`,
                codeSnippet: '} catch (err) { throw err; }',
                ruleViolated: 'ERR-003: Database drivers must wrap low-level errors into domain-specific exception types.'
            },
            {
                id: 'finding-db-2',
                line: 17,
                file: 'src/database/queryRouter.ts',
                category: 'security',
                severity: 'high',
                title: 'Row Lock Bypass: SELECT ... FOR UPDATE routed to Read-Only Replica',
                description: 'The naive check `trimmed.startsWith("select")` causes pessimistic locking queries (`SELECT ... FOR UPDATE`) to route to read replicas, which fail with Postgres ReadOnlyTransaction errors or fail to lock rows.',
                educationalRationale: 'Pessimistic locking requires writing WAL locks on the primary master database. Directing this to a streaming read-replica creates transactional race conditions in inventory deduction.',
                suggestedFix: `export function isReadOnlyQuery(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  const isSelect = normalized.startsWith('select');
  const hasLockingClause = /\\bfor\\s+(update|no\\s+key\\s+update|share|key\\s+share)\\b/i.test(normalized);
  return isSelect && !hasLockingClause;
}`,
                codeSnippet: 'return trimmed.startsWith("select");',
                ruleViolated: 'SQL-005: Locking queries must always execute against the primary transaction master.'
            }
        ],
        dependencyGraph: {
            nodes: [
                { id: 'dbPool', label: 'connectionPool.ts', type: 'modified_file', risk: 'high', fanoutCount: 4, tier: 0, description: 'Core connection pool manager' },
                { id: 'queryRouter', label: 'queryRouter.ts', type: 'modified_file', risk: 'high', fanoutCount: 3, tier: 0, description: 'SQL heuristic router' },
                { id: 'orderRepo', label: 'OrderRepository', type: 'service', risk: 'high', fanoutCount: 2, tier: 1, description: 'Executes SELECT FOR UPDATE on stock allocations' },
                { id: 'inventoryRepo', label: 'InventoryRepository', type: 'service', risk: 'critical', fanoutCount: 1, tier: 1, description: 'Manages warehouse reservation counters' },
                { id: 'checkoutApi', label: 'POST /api/v1/checkout', type: 'api_endpoint', risk: 'high', fanoutCount: 8, tier: 2, description: 'Checkout checkout flow' },
                { id: 'pgReplica', label: 'Postgres Replica Cluster', type: 'database_model', risk: 'medium', fanoutCount: 0, tier: 3, description: 'Read-only mirror' }
            ],
            edges: [
                { source: 'dbPool', target: 'orderRepo', relation: 'invokes', isBreakingChange: false },
                { source: 'queryRouter', target: 'dbPool', relation: 'imports', isBreakingChange: false },
                { source: 'orderRepo', target: 'inventoryRepo', relation: 'invokes', isBreakingChange: false },
                { source: 'orderRepo', target: 'checkoutApi', relation: 'exposes', isBreakingChange: false },
                { source: 'dbPool', target: 'pgReplica', relation: 'queries', isBreakingChange: false }
            ]
        },
        blastRadiusTable: [
            {
                dependentComponent: 'src/repositories/inventoryRepository.ts',
                componentType: 'Repository Service',
                impactType: 'Runtime Error Risk',
                severity: 'critical',
                affectedCallers: 6,
                recommendedTest: 'Run concurrent reservation integration test with simulated stock depletion'
            },
            {
                dependentComponent: 'src/api/checkout/checkoutHandler.ts',
                componentType: 'Express Handler',
                impactType: 'Runtime Error Risk',
                severity: 'high',
                affectedCallers: 12,
                recommendedTest: 'Verify checkout idempotent rollback when read-replica lock fails'
            }
        ],
        releaseNotes: {
            title: 'Release Notes: Read Replica Query Routing (PR #143)',
            versionTarget: 'v2.14.0-rc2',
            executiveSummary: 'Implements read-replica connection routing to alleviate primary database load by 40%. Requires verification of transactional SELECT FOR UPDATE queries.',
            breakingChanges: [
                'Read operations now execute against PostgreSQL streaming replicas with eventual consistency lag (max 100ms).'
            ],
            downstreamServicesToAlert: [
                'Database Ops: Monitor replica connection saturation during launch.'
            ],
            qaChecklist: [
                { id: 'qa-db-1', item: 'Validate replica failover behavior when replica pool goes offline', checked: true },
                { id: 'qa-db-2', item: 'Ensure SELECT ... FOR UPDATE routes strictly to primary master', checked: false }
            ],
            rollbackPlan: [
                'Disable USE_READ_REPLICAS=false in environment configuration to fall back to unified primary pool.'
            ]
        }
    },
    {
        id: 'pr-144',
        number: 144,
        title: 'fix(billing): Stripe Webhook Idempotency & Distributed Lock',
        author: 'elena-fintech (Payment Engineer)',
        targetBranch: 'main',
        sourceBranch: 'fix/stripe-idempotency-key',
        commitHash: '2c9e71f',
        changedFilesCount: 2,
        additions: 64,
        deletions: 12,
        estimatedTokens: {
            promptTokens: 890,
            completionTokens: 480,
            bobcoinCost: 0.44
        },
        riskScore: {
            overallScore: 68,
            riskTier: 'HIGH',
            factors: {
                breakingApiSurface: 8,
                downstreamFanout: 24,
                securityCriticality: 22,
                testCoverageDelta: 14
            },
            summary: 'High financial criticality: Webhook retry logic protects against double-charge occurrences, but Redis key expiration without transaction safety risks silent ledger discrepancies.'
        },
        files: [
            {
                filename: 'src/webhooks/stripeWebhookHandler.ts',
                additions: 44,
                deletions: 8,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -18,8 +18,14 @@ export async function handleStripeWebhook(event: Stripe.Event)' },
                    { type: 'context', oldLineNumber: 18, newLineNumber: 18, content: '  const eventId = event.id;' },
                    { type: 'addition', newLineNumber: 19, content: '+ const lockAcquired = await redis.set(`lock:event:${eventId}`, "1", "NX", "EX", 30);' },
                    { type: 'addition', newLineNumber: 20, content: '+ if (!lockAcquired) {' },
                    { type: 'addition', newLineNumber: 21, content: '+   return { status: 200, message: "Duplicate event suppressed" };' },
                    { type: 'addition', newLineNumber: 22, content: '+ }' },
                    { type: 'context', oldLineNumber: 19, newLineNumber: 23, content: '  switch (event.type) {' },
                    { type: 'context', oldLineNumber: 20, newLineNumber: 24, content: '    case "payment_intent.succeeded":' },
                    { type: 'addition', newLineNumber: 25, content: '+     // Missing atomic database transaction wrapper around ledger credit', hasFinding: true, findingId: 'finding-pay-1' },
                    { type: 'addition', newLineNumber: 26, content: '+     await creditCustomerLedger(event.data.object as Stripe.PaymentIntent);', hasFinding: true, findingId: 'finding-pay-1' }
                ]
            }
        ],
        findings: [
            {
                id: 'finding-pay-1',
                line: 26,
                file: 'src/webhooks/stripeWebhookHandler.ts',
                category: 'security',
                severity: 'high',
                title: 'Non-Atomic Financial Ledger Mutation in Webhook Processor',
                description: '`creditCustomerLedger()` updates the customer account balance without an enclosing database transaction (`BEGIN...COMMIT`). If invoice issuance fails immediately after, the ledger and invoice become desynchronized.',
                educationalRationale: 'ACID guarantees in financial domains: Multi-entity mutations (Ledger Balance + Invoice Receipt + Subscription State) must be coordinated inside a single database transaction with idempotency verification.',
                suggestedFix: `await db.transaction(async (trx) => {
  await creditCustomerLedger(paymentIntent, { trx });
  await markInvoicePaid(paymentIntent.invoiceId, { trx });
  await recordAuditLog({ eventId: event.id, amount: paymentIntent.amount }, { trx });
});`,
                codeSnippet: 'await creditCustomerLedger(event.data.object as Stripe.PaymentIntent);',
                ruleViolated: 'FIN-001: All monetary mutations must be wrapped in ACID transactions.'
            }
        ],
        dependencyGraph: {
            nodes: [
                { id: 'stripeWebhook', label: 'stripeWebhookHandler.ts', type: 'modified_file', risk: 'high', fanoutCount: 3, tier: 0, description: 'Inbound Stripe webhook endpoint' },
                { id: 'ledgerService', label: 'CustomerLedgerService', type: 'service', risk: 'critical', fanoutCount: 2, tier: 1, description: 'Credits account balance' },
                { id: 'invoiceService', label: 'InvoiceService', type: 'service', risk: 'high', fanoutCount: 1, tier: 1, description: 'Generates receipts' },
                { id: 'stripeApi', label: 'POST /webhooks/stripe', type: 'api_endpoint', risk: 'high', fanoutCount: 1, tier: 2, description: 'Stripe external webhook entry point' }
            ],
            edges: [
                { source: 'stripeWebhook', target: 'ledgerService', relation: 'invokes', isBreakingChange: false },
                { source: 'stripeWebhook', target: 'invoiceService', relation: 'invokes', isBreakingChange: false },
                { source: 'stripeApi', target: 'stripeWebhook', relation: 'invokes', isBreakingChange: false }
            ]
        },
        blastRadiusTable: [
            {
                dependentComponent: 'src/services/customerLedgerService.ts',
                componentType: 'Domain Service',
                impactType: 'Runtime Error Risk',
                severity: 'high',
                affectedCallers: 5,
                recommendedTest: 'Run concurrent Stripe webhook re-delivery idempotency test suite'
            }
        ],
        releaseNotes: {
            title: 'Release Notes: Stripe Webhook Distributed Lock (PR #144)',
            versionTarget: 'v2.13.9',
            executiveSummary: 'Introduces Redis distributed locking to prevent duplicate webhook delivery processing.',
            breakingChanges: [],
            downstreamServicesToAlert: ['Finance Engineering: Monitor double-charge alert channel for 48 hours.'],
            qaChecklist: [
                { id: 'qa-pay-1', item: 'Trigger 10 concurrent identical webhook events with Stripe CLI', checked: true }
            ],
            rollbackPlan: ['Revert commit and deploy hotfix without Redis lock dependency.']
        }
    },
    {
        id: 'pr-145',
        number: 145,
        title: 'refactor(dto): User Profile DTO & Separation of Concerns',
        author: 'david-clean (Software Craftsman)',
        targetBranch: 'main',
        sourceBranch: 'refactor/user-profile-dto',
        commitHash: '91a4c88',
        changedFilesCount: 2,
        additions: 38,
        deletions: 22,
        estimatedTokens: {
            promptTokens: 620,
            completionTokens: 280,
            bobcoinCost: 0.28
        },
        riskScore: {
            overallScore: 18,
            riskTier: 'LOW',
            factors: {
                breakingApiSurface: 2,
                downstreamFanout: 6,
                securityCriticality: 4,
                testCoverageDelta: 6
            },
            summary: 'Low risk refactoring: Strict adherence to SOLID & DRY principles. Full test suite passes without breaking API changes.'
        },
        files: [
            {
                filename: 'src/dto/userProfileDto.ts',
                additions: 24,
                deletions: 12,
                rawDiff: '',
                diffLines: [
                    { type: 'header', content: '@@ -1,8 +1,12 @@ export class UserProfileDto {' },
                    { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'export class UserProfileDto {' },
                    { type: 'context', oldLineNumber: 2, newLineNumber: 2, content: '  readonly id: string;' },
                    { type: 'addition', newLineNumber: 3, content: '+ readonly displayName: string;' },
                    { type: 'addition', newLineNumber: 4, content: '+ constructor(entity: UserEntity) {' },
                    { type: 'addition', newLineNumber: 5, content: '+   this.id = entity.id;' },
                    { type: 'addition', newLineNumber: 6, content: '+   this.displayName = `${entity.firstName} ${entity.lastName}`.trim();' },
                    { type: 'addition', newLineNumber: 7, content: '+ }' },
                    { type: 'context', oldLineNumber: 3, newLineNumber: 8, content: '}' }
                ]
            }
        ],
        findings: [],
        dependencyGraph: {
            nodes: [
                { id: 'userDto', label: 'userProfileDto.ts', type: 'modified_file', risk: 'low', fanoutCount: 2, tier: 0, description: 'Refactored DTO' },
                { id: 'userController', label: 'UserController', type: 'service', risk: 'low', fanoutCount: 1, tier: 1, description: 'Returns serialized DTO' }
            ],
            edges: [
                { source: 'userDto', target: 'userController', relation: 'imports', isBreakingChange: false }
            ]
        },
        blastRadiusTable: [
            {
                dependentComponent: 'src/controllers/userController.ts',
                componentType: 'Express Controller',
                impactType: 'Schema Incompatibility',
                severity: 'low',
                affectedCallers: 2,
                recommendedTest: 'Unit test user profile JSON serialization'
            }
        ],
        releaseNotes: {
            title: 'Release Notes: User Profile DTO Refactoring (PR #145)',
            versionTarget: 'v2.13.8',
            executiveSummary: 'Internal architectural refactoring introducing strong DTO mapping. Zero external breaking changes.',
            breakingChanges: [],
            downstreamServicesToAlert: [],
            qaChecklist: [
                { id: 'qa-dto-1', item: 'Verify /api/v1/users/me response structure', checked: true }
            ],
            rollbackPlan: ['Standard git revert.']
        }
    }
]

export const INITIAL_BOB_SESSION: BobSessionLog[] = [
    {
        taskId: 'bob-task-9021',
        sessionTitle: 'Agent A AST Grammar Parser Dry-Run',
        startTime: '10:14:22',
        status: 'COMPLETED',
        promptTokens: 420,
        completionTokens: 210,
        bobcoins: 0.85,
        summary: 'Isolated Bob Shell validation of AST syntax parser without API loop errors.'
    },
    {
        taskId: 'bob-task-9022',
        sessionTitle: 'Agent B Downstream Graph Extraction',
        startTime: '11:42:05',
        status: 'COMPLETED',
        promptTokens: 580,
        completionTokens: 390,
        bobcoins: 1.45,
        summary: 'Dependency fan-out analysis for auth/verifyToken.ts mapping 4 downstream consumers.'
    },
    {
        taskId: 'bob-task-9023',
        sessionTitle: 'Composite Risk Index Formulation Run',
        startTime: '13:05:40',
        status: 'COMPLETED',
        promptTokens: 890,
        completionTokens: 410,
        bobcoins: 2.10,
        summary: 'Deterministic 4-factor risk score calculation test on PR #142 security regression.'
    },
    {
        taskId: 'bob-task-9024',
        sessionTitle: 'Node.js Backend Bridge SHA-256 Cache Verification',
        startTime: '14:28:12',
        status: 'COMPLETED',
        promptTokens: 710,
        completionTokens: 320,
        bobcoins: 1.70,
        summary: 'End-to-end Promise.all concurrency test with local cache validation.'
    }
]