# TeamTrack implementation plan

> For agentic workers: use superpowers:executing-plans for native task-by-task execution after user review. Parallel agent execution is not selected.

**Goal:** Deploy a demonstrable Canvas-integrated teamwork workspace with authentic launch, roster import and persistent contribution evidence.

**Architecture:** One Node web app with separate Canvas adapter, authorization and domain services. PostgreSQL stores business data, launch state, sessions and events.

**Tech stack:** Next.js, TypeScript, PostgreSQL, Prisma, Tailwind, Radix primitives, JOSE, Zod, Vitest and Playwright; supported compatible versions locked during Task 1.

**Spec:** [PRD](01-prd.md), [architecture](02-architecture.md), [UI specification](03-ui-design.md).

## Global constraints
- Synthetic records only for the class demo.
- Real LTI launch and roster sync are part of completion; a Canvas-looking wrapper is not a substitute.
- No combined numerical contribution score, leaderboard, automatic grade or accusation of freeloading.
- No production code or provisioning until the user reviews this pack and starts execution.
- Task comments/notes are visible to the team and instructor. No confidential peer review.
- Core workflow must work at 768px iframe width and 390px standalone width.

## Review focus
1. Blocked embedded cookies: authenticated new-window recovery without tokens in URLs (Task 2).
2. Partial roster/removed member: preserve data on failed sync, revoke access after successful removal (Task 3).
3. Guessed course/team identifiers: enforce server-side isolation on every read/mutation (Tasks 2, 4, 6).
4. Concurrent edits and duplicate submissions: no lost updates or duplicated agreement acceptance (Task 5).
5. Misleading counts/long content: descriptive labels, complete histories, responsive/keyboard usability (Tasks 6, 7).

## Planned repository layout
- src/app/api/lti/{login,launch,jwks,config}/route.ts: public integration endpoints.
- src/lib/lti/{registration,launch,nrps}.ts: platform contracts and validation.
- src/lib/auth/{session,authorization,csrf}.ts: server identity and access checks.
- src/lib/db.ts and prisma/schema.prisma: database access and invariants.
- src/features/{projects,teams,agreements,tasks,contributions,overview}/: schemas, server services, components.
- src/components/ui/: reusable accessible controls; no business authorization here.
- src/app/(workspace)/courses/[courseId]/: overview, projects and team pages.
- src/styles/tokens.css: approved color/type/motion tokens.
- tests/{unit,integration,e2e}/: scoped checks and authentic-launch coverage.
- scripts/{seed-demo,reset-demo}.ts: idempotent course-scoped synthetic fixtures.
- vercel.json and deploy/README.md: repeatable release procedure.

## Validation command contract
There is no package.json yet, so these are planned scripts, not discovered or executed commands. Task 1 defines them and records actual versions. Use pnpm lint, pnpm typecheck, pnpm test, pnpm test:integration, pnpm test:e2e and pnpm build. Unit runner: Vitest; browser runner: Playwright. Integration tests use a separate disposable PostgreSQL database and refuse the deployment database URL. Never add a no-op check to satisfy the contract.

## Task 1: Reproducible foundation and genuine sandbox access
**Files:** package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts, prisma/schema.prisma, .gitignore, .env.example, deploy/canvas-sandbox.md, tests/integration/health.test.ts.
**Consumes:** planning pack and available host/admin accounts.
**Produces:** running app/database, documented Canvas registration parameters and working check scripts.

- [ ] Verify available Node/container tooling and choose supported package versions from official docs; record versions and dependency reasons.
- [ ] Obtain hosted sandbox admin access or set up official local Canvas development instance. Create synthetic course/users. Record whether sandbox is local or remotely hosted; no production recipe claims.
- [ ] Add app/database skeleton, migrations, sanitized readiness endpoint and startup configuration validation.
- [ ] Test health against live disposable database; test invalid config fails startup. Run lint, types, unit/integration checks and build.
- [ ] Verify .env, private JWKs, database dumps and local secret files with git check-ignore before first commit. Initialize Git only if needed and review staged paths.
**Acceptance:** app starts reproducibly; test database isolated; admin can create LTI key. If sandbox access is unavailable, report that blocker before UI expansion.

## Task 2: Authentic LTI launch and session boundary
**Files:** src/lib/lti/registration.ts, src/lib/lti/launch.ts, src/lib/auth/session.ts, src/lib/auth/csrf.ts, src/lib/auth/authorization.ts, src/app/api/lti/{login,launch,jwks,config}/route.ts, tests/integration/lti.test.ts, tests/e2e/canvas-launch.spec.ts.
**Consumes:** Canvas endpoints/registration, database.
**Produces:** requireCourseActor(request): Promise<Actor>, with Actor as defined in architecture; authenticated course session.

