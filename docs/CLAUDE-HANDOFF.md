> **Status update (2026-10-13, later):** the page corruption is repaired, the Canvas key fix is verified end-to-end (top-level and embedded), the 3D companion is finished, and everything is deployed. See `docs/releases/progress.md` for the verified state. The notes below are historical.

# TeamTrack continuation handoff — 2026-10-13

## User goal and authorization
Finish a polished, working, free deployed MVP for tomorrow's product-development lab demo. User authorized building, public GitHub repo and Vercel deployment, Neon Free DB, local Docker Canvas sandbox, secure LTI signing key stored server-only on Vercel. Continue existing work; do not restart planning or rebuild from scratch.

TeamTrack helps professors see individual contributions and students distribute work fairly. Main flow: Canvas course → TeamTrack → roster/roles → teams, tasks, blockers, contribution evidence, agreements and professor oversight. No automatic grading or real grade writes.

User specifically wants better UI and a hovering companion, potentially 3D. They are logged into **21st.dev in Chrome**, and encourage using https://21st.dev/, https://uiverse.io/ and other design references. Palette: https://colorhunt.co/palette/0107360d1c4222396ffcf1d0 — #010736 #0D1C42 #22396F #FCF1D0. Use actual browser to inspect references; do not blindly install unknown code. Original local model is fine; respect licenses and reduced motion.

## Where everything is
Workspace: `/Users/architjaiswal/main/College/2026 fall/CSS 474/demo`
Public repo: https://github.com/archiips/teamtrack
Live app: https://teamtrack-kappa.vercel.app
Canvas sandbox: https://duct-groggy-kitten.ngrok-free.dev/courses/1
Canvas tool: https://duct-groggy-kitten.ngrok-free.dev/courses/1/external_tools/2
Local Canvas: http://127.0.0.1:8080
Vercel project: `archits-projects-37ac7754/teamtrack`
Neon project: `long-fog-29044883`, production branch `br-divine-truth-b4gx3mk6` (Free).

Read `docs/planning/` (PRD, architecture, UI, implementation, deployment, research), `docs/releases/progress.md`, `deploy/README.md`, `docs/releases/asset-register.md`, README and active AGENTS.md before modifying.

Git branch `feat/demo-mvp`. HEAD `dbbf2e1` is implementation checkpoint; main `92a57dc` contains planning. Implementation checkpoint is not pushed yet. Many important subsequent fixes are uncommitted. **Preserve all working changes.** Review git status/diff. Final code should be committed/pushed and deployed after checks. GitHub automatic Vercel integration failed, direct CLI deploy works.

## URGENT: current local source is broken, deployed app still works
Immediately before handoff, an overly broad string replacement for the 3D welcome illustration accidentally deleted a middle section of `src/app/page.tsx` (from welcome-art through part of project header). Prettier reports line234: expected closing tag for section. Current file suddenly goes from welcome-art to project-right. This is a known accidental edit, not an architectural issue.

Backup of current damaged page: `.local/page-before-handoff.tsx` (ignored).
Recover only missing middle segment using `git show HEAD:src/app/page.tsx` as reference. Preserve all other uncommitted changes (roster status, agreement concurrency/history, stable event IDs, checkpoints, fonts, etc.). Do NOT reset the whole repo. If restoring whole page from HEAD is unavoidable, explicitly reapply the post-checkpoint improvements listed below.

New `src/components/companion-model.tsx` is an original procedural Three.js mascot: rounded cream head, blue body, eyes, antenna and orbit. Uses RoundedBoxGeometry; reduced motion, WebGL fallback, visibility pause and resource disposal. `three` / `@types/three` were being installed; confirm package-lock and npm installation finished. Page dynamically imports it with ssr:false. CSS overrides appended at bottom of globals.css. Component was formatted; page formatting failed. No final typecheck/build/render for these latest visual edits. Inspect 3D rendering on real browser and mobile; keep it unobtrusive.

