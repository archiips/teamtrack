# Scroll performance and team chat implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement these checkpoints inline. The user authorized both changes with “yes go ahead”; do not add an approval gate.

**Goal:** Make scrolling smoother and let each team send persistent messages and private file attachments.

**Architecture:** Retain the Next.js app, existing session/CSRF model, team permissions and PostgreSQL. Put chat rows and optional binary attachment data in a separate table, outside the workspace JSON and its refresh payload. A dedicated component fetches paginated history and polls new messages only while the chat is visible. No production dependencies or external services.

**Tech Stack:** Existing Next.js 16.4.3, React 19.3, postgres.js, Vitest and Playwright.

## Brief, assumptions and non-goals
- Team members and their course instructor can read/send in that team's chat. Label that visibility explicitly. Students cannot read other teams, including attachments and guessed IDs; inactive members lose access.
- One optional file per message; at most 3 MiB, 4,000 text characters, and 50 MiB total attachments per workspace. Attachment-only messages work. All files are downloaded as application/octet-stream with nosniff, private no-store, and a safe attachment filename. No inline execution or public file URLs.
- File bytes stay in PostgreSQL's binary storage, never in workspace JSON. This is a bounded classroom MVP; large files and high-volume messaging would warrant object storage later.
- Keep tasks, evidence, agreements, team management, practice, onboarding, theme and LTI/GitHub flows intact. Chat requires DATABASE_URL, like real accounts.
- No DMs, calls, email/push notifications, edit/delete, file previews or read receipts in this milestone.
- Work in the clean current checkout, with no concurrent implementation; keep changes uncommitted for review. Test servers override the production .env.local database with a temporary loopback PostgreSQL instance.

## Evidence and alternatives (2026-11-07)
- Read installed Next route-handler documentation: standard request bodies/FormData and awaited dynamic params.
- Graphify query traced workspace/auth/domain/motion; source verified directly afterward.
- Existing visuals: all panels and nested folder fronts use 20px backdrop blur, and overview/team/agreement grids have scroll-linked reveal transforms. Compare each separately in the same 4x-throttled Chrome scroll scenario before choosing the fix.
- Vercel official function limits: https://vercel.com/docs/functions/limitations — request/response cap 4.5 MB. Choose 3 MiB plus a bounded multipart envelope.
- WebKit: https://webkit.org/blog/3632/introducing-backdrop-filters/ — backdrop effects require extra rendering passes. Local A/B measurements determine what changes here.
- Rejected: storing blobs/messages inside State (grows every workspace fetch); public blob URLs (weaken private team access); WebSockets/new realtime vendor (unnecessary integration for this scope); filesystem files on Vercel (not durable).

## Review focus and acceptance
- Cross-team/namespace access and removed-member access: HTTP tests cover message list/send/download and missing CSRF/origin.
- Invalid/oversize input: tests cover empty text+file, whitespace, unicode, filenames, bad cursors, >3MiB, body with dishonest/missing content-length, and workspace quota.
- Retry after lost response: a client request UUID deduplicates saves; mismatched retry content is rejected.
- History and polling: oldest/newest ordering, before/after paging, no duplicate messages, preserving a draft on error, and no jump when reading old messages.
- Rendering: desktop/mobile/dark screenshots, keyboard send/attachment/download, long text and filenames, scrolling with old history, no page errors or overflow. Performance comparison uses the same seeded instructor team screen, viewport, 4x CPU throttle and 1.4s scroll; record all trials, including frame gaps, rather than promising a universal FPS gain.

## Checkpoints
- [x] 1. Reproduce scroll work in Chrome; independently disable reveal and blur. Remove only verified unnecessary rendering costs while preserving palette, readability and Pip. Validate reduced-motion and visible content.
- [x] 2. Write failing `tests/chat.test.ts` for `chat-policy.ts` (limits, access, cursors, bounded multipart) and HTTP `tests/chat-api.test.ts` for persistence, isolation, attachment bytes, idempotency, quota and pagination. Run red, then implement policy, repository and routes. Use `GET/POST /api/chat?teamId=...` and `GET /api/chat/files/[id]`. Return ascending pages of 50 plus `hasMore`; before/after IDs are validated positive bigint cursors.
- [x] 3. Write/run failing browser chat journey, then add `src/components/team-chat.tsx`, scoped styling and Chat navigation. Use existing tokens/typography; a quiet message transcript with a clear composer, accessible file controls, visible author/time and instructor visibility note. Poll every 5s only when visible, avoid overlapping fetches, support manual retry, restore focus after send and preserve draft on failure. History fetches do not reload the whole workspace.
- [x] 4. Run unit suite, chat HTTP suite, existing API/accounts suites, typecheck/lint/build, browser send/read/download/reload/isolation/mobile/dark flows and repeat scroll measurements. Review diff and authorization boundaries. Update README/operations with size/storage limits and exact verification evidence.

## Self-review before building
Correctness: chat is separate from workspace command mutations, uses existing active membership checks inside the save transaction, and always reauthorizes downloads. Simplicity: one table, one focused UI component, no new service. Privacy: no public file URLs or cached authenticated responses; names and bytes never enter logs. Maintainability: explicit shared types and size constants. Testing: add real multi-user HTTP/browser cases and conservative before/after performance evidence. UX: keep composition drafts stable during polling, file-only sends, user-controlled older history, and disclose instructor visibility. No existing journey is intentionally removed.