- [ ] Write rejection fixtures for wrong signature/issuer/audience/deployment, expired token, replayed state/nonce, missing context and unknown role; first verify failures before implementing validation.
- [ ] Implement allowlisted OIDC flow, atomic state consumption, JOSE validation and registration-scoped identity/course upsert.
- [ ] Implement opaque server sessions, active-enrollment checks, origin/CSRF enforcement for app mutations and registered frame policy.
- [ ] Register tool in Canvas; launch as instructor and student in separate profiles. Confirm browser receives no Canvas service token.
- [ ] Test Chrome embedded navigation/reload and Safari cookie-policy behavior. Implement explicit fresh-auth new-window recovery if embedding fails; do not pass bearer tokens in query strings.
- [ ] Run integration/browser checks; document actual sandbox/browser evidence and review diff before commit.
**Acceptance:** R1 and authentication portion of R11/R13. Stop and resolve integration issues before proceeding.

## Task 3: Complete roster synchronization
**Files:** src/lib/lti/nrps.ts, src/features/teams/roster-service.ts, src/app/api/courses/[courseId]/roster/sync/route.ts, tests/integration/roster.test.ts.
**Consumes:** Actor, validated membership URL, readonly service scope.
**Produces:** syncRoster(actor): Promise<{count:number; completedAt:string}> and active Enrollment rows.

- [ ] Test paginated roster, duplicate IDs, missing names/emails, inactive user, page-two timeout/429 and simultaneous sync.
- [ ] Implement scoped service assertion/token, host restrictions, pagination bounds and staged atomic upsert/deactivation.
- [ ] Implement instructor-only sync button/status and retry message retaining prior successful sync information.
- [ ] Test removed member denial after complete sync, and retained access after partial failure. Verify no raw roster/token logging.
- [ ] Run pnpm test:integration and actual Canvas roster import; compare imported count with sandbox course. Review diff and commit.
**Acceptance:** R2; no TeamTrack user signup and no separate Canvas REST API permission required.

## Task 4: Projects, checkpoints and team formation
**Files:** src/features/projects/{schema,service}.ts, src/features/teams/{schema,service}.ts, src/app/(workspace)/courses/[courseId]/projects/new/page.tsx, src/features/teams/team-editor.tsx, tests/integration/teams.test.ts, tests/e2e/project-setup.spec.ts.
**Consumes:** active roster, Actor, requireTeamAccess(actor, teamId): Promise<Team>.
**Produces:** createProject(actor,input): Promise<Project>; saveTeamMembers(actor,teamId,userIds): Promise<Team>.

- [ ] Test non-instructor denial, cross-course student assignment, duplicate team membership, inactive enrollment, invalid dates and archived project mutation.
- [ ] Add project/checkpoint validation and transactions; require enrolled students, unique project/user membership, course timezone and immutable event entries.
- [ ] Build project form and searchable team assignment using accessible controls, not drag-only UI.
- [ ] Test team reassignment history and student access changes. Preserve old work; do not silently move authorship.
- [ ] Run integration and project-setup browser checks; inspect empty/long-name/error screens. Review diff and commit.
**Acceptance:** R3/R4 and project/team portion of R11.

## Task 5: Agreements, tasks and attributed evidence
**Files:** src/features/agreements/{schema,service,agreement-panel}.tsx (split server .ts modules from UI .tsx), src/features/tasks/{schema,service}.ts, src/features/tasks/task-drawer.tsx, src/features/contributions/{schema,service}.ts, tests/integration/workflow.test.ts, tests/e2e/student-workflow.spec.ts.
**Consumes:** Actor/team access and validated project/team records.
**Produces:** publishAgreement, acceptAgreement, createTask, updateTask, saveContribution and addComment interfaces defined in architecture.

- [ ] Test current-version acceptance, idempotent repeat acceptance, new-version renewal, student access denial, owner outside team and archived team edits.
- [ ] Test task status/reassignment, expectedVersion conflict, contribution author-only edits, HTTPS URL rejection, text rendering without executable HTML and event transaction rollback.
- [ ] Implement agreement versions/acceptance, tasks/blockers, attributed updates/revisions and comments. Preserve each correction in history.
- [ ] Build team workspace, task drawer and agreement view with inline errors and saved/failed states. On 409 preserve user input and offer review/reload.
- [ ] Test two sessions updating same task: second stale write fails; no silent overwrite. Reload verifies database persistence.
- [ ] Run workflow integration/browser checks; inspect keyboard drawer focus and long updates. Review diff and commit.
**Acceptance:** R5-R8 and scoped mutation portion of R11.