## Canvas error and identified root cause
Latest user saw: `This Canvas launch expired or could not be verified. Return to your course and launch TeamTrack again.`
Sanitized Vercel log identified **RS256 key modulusLength must be >=2048 bits**. Official Canvas development dynamic_settings.yml ships tiny example signing keys. We correctly kept JOSE security strict and upgraded synthetic Canvas keys instead.
Generated three2048-bit RSA private JWKs locally in ignored `.canvas-sandbox/teamtrack-platform-jwks.json`. Ruby script `.canvas-sandbox/teamtrack_upgrade_keys.rb` replaced lti-keys mapping in `.canvas-sandbox/config/dynamic_settings.yml`. Script confirmed success without printing keys. `docker compose --project-name teamtrack-canvas restart web jobs` was started immediately before handoff. Confirm containers restarted, verify PUBLIC JWKS modulus lengths only (never print private material), then fresh Canvas launch. **This fix has not yet been end-to-end verified.**

Earlier LTI issue fixed: Canvas global client ID is **10000000000001**, not local DB id1. Registration now uses correct global ID. Deployment ID `2:ace899fd1089744c0691ace68ac51dff83e5854d`. Issuer/origin same ngrok HTTPS URL. Auth `/api/lti/authorize_redirect`, token `/login/oauth2/token`, JWKS `/api/lti/security/jwks`.
Actual course tool currently opens new window (course_navigation windowTarget='_blank') to diagnose iframe Chrome blocked-page issue. Once secure top-level launch works, try embedded launch again using normal Canvas settings; CSP allows configured Canvas origin and launch cookie SameSite=None Secure. Do not claim embedded integration verified until tested.

Canvas Docker compose project `teamtrack-canvas`, services postgres,redis,web,jobs. Sandbox source ignored `.canvas-sandbox` (~723MB); bundled dependencies/assets/DB live in named volumes. Do not alter unrelated `catalog_db` container. Sandbox official source was built, assets compiled, DB initialized. Course1 CSS474, teacher DrMorganLee and8 synthetic students seeded by `.canvas-sandbox/teamtrack_setup.rb`. Canvas admin username `demo-instructor@teamtrack.example`; password is in ignored `.canvas-sandbox/.env`. User already logged in **Chrome**, not Safari. Do not print password or ask to paste secrets in chat. Student credentials are in container `/usr/src/app/tmp/teamtrack-demo-accounts.json` (synthetic, do not print).
Ngrok static free domain is authenticated and was running. Keep Docker + tunnel running for demo. Restart steps in deploy/README.md. If interrupted, verify process and restart exact existing tunnel, no new service registration.

## Implementation and important uncommitted fixes
Next16.4/React19.3/TypeScript, postgres.js, jose, Vitest; API and UI deployed together Vercel, Neon Free storage.
- DB uses transactional JSON aggregate per namespace with SELECT FOR UPDATE, deliberately simple MVP; documented deviation from planned Prisma normalized schema.
- Standalone role-selector demo is public synthetic namespace `demo`; real Canvas namespaces isolated by hash issuer/client/deployment/course. Never mix real and fake roster/work.
- Instructor sees all teams; students only own team. Active roster membership rechecked. Mutations same-origin + CSRF, validation, optimistic task versions.
- Task create/update, owner/status/blocker, contribution/comment with HTTPS evidence, author-only contribution edits; immutable event history.
- Agreement publish keeps previous bodies/acceptances in agreementHistory and requires expected version; accept current version only.
- Team create instructor-only enrolled unassigned members. Project brief edit.
- NEW checkpoints added to types/domain/seed and UI modal (`checkpoint.create`), tests passed before page corruption. Seed Discover/Define/Prototype/Share.
- Stable task events now entityId, not title matching.
- Canvas NRPS server-side RSA assertion, readonly membership scope, bounded paginated fetch, validate origin/timeouts, stage before transaction, missing members inactive.
- Roster failures previously swallowed: now metadata table tracks syncing,lastSync,error; instructor-visible status+retry; lock expires after5min.
- LTI state one-use5min, nonce, issuer/aud/deployment/role/signature checked, JOSE remote JWKS. Private TeamTrack key only server env. Login errors readable HTML; sanitized server logs contain reason/public issuer/client only. Launch errors generic JSON401.
- Added Manrope local font in public/fonts with OFL; CSS secondary font size increased for projector.

