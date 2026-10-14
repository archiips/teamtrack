# TeamTrack system architecture

Status: proposed design. Integration feasibility must pass first.

## Deployment shape
Canvas sandbox → LTI authentication endpoints → server session → TeamTrack UI/API → PostgreSQL.
The server also requests Canvas NRPS roster data using a scoped service token. Browsers never receive Canvas service credentials. The app remains independently hosted and Canvas embeds it through course navigation.

Deploy frontend and backend route handlers together on Vercel Hobby; use Neon Free PostgreSQL with pooled runtime connections and a migration connection configured according to the selected Prisma version. Functions are stateless: launch state, sessions and sync locks remain in PostgreSQL. No local filesystem persistence or background work after response. Bound roster sync to request limits; fail safely and retain prior data on timeout. Use a single Next.js Node application with TypeScript and PostgreSQL through Prisma. Keep integration, authorization and domain operations in separate modules. No microservices, Redis, websocket server, AI service or object storage for MVP. Reads refresh on navigation and after mutation; instructor overview also has an explicit refresh control.

## LTI contract
Endpoints: GET/POST /api/lti/login, POST /api/lti/launch, GET /api/lti/jwks, GET /api/lti/config. Config declares course_navigation placement and readonly NRPS scope. Implement standards validation with a maintained JOSE library; no handwritten cryptography.

Registration is an explicit server-side allowlist: issuer, client ID, deployment ID, authorization endpoint, token endpoint, JWKS URL and allowed Canvas origin. Self-hosted Canvas uses its own endpoints; do not hardcode hosted Canvas endpoints for every sandbox.

Login stores a random state and nonce, redirect target and registration reference with a five-minute expiry. Consume state once. Verify JWT signature against the registered JWKS, allowed algorithm, issuer, audience/client ID, authorized party where applicable, expiration/issued-at, nonce, LTI version, message type, deployment and course context. Reject ambiguous registrations and unknown roles. Create identity using registration plus subject, never email. Create course using registration plus context ID, never title.

Store hashed opaque server session tokens in PostgreSQL; cookies Secure, HttpOnly, SameSite=None for embedded launch. Protect mutations with a session-bound CSRF token and validate request origin. Cross-site POST launch uses LTI state/nonce validation rather than normal app CSRF. Apply CSP frame-ancestors only to configured sandbox origins; no wildcard iframe policy. Do not log launch JWTs or service tokens.

Embedded authentication is a milestone, not an assumption: cookie blocking may break the simple path. If supported browser policy blocks embedded sessions, offer an explicit new-window launch that performs fresh authentication, with no bearer tokens in URLs. Investigate Canvas platform-storage support before promising seamless embedded operation in that browser. Release report states exact browser outcomes. Chrome embedded is required; Safari behavior must be tested and any fallback disclosed.

## Roster synchronization
POST /api/courses/:courseId/roster/sync is instructor-only. Use signed client assertion to request readonly NRPS token. Obtain membership URL from a validated launch. Restrict token/JWKS/NRPS network requests to registered hosts and HTTPS, block private networks except the explicitly configured local development sandbox, reject unexpected redirect hosts, and set timeouts/body limits.

Follow pagination to a complete bounded roster, stage changes, then commit atomically. Upsert members by external member ID within registration/course; preserve missing optional names/email with safe display fallbacks. Mark missing/inactive memberships inactive only after a complete successful sync. A timeout/429/partial page leaves prior membership data intact and shows an actionable retry message. Prevent overlapping syncs. Do not erase contribution history when enrollment changes. User access rechecks current membership on every request; successful sync revokes removed members' course access.

## Data model
All IDs are UUIDs except external Canvas identifiers, stored as strings. All times stored in UTC. Foreign keys and scoped repository queries enforce course relationships.

| Entity | Key fields and invariants |
|---|---|
| Registration | issuer, clientId, deploymentId, endpoints, allowedOrigin; unique triple |
| User | registrationId, subject, displayName, optional email; unique registration/subject |
| Course | registrationId, contextId, title, timezone; unique registration/context |
| Enrollment | courseId, userId, role, active; unique pair |
| Project | courseId, title, description, dueAt, archivedAt |
| Checkpoint | projectId, title, dueAt, position |
| Team | projectId, name, archivedAt |
| TeamMember | teamId, projectId, userId; unique project/user; validate enrollment |
| AgreementVersion | teamId, version, body, publishedBy, publishedAt; unique team/version |
| AgreementAcceptance | agreementVersionId, userId, acceptedAt; unique version/user |
| Task | teamId, checkpointId nullable, ownerId, title, description, dueAt, status, blocker, version |
| Contribution | taskId, authorId, body, evidenceUrl nullable, version, createdAt, updatedAt |
| Comment | taskId, authorId, body, createdAt |
| ActivityEvent | courseId, teamId nullable, actorId, entityType, entityId, action, before/after safe JSON, timestamp |
| LaunchState | hashedState, nonce, registrationId, expiresAt, consumedAt |
| Session | tokenHash, userId, courseId, expiresAt |
| RosterSync | courseId, status, startedAt, completedAt, count, sanitized error |

Task status: todo, in_progress, done. Blocker is an optional explanation independent of status. Instructor/member mutations include expectedVersion; stale edits return 409 and preserve submitted content for user reconciliation. Business mutation and ActivityEvent insert share one database transaction. Events are append-only in application permissions; this is not a tamper-proof forensic ledger.

## Authorization and service interfaces
Server-only context: Actor = { userId, courseId, role: 'instructor' | 'student' }.
requireCourseActor(request): Promise<Actor> authenticates session and active enrollment.
requireTeamAccess(actor, teamId): Promise<Team> checks course and instructor or current team membership.
All domain operations accept Actor; never trust client role, course or author fields.

Domain interfaces:
- syncRoster(actor): Promise<{count:number; completedAt:string}>.
- createProject(actor, input): Promise<Project>.
- saveTeamMembers(actor, teamId, userIds): Promise<Team>.
- publishAgreement(actor, teamId, body): Promise<AgreementVersion>; instructor or team member permitted.
- acceptAgreement(actor, versionId): Promise<AgreementAcceptance>; own current team only.
- createTask(actor, teamId, input): Promise<Task>.
- updateTask(actor, taskId, expectedVersion, patch): Promise<Task>.
- saveContribution(actor, taskId, input, expectedVersion?): Promise<Contribution>; edits author-only.
- addComment(actor, taskId, body): Promise<Comment>.
- getCourseOverview(actor): Promise<CourseOverview>; instructor-only.

Use instructor-only project/team endpoints, team-scoped task/agreement/evidence endpoints and instructor-only overview endpoints. Return 401 for missing session, 403 for forbidden action, 404 for inaccessible resource IDs, 409 for conflicts, 422 for field errors and 503 for temporary Canvas failure. Lists use bounded pagination. Render user text as text, never raw HTML. External links use safe opener attributes.

## Operational requirements
Runtime secrets: DATABASE_URL, SESSION_SECRET, LTI_PRIVATE_JWK, registered platform configuration and DEMO_MODE flag; never NEXT_PUBLIC secrets. Config validation fails startup for missing keys. /api/health returns sanitized readiness. Structured logs contain request ID, route, status and duration, not roster bodies or student text. Operator-created local encrypted database export before releases and a pre-demo snapshot within available free limits; reset targets only the synthetic demo course and requires an operator session.

See implementation plan for proposed files and checks. Hosting resources are created only after account/cost selection.