## Execution evidence
- Baseline: `npm test` — 50/50 pass. Git working tree clean.
- Isolated PostgreSQL: /private/tmp/teamtrack-chat-pg, loopback 54339; test app port 3100. No production data used.

- Final unit suite: `npm test` — 56/56 pass (50 existing + 6 chat boundary checks).
- Chat HTTP: `TEST_BASE_URL=http://localhost:3100 npm run test:chat` — 11/11 pass, including namespace/team isolation, removed-member file access, cursor paging, retry/substituted-byte checks, real 3 MiB files and concurrent uploads at the 50 MiB quota.
- Existing HTTP: `TEST_BASE_URL=http://localhost:3100 DEMO_PASSWORD=local-chat-demo-only npx vitest run tests/api.test.ts tests/accounts.test.ts` — 10/10 pass.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` — pass. The initial sandboxed build could not fetch existing Google Fonts; the network-enabled build passed without source/dependency changes.
- Browser chat: `TEST_BASE_URL=http://localhost:3100 node tests/e2e/chat.e2e.mjs` — 9 scenario checks pass, no page errors. Includes two students and instructor, file-only download bytes, lost-response retry, draft/reading position, older history, denied-fetch recovery, oversize error, reload, other-team denial, mobile/dark and hidden-document guard. Rendered screenshots inspected at desktop, dark and 390px. Dark-theme attachment control computed background rgb(12,7,28), text rgb(235,232,254).
- Existing practice browser walkthrough: `TEST_BASE_URL=http://localhost:3100 node tests/e2e/practice.e2e.mjs /private/tmp/teamtrack-chat-checks` — 12 PASS, no page errors.
- Fresh-context review found denied-fetch recovery retained stale cursor/deduplication state. A Chrome regression reproduced empty history after Retry; fix clears pagination/deduplication state and re-enables composer after successful authorization. Regression now passes. Older history requests also abort on unmount/denial. Hidden-document and real concurrent quota checks added to address review gaps.
- Scroll evidence: final alternating-order A/B has 6 successful trials per variant, no incomplete trials in that final run, instructor Teams screen, 1280x800, 4x CPU throttle, 1.4s scroll. Original mean main-thread task time 151.7 ms vs optimized 93.7 ms (~38% lower); mean style work 16.0 ms vs 11.2 ms. Both maintained ~16.7–16.8 ms p95 frame intervals and zero >33 ms gaps. This demonstrates lower rendering work here, not a universal FPS improvement or reproduction of the reporter's device-specific lag. Raw trial records copied below. Initial exploratory A/B and an intentionally interrupted comparison are not included in these means; an unrelated local-server restart interrupted one quota run, which was rerun successfully.
- Synthetic reset verification against the isolated database passed: demo chat cleared, all other workspace messages/files retained.
- Source and plan remain in the persistent project checkout, uncommitted; no deployment, push, production account creation or production data writes.

### Final scroll trials

```json
[
  {
    "variant": "original",
    "trial": 0,
    "frames": 85,
    "p95": 16.799999999999727,
    "over33": 0,
    "height": 2034,
    "taskMs": 154,
    "styleMs": 19
  },
  {
    "variant": "optimized",
    "trial": 0,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 96,
    "styleMs": 12
  },
  {
    "variant": "optimized",
    "trial": 1,
    "frames": 85,
    "p95": 16.799999999999272,
    "over33": 0,
    "height": 2034,
    "taskMs": 111,
    "styleMs": 13
  },
  {
    "variant": "original",
    "trial": 1,
    "frames": 85,
    "p95": 16.800000000000182,
    "over33": 0,
    "height": 2034,
    "taskMs": 154,
    "styleMs": 17
  },
  {
    "variant": "original",
    "trial": 2,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 139,
    "styleMs": 13
  },
  {
    "variant": "optimized",
    "trial": 2,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 96,
    "styleMs": 15
  },
  {
    "variant": "optimized",
    "trial": 3,
    "frames": 85,
    "p95": 16.799999999999272,
    "over33": 0,
    "height": 2034,
    "taskMs": 75,
    "styleMs": 6
  },
  {
    "variant": "original",
    "trial": 3,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 140,
    "styleMs": 17
  },
  {
    "variant": "original",
    "trial": 4,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 167,
    "styleMs": 16
  },
  {
    "variant": "optimized",
    "trial": 4,
    "frames": 85,
    "p95": 16.799999999999272,
    "over33": 0,
    "height": 2034,
    "taskMs": 104,
    "styleMs": 13
  },
  {
    "variant": "optimized",
    "trial": 5,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 80,
    "styleMs": 8
  },
  {
    "variant": "original",
    "trial": 5,
    "frames": 85,
    "p95": 16.700000000000728,
    "over33": 0,
    "height": 2034,
    "taskMs": 156,
    "styleMs": 14
  }
]
```

## Production release

User explicitly requested deployment. `npx vercel --prod --yes` completed with READY and production alias https://teamtrack-kappa.vercel.app, deployment dpl_5ZgKS7nRA4cnUA4n1Y3fXDAWBQSU. Fresh production build passed. Live smoke: health 200, unauthenticated chat/file routes 401; signed-in synthetic student Team chat loaded and initialized the table, attachment control enabled, no page errors. No chat messages/files posted in production. Changes remain uncommitted.
