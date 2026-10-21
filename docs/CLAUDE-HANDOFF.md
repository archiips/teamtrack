# TeamTrack — start here (handoff, updated 2026-10-21)

Read this first in a new session, then `docs/releases/progress.md` (dated log), `deploy/README.md` (operations, Canvas restart, demo script), `video/README.md` (demo videos), and `docs/planning/` (PRD, architecture, UI spec) only if you need original intent.

## Where things are
| Thing | Location |
|---|---|
| Workspace | `/Users/architjaiswal/main/College/2026 fall/CSS 474/demo` (path has spaces; use `fileURLToPath`, never `URL.pathname`) |
| Repo | https://github.com/archiips/teamtrack — `main` and `feat/demo-mvp` are identical |
| Live app | https://teamtrack-kappa.vercel.app (Vercel Hobby, project `archits-projects-37ac7754/teamtrack`) |
| Database | Neon Free, project `long-fog-29044883` |
| Canvas sandbox | Local Docker (`.canvas-sandbox`, compose project `teamtrack-canvas`) via ngrok https://duct-groggy-kitten.ngrok-free.dev/courses/1 |
| Demo videos | `video/out/teamtrack-demo-short.mp4` (19s pitch), `video/out/teamtrack-demo.mp4` (60s) — git-ignored, on disk only |
| Slide images | `video/out/slide/` — git-ignored, on disk only |

Stack: Next.js 16.4 / React 19.3 / TypeScript, postgres.js, jose (LTI 1.3), three.js (Pip), Vitest, Playwright (captures only). AGENTS.md: this Next version differs from training data; read `node_modules/next/dist/docs/` before using Next APIs.

## Current state (all verified at the time of writing)
- Live site healthy; synthetic demo reset to seed. Unit 23/23, integration 5/5 (local + production), typecheck, lint, production build pass.
- **Canvas sandbox is currently offline**: Docker daemon and ngrok were stopped after the demo. Restart steps are in `deploy/README.md`. Until restarted, Canvas launch links fail; the public app and demo profiles still work.
- Canvas LTI verified end-to-end when running (2026-10-13): course_navigation launch, embedded iframe (GET + CSRF POST), instructor role, NRPS roster sync (1 teacher + 8 students). Canvas platform keys upgraded to 2048-bit. Not verified: student launch via masquerade, Safari embedded. The Canvas course has **no teams yet** (create one from Teams & people).
- Deploy is manual: `npx vercel --prod --yes` (GitHub auto-deploy is not connected). `.vercelignore` excludes `video`, docs, sandbox, env.

## What exists (high level)
- Professor/student workspace: tasks (list + board), owners, due dates, blockers, contributions with HTTPS evidence, versioned team agreement with history, checkpoints, activity log, roster sync status, team creation. No grading.
- Visual identity: navy/cream palette (#010736 #0D1C42 #22396F #FCF1D0), navy hero band with doodles and paper grid, Fredoka + Instrument Serif accents + Manrope, sticker cards, motion gated on visibility and reduced motion. Logo mark in `src/components/logo.tsx` + `src/app/icon.svg` (user-supplied mark, kept in its own blue-violet colours).
- Pip (`src/components/companion-model.tsx`): procedural three.js mascot. Lives in the overview hero band, docked bottom-right elsewhere. Floats, blinks, follows cursor, hops after saves, nods when its checklist has items; ~30fps, pauses when hidden/off-screen. Checklist built from real state. X closes the panel; "Hide Pip" link persists under localStorage `tt-pip-hidden-v2`; footer "Bring back Pip" restores.
- Insights: `src/lib/insights.ts` (tested) feeds status bars, member breakdown, team health chips. Accessible team menu replaces the old native select.

## Gotchas learned the hard way
- Chrome-extension tabs report `document.hidden`: rAF and CSS animations do not run there. Verify motion with Playwright (headless Chrome is visible), not the extension tab.
- Full-page screenshots: scroll-driven reveal leaves off-screen panels invisible; captures inject a style disabling it.
- `.welcome` is an existing class; don't reuse it for other components (doodles collided once).
- Never type Canvas passwords into scripts; Canvas frames come from the user's logged-in Chrome. Demo profiles need no password (`/api/demo/login`).
- Video captures write demo data: always `npm run demo:reset` before and after `video/capture.mjs`.

## Open / optional next steps
- Restart Docker + ngrok before any Canvas demo; create a team in the Canvas course.
- Possibly recolour the logo to navy/cream if the user wants (they kept original colours so far).
- Normalized schema (Prisma) is deferred; current store is a transactional JSON aggregate per namespace.
- `src/app/api/lti/{launch,login}/route.ts` are not Prettier-formatted (pre-existing; harmless).