## Task 6: Professor oversight and inspectable contribution history
**Files:** src/features/overview/{service,attention-rules}.ts, src/features/overview/course-overview.tsx, src/features/contributions/member-detail.tsx, tests/unit/attention-rules.test.ts, tests/integration/overview.test.ts, tests/e2e/instructor-review.spec.ts.
**Consumes:** persisted tasks, checkpoints, agreements, comments/events.
**Produces:** getCourseOverview(actor): Promise<CourseOverview>, team/member detail projections.

- [ ] Test overdue-open task reason, blocker reason, acceptance denominator, completed-task exclusion from overdue status and timezone boundary.
- [ ] Implement bounded course/team queries and deterministic reason labels; do not compute effort/quality/grade score.
- [ ] Build instructor team list and drill-down; show task count denominator and count limitations beside evidence.
- [ ] Test student/cross-course overview denial, preserved old author history after reassignment and zero-task display without invalid percentages.
- [ ] Replay student update then instructor refresh; assert new evidence and blocker visible with author/time. Inspect rendered state, review diff and commit.
**Acceptance:** R9/R10; no unexplained fairness metric.

## Task 7: Cohesive visual and accessible interaction pass
**Files:** src/styles/tokens.css, src/components/ui/, src/components/companion.tsx only if selected, docs/design/asset-register.md, tests/e2e/accessibility.spec.ts.
**Consumes:** UI design specification and working journeys.
**Produces:** consistent polished screens, recorded exact component/asset provenance.

- [ ] Apply palette, local typography, responsive navigation and restrained motion across real screens.
- [ ] Browse exact Uiverse/21st candidates; inspect license, author and dependency cost before reuse. Prefer original implementation where reuse complicates core behavior.
- [ ] Inspect all key screens at 1440/1024/768/390px and inside Canvas; test keyboard, 200% zoom, reduced motion and contrast.
- [ ] Correct loading/empty/error/conflict state hierarchy and preserve entered content on request failure.
- [ ] Add optional dismissible companion only if core checks pass; no WebGL by default. Any imported model must meet UI spec licensing, size and fallback requirements.
- [ ] Run accessibility/browser tests and record screenshots; review diff and commit.
**Acceptance:** R13 and visual specification. A companion is optional, accessibility is required.

## Task 8: Deploy, seed and rehearse the live demonstration
**Files:** vercel.json, deploy/README.md, scripts/seed-demo.ts, scripts/reset-demo.ts, tests/integration/demo-reset.test.ts, docs/releases/demo-validation.md.
**Consumes:** working app, Vercel Hobby and Neon Free accounts and sandbox registration.
**Produces:** public HTTPS app, repeatable synthetic fixture, release evidence and rehearsed demonstration.

- [ ] Configure Vercel Hobby and Neon Free only, stable production domain, pooled database runtime connection, server secrets, HTTPS, frame policy, readiness and controlled migration command. Verify sandbox tunnel reachability before registration.
- [ ] Test seed/reset idempotence and exact synthetic-course targeting; reject real/non-demo course resets.
- [ ] Run pnpm lint, pnpm typecheck, pnpm test, pnpm test:integration, pnpm test:e2e and pnpm build with recorded output. Review final diff against R1-R13.
- [ ] Deploy reviewed revision, run prisma migrate deploy, seed and register deployed HTTPS endpoints in Canvas.
- [ ] Run real deployed instructor/student walkthrough; restart app and confirm persisted state. Verify snapshot/recovery and sanitized logs.
- [ ] Rehearse five-minute script, expired session and Canvas outage fallback. Record tested browsers, limitations and URLs without credentials.
**Acceptance:** R12, all release gates in deployment runbook and fresh evidence for R1-R13. Update checkboxes only after corresponding checks pass.

## Plan self-review
Each R1-R13 maps to an acceptance above. Critical browser/integration tests precede feature expansion. Data/interface names match architecture. Runtime versions, hosting account and sandbox provisioning are explicit setup work, not hidden promises. This plan defines work and acceptance boundaries; exact implementation bodies are written and tested during execution rather than treated as prevalidated code.
