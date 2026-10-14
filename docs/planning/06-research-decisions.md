# Research, decisions and self-review

Reviewed 2026-10-13. Links below are primary/official sources. Research supports integration feasibility and tool choices, not claims of market differentiation.

## Evidence
- [Canvas provisioning](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.provisioning): NRPS enables course roster synchronization for LTI 1.3; requires enabled readonly scope and installed tool. Launch-only provisioning does not discover all users. Supplemental REST API has separate authorization.
- [Canvas configuration](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_dev_key_config): platform/client/deployment/key configuration and tool placements.
- [Canvas launch overview](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_launch_overview): OIDC initiation, signed launch response and validation flow.
- [Canvas navigation](https://developerdocs.instructure.com/services/canvas/external-tools/lti/placements/file.navigation_tools): course navigation placement avoids requiring deep-linking workflow.
- [Canvas official Docker development guide](https://github.com/instructure/canvas-lms/blob/master/doc/docker/developing_with_docker.md): local development sandbox setup. Not evidence of production security or hosted sandbox entitlement.
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting): Node deployment/runtime settings; reverse proxy recommendation. Framework choice is our engineering judgment.
- [Prisma migration workflow](https://www.prisma.io/docs/orm/migrations/applying-a-migration): separate development and deployment migration practices.
- [User palette](https://colorhunt.co/palette/0107360d1c4222396ffcf1d0): #010736, #0D1C42, #22396F, #FCF1D0.
- [Uiverse](https://uiverse.io/buttons) and [21st](https://21st.dev/community/components): UI discovery sources. Exact reused components require individual inspection and licensing review.

## Decisions and alternatives
| Decision | Rationale | Alternative rejected for MVP |
|---|---|---|
| LTI 1.3 + NRPS | Matches course launch and roster need | Browser extension or copied Canvas UI lacks authentic integration |
| Separate deployed server embedded in Canvas | Keeps own domain logic and deployment lifecycle | Forking Canvas increases maintenance and institution dependency |
| One TypeScript app + PostgreSQL | Few moving parts, transactional data and shared types | Separate frontend/backend services add integration work without a clear class-demo benefit |
| App-managed teams | Avoid additional Canvas REST permissions | Automatic Canvas group import needs separate API design and authorization |
| Evidence and descriptive counts | Avoid claiming task counts equal effort | Automatic scores and grade writes create unsupported assessment logic |
| Comments/links | Supports discussion and artifacts in the existing workflow | Full chat and file hosting expand scope |
| Optional lightweight companion | Personality without blocking workflow | Default WebGL mascot adds runtime/performance burden |

## Risks and mitigations
Sandbox availability is the critical external dependency: validate first. Browser third-party session policy can prevent embedding: test first and document fresh-auth new-window fallback. Roster paging failures can remove legitimate access: stage and commit only complete syncs. Participation records can imply false conclusions: show limitations and context beside counts. Reused UI/model assets can have incompatible licenses: inspect exact assets before import. Live-demo reliability depends on host limits: rehearse on deployed URLs and prepare an honestly labeled fallback.

## Plan critique and revisions
- Correctness: replaced email-based identity with registration-scoped subject; specified complete roster sync, inactive enrollment and stale edits.
- Simplicity: removed AI, gradebook writes, general chat, uploads and automatic Canvas group import from MVP.
- Privacy/security: synthetic demo only, explicit registration allowlist, scoped server authorization, no browser service tokens and no evidence-link fetching.
- Maintainability: integration adapter isolated from domain services; one app/database and explicit migration/release process.
- Testing: moved real Canvas launch/session proof to the first milestone; added cross-course/team isolation, roster failure and role ambiguity tests.
- User experience: reduced nested navigation inside iframe, task-specific discussion, visible attention reasons and optional dismissible companion.

## Remaining execution inputs
Class deadline and available hosting accounts remain unknown. They affect scheduling/provider selection, not the proposed workflow. Exact supported dependency versions and asset/component selection are verified during setup, then locked and documented. Canvas sandbox provisioning is an explicit first deliverable, never assumed complete.
