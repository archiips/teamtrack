# TeamTrack planning pack

Status: proposed design, ready for user review. No app implementation or deployment has begun.
Prepared 2026-10-13. Source material: ../../TeamTrack.pdf and the lean-canvas image supplied in chat.

## Product brief
TeamTrack is a deployed Canvas-integrated workspace for student teamwork and professor oversight. Users launch it from a course, receive their course role, organize teams, agree responsibilities, track work and inspect contribution evidence. The first release is a live demonstration with synthetic students in a genuine Canvas sandbox. Universities remain the intended buyer; business teams remain a possible later audience.

## Read in order
1. [PRD](01-prd.md): users, scope, journeys and acceptance criteria.
2. [Architecture](02-architecture.md): integration, storage, access control and interfaces.
3. [UI direction](03-ui-design.md): palette, screens, interaction rules and asset choices.
4. [Implementation tasks](04-implementation-plan.md): ordered checkpoints and verification.
5. [Deployment and demo](05-deployment-demo.md): sandbox setup, release gates and presentation script.
6. [Research and decisions](06-research-decisions.md): primary sources, tradeoffs and critique.

## Assumptions and execution boundaries
- Browser-based app, not a native app or Canvas source-code modification.
- Synthetic records only for the class demo. Real student deployment requires a separate institutional review.
- Real LTI launch and roster sync are part of completion; a Canvas-looking wrapper is not a substitute.
- No class deadline supplied. Milestones are dependency-ordered rather than promised calendar dates.
- Canvas sandbox hosting/access and final hosting account are not provisioned yet. Validate them before expanding implementation.
- Proposed stack: Next.js/TypeScript, PostgreSQL, Prisma, Tailwind and accessible Radix primitives; Vitest and Playwright. Pin compatible supported versions at implementation time.
- Hosting: Vercel Hobby for frontend and Node serverless endpoints; Neon Free PostgreSQL. Canvas sandbox runs locally for $0 hosting. No paid plans, trials requiring payment, custom domains or purchases. See deployment runbook for limits.
- Plan is intentionally reviewable before code. User requested the entire planning pack now; architecture and tasks remain proposals until reviewed together.

## Definition of done
A public HTTPS TeamTrack deployment launches from an actual Canvas sandbox, recognizes instructor/student roles, imports a synthetic roster, persists the core workflow and demonstrates professor visibility into a student's recorded work. Authorization and launch rejection tests pass; representative screens have been inspected; demo recovery has been rehearsed.
