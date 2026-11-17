# GitHub end-to-end check (local only)

Runs the real connect, pick, commit-matching, webhook and isolation flows against a
stand-in for GitHub, so no GitHub App or network is needed. Never point it at production.

1. Local Postgres on port 54329 (see docs/CLAUDE-HANDOFF.md).
2. `node tests/e2e/github-mock.mjs /tmp/ghkey.b64` (writes a test key on first run, port 3999).
3. Start the app wired to it:

   ```
   DATABASE_URL=postgres://tt@localhost:54329/teamtrack APP_URL=http://localhost:3100 \
   GITHUB_APP_ID=12345 GITHUB_APP_SLUG=teamtrack-test GITHUB_CLIENT_ID=test-client \
   GITHUB_CLIENT_SECRET=test-secret GITHUB_WEBHOOK_SECRET=hook-secret \
   GITHUB_API_URL=http://localhost:3999 GITHUB_WEB_URL=http://localhost:3999 \
   GITHUB_APP_PRIVATE_KEY="$(cat /tmp/ghkey.b64)" npx next dev -p 3100
   ```

4. `node tests/e2e/github.e2e.mjs /tmp` (screenshots go to the folder given). Expect 11 PASS.

Keep the two scripts' working copies outside the project tree while `next dev` runs if
you edit them: a changed file in the project makes the dev page reload.

# Team chat and scroll checks (local only)

Use an isolated local PostgreSQL database. `.env.local` may target production: explicitly override `DATABASE_URL` on the app process. Example after initializing a throwaway database:

```sh
DATABASE_URL=postgres://tt@127.0.0.1:54339/teamtrack \
APP_URL=http://localhost:3100 SESSION_SECRET=local-test-only-secret \
DEMO_PASSWORD=local-chat-demo-only npm run start -- -p 3100 -H 127.0.0.1
```

Build first with `npm run build` (or use `npm run dev -- -p 3100` with the same overrides). Use a different test port if one is already occupied; match `TEST_BASE_URL` below. Never point these checks at a local server that uses a production database.

```sh
npm test
TEST_BASE_URL=http://localhost:3100 DEMO_PASSWORD=local-chat-demo-only npm run test:chat
TEST_BASE_URL=http://localhost:3100 DEMO_PASSWORD=local-chat-demo-only node tests/e2e/chat.e2e.mjs /tmp/teamtrack-chat-checks
TEST_BASE_URL=http://localhost:3100 DEMO_PASSWORD=local-chat-demo-only node tests/e2e/scroll.e2e.mjs /tmp/teamtrack-scroll-comparison.json
```

The HTTP suite refuses non-loopback URLs. It creates accounts/workspaces, messages, and up to 50 MiB of logical attachment data to exercise the real quota and concurrent uploads. The browser suite needs Google Chrome and checks multi-user delivery, file downloads, draft preservation/retry deduplication, reading position, older history, denied-access recovery, mobile/dark layouts, and the hidden-document polling guard. Screenshots are written to the requested output directory.

The scroll script compares the original reveal/blur CSS against the optimized CSS in alternating order, six trials each, on the seeded instructor Teams screen at 1280×800 and 4× CPU throttle. Each trial measures a 1.4-second animation-frame-driven scroll, frame gaps and Chrome main-thread/style work. These controlled browser measurements do not establish performance on a user's device or Safari. Run it separately from other browser checks for the cleanest comparison.

## Task files and visible Send regression

With the isolated app/database above:

```sh
TEST_BASE_URL=http://localhost:3100 npm run test:task-files
TEST_BASE_URL=http://localhost:3100 node tests/e2e/send-visible.e2e.mjs
TEST_BASE_URL=http://localhost:3100 node tests/e2e/task-files.e2e.mjs /tmp/task-files
node tests/e2e/task-quota.e2e.mjs
```

The Send test checks the control's bounds before clicking (no auto-scroll), including 320px/390px phones, 500px height, long filenames, error state and a visualViewport resize. Task-file checks exercise comments/contributions, download bytes, permissions, reload, failed-response retry and active-tab deduplication. Mixed quota check uses only the local app on port 3100 and verifies another workspace cannot download an otherwise valid task file.

For WebKit, install `npx playwright install webkit` and run the two browser scripts with `BROWSER_ENGINE=webkit`. Local production builds set Secure cookies which WebKit will store but not send over HTTP; run WebKit's HTTP fixtures against `npm run dev -- -p 3101` with the same isolated database/env overrides and `TEST_BASE_URL=http://localhost:3101`. Production HTTPS keeps Secure cookies enabled. Run strict chat HTTP paging tests separately from chat-writing browser suites to avoid unrelated messages interleaving with their fixture assertions.

## Professor access, reminders and account recovery

Use the same isolated local app/database. `npm run test:feedback` covers professor invitations/class ownership and notification permissions. `DATABASE_URL=postgres://tt@127.0.0.1:54349/teamtrack npm run test:recovery` tests hashed expiring recovery tokens and persisted reminder state; mail delivery is mocked. `tests/reminder-delivery.test.ts` dry-runs the opted-in daily digest and duplicate suppression with no external sends. Tests that require this exact disposable database skip without the explicit URL.

Browser checks: `node tests/e2e/feedback.e2e.mjs`, `node tests/e2e/professor.e2e.mjs`, and `DATABASE_URL=postgres://tt@127.0.0.1:54349/teamtrack node tests/e2e/recovery.e2e.mjs`. Set `TEST_BASE_URL=http://localhost:3100`. They cover professor signup/classes/workspaces, monitoring links, reminders, mobile overflow, Enter/Shift+Enter/IME, and password-reset completion. Screenshots go under `/tmp/teamtrack-feedback/screens`. These create only disposable test accounts and never send remote mail.
