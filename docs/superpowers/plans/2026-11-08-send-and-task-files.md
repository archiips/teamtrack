# Visible send controls and task attachments

User authorized live verification, fixing the missing Send control, and uploads in chat and task comments. Continue the existing work and deployment, preserving unrelated uncommitted changes.

## Discovery and evidence
Live Chrome, without scrolling after opening Team chat: Send y=1023 on 1440×900; y=957 on 390×844; y=800 on 390×500. It exists but is below the viewport because the promotional heading, project strip, fixed-height transcript and composer stack vertically. Earlier auto-scrolling locator.click and full-page screenshots did not prove discoverability. Existing private chat upload/download service works; task entries only support HTTPS links.

## Design and alternatives
- Keep chat in the existing app, but use a compact, viewport-sized chat view. Preserve the project/team selector, make only messages scroll, keep Attach and Send visible. Respect dynamic viewport and phone bottom navigation; give the composer priority on short screens. Pip remains available in other views; suppress its overlapping dock only in chat.
- Add one private file (3 MiB) to a task comment or contribution, including attachment-only posts. Reuse bounded multipart validation and download headers. Separate task file bytes from State; save file metadata, attributed entry and event in one database transaction. Shared 50 MiB workspace quota across chat/task files; downloads reauthorize current team and confirm the task/entry still exists. Task deletion cleans its binary records in the same transaction.
- Add a focused task-entry composer component rather than more logic in page.tsx. Existing plain text/link posting stays functional, including file-store demos. File uploads require PostgreSQL as chat does.
- Do not upload first then link later (orphans/races); do not trust attachment IDs submitted through the normal command API. Use request UUID + content digest for lost-response retries. No new external service/dependency.

## Checkpoints and acceptance
- [x] 1. Add failing viewport checks for Send and Attach entirely above the bottom navigation at desktop, 390px phone, 320px phone and keyboard-sized height, including a long filename and error. Implement compact chat layout; test Enter/Send/file-only paths and no overflow.
- [x] 2. Add failing HTTP tests for POST /api/task-entries and GET /api/task-entries/files/[id]. Implement task entry + binary file transaction, current team authorization, safe filename/download, exact bytes, retry idempotency, shared quota, oversize failures, task deletion and attachment-only input. Existing chat never exposes task files.
- [x] 3. Add task-comment/contribution attachment UI and links. Verify comments and contributions, text-only/file-only/text+file, remove/reselect, upload failure preserves draft, teammates/instructor can download after reload; foreign team/namespace denied.
- [x] 4. Run full unit, existing/chat/task HTTP suites, typecheck, lint, build; browser chat/practice and realistic tasks/agreements/onboarding flows. Check Chromium and WebKit where available, desktop/mobile/dark. Fresh-context code review, then deploy to the existing production site and smoke-test live.

## Critique
Correctness: transactional metadata/event/file prevents orphan uploads; active team authorization on every download. Simplicity: existing Postgres and validation, no vendor. Privacy: private downloads, no file previews or public URLs. Maintainability: separate composer/repository. UX: tests assert actual viewport bounds and enabled send before clicking; file selection and errors must not hide controls. Validation cannot establish every device or every integration; report exact tested coverage.

## Verification before deployment
- Live missing-button reproduction: Send entirely below initial viewport in desktop/phone/short-phone sizes. Failing viewport assertion observed before CSS changes.
- New task HTTP tests failed against the previous deployment before implementation. Final isolated HTTP pass: 27/27 across api, accounts, chat and task-files tests. An earlier paging run overlapped browser message writes; rerun alone passed unchanged.
- Unit56/56, typecheck, lint, production build and diff whitespace checks pass.
- Chrome and WebKit: four viewport cases each (1440x900,390x844,320x568,390x500), Send/Attach bounds before auto-scroll, long filename+error, visual viewport resize; pass. Task-file browser journeys in both engines pass: comment+file, file-only contribution, teammate/instructor download, reload, lost-response retry, mobile layout. No page errors.
- Fresh review found hidden contribution URL could block a comment and active-tab clicks could reset a retry UUID. Both reproduced in real browser tests (422 hidden URL; duplicate attachment on retry). Fixed by sending URLs only for contributions and changing kind/request identity only for an actual kind change. Regression passes in both engines.
- Existing Chrome chat suite9/9 and practice walkthrough12/12 pass. Mixed chat/task quota, task-delete storage release and valid-file cross-workspace denial pass.
- Rendered phone/short-screen task/chat screenshots inspected. WebKit local production-HTTP failures traced to Secure cookie transport, not app logic; WebKit tests passed on isolated local development server. Deployed HTTPS will be checked directly.
- Observation #13: Verify primary controls without automatic scrolling. Shared log persisted; no skill edits.

## Production verification and handoff
`npx vercel --prod --yes` completed READY, deployment dpl_BLGNNusYF42KCxJKkK9tq21mpGAh, alias https://teamtrack-kappa.vercel.app.
Actual production QA ran in a newly created private single-person workspace: Chrome phone viewport verified initially visible Send, file-only chat upload/download with exact bytes, and file-only task comment/download. WebKit HTTPS at 320px verified initially visible Send, another chat upload/download, and the task file download. No page errors. Cleanup verified the exact generated account and single-user workspace before deleting; cascade removed its messages and attachments. No real class/team data modified.

Source remains uncommitted in the persistent project checkout. Browser screenshots under /private/tmp are reproducible outputs, not the authoritative source. No claim is made that every physical device, third-party keyboard or Canvas embedding configuration was exercised.