Independent reviewer found four issues (roster retry/error, old agreements, agreement concurrency, title-based history); all addressed in uncommitted code but final re-review pending. Avoid losing these while repairing page.

## Secrets and deployment
`.env.local` contains DATABASE_URL,SESSION_SECRET,APP_URL,DEMO_MODE,LTI_PRIVATE_JWK,LTI_REGISTRATION. Already uploaded to Vercel server env with stdin, no secrets printed. Never commit/expose .env, JWKs, .canvas-sandbox, dumps. Verify `git check-ignore` before commit/push. `.vercelignore` excludes sandbox, env, docs, originalPDF.
CLI authenticated. Use `npx vercel --prod --yes` after tests. Stable alias teamtrack-kappa.vercel.app. Latest successful deployment before3D edits: https://teamtrack-19lfo2cps-archits-projects-37ac7754.vercel.app (`dpl_9nPkkbWq185XjhqrEsRVu2nHej2R`). Live does not contain latest checkpoints/3D changes.

Prior automatic approval rejections: broad Neon CLI OAuth; independent HTTP admin-login workaround; agent clicking ngrok interstitial; initial key upload before explicit approval. Safe alternatives used (Neon dashboard, user browser login/interstitial, user explicitly approved key storage). Do not bypass these barriers or weaken auth. No need to ask again for already authorized app deployment/build.

## Verification status and remaining work
Previously passed: unit **19/19**, local and deployed HTTP integration **5/5**, lint,typecheck,production build, production dependency audit **0 vulnerabilities**. Those are historical results BEFORE latest visual edits; rerun fresh. Dev-tool audit has issues mostly Vercel tooling; do not force-upgrade blindly.
Commands from package.json:
- npm test
- npm run typecheck
- npm run lint
- npm run build
- npm run test:integration (local dev required)
- TEST_BASE_URL=https://teamtrack-kappa.vercel.app npm run test:integration
- npm run demo:reset (explicitly only synthetic demo namespace, Canvas preserved)
- node --env-file=.env.local --import tsx scripts/clean-test-records.ts (remove clearly marked QA entries; inspect script first)

Browser evidence already: deployed student login, own-team filtering, local professor task drawer comment save,390px viewport no overflow and screenshot. Need fresh final browser QA after visuals: instructor/student workflows, errors, agreement publish/accept, contribution evidence/edit, task create/update, professor team overview, checkpoints,3D and mobile. Real Canvas launch+roster remains unverified due tiny Canvas keys, now upgraded.

Suggested completion order:
1. Repair page deletion preserving fixes; confirm Three dependencies; typecheck/lint/build.
2. Finish real Canvas launch after key restart; inspect sanitized logs for further failures; verify roster instructor role and isolation; retry iframe if feasible.
3. Browse logged-in21st.dev/Uiverse in Chrome; finish coherent visual polish and lightweight3D companion. Inspect rendered UI and reduced motion/mobile.
4. Fresh tests, reviewer check, production deployment, production API+browser checks.
5. Reset standalone demo to clean seeded state (new seed includes unassigned students+checkpoints), preserve Canvas data, verify clean demo again.
6. Update asset register (Three MIT, original procedural model), release progress/report and demo instructions with actual verified behavior and any limitations.
7. Inspect final diff, secret-ignore checks, commit/push authorized code; hand user live app/repo and short demo steps. Do not falsely claim Canvas embedded success.

Do not spend remaining time recreating planning. User needs actual demo-ready product tomorrow. Honest prioritization: working deployed standalone demo remains available even if Canvas sandbox integration needs more work.
