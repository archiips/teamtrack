# MVP operations

Public app: https://teamtrack-kappa.vercel.app
Repository: https://github.com/archiips/teamtrack
Hosting: Vercel Hobby and Neon Free; no paid add-ons. For live demos the app ships its own demo LMS at https://teamtrack-kappa.vercel.app/lms, which launches TeamTrack over real LTI 1.3 (OIDC login, signed id_token, Names and Roles roster). Real Canvas is a local synthetic sandbox, exposed temporarily through the configured free ngrok domain.

## Live demo accounts

Every person in the synthetic class signs in with `<first name>@teamtrack.test` and the shared demo password (`DEMO_PASSWORD` in Vercel and `.env.local`; ask the team, it is not in Git). The same accounts work on TeamTrack's sign-in page and on the demo LMS.

| Who                                                      | Email                           | Team                                         |
| -------------------------------------------------------- | ------------------------------- | -------------------------------------------- |
| Dr. Morgan Lee (professor)                               | morgan@teamtrack.test           | all teams                                    |
| Alex Chen, Jordan Miller, Taylor Brooks, Priya Shah      | alex@, jordan@, taylor@, priya@ | Wayfinders                                   |
| Sam Rivera, Jamie Park, Casey Nguyen, Riley Jones        | sam@, jamie@, casey@, riley@    | Open Campus                                  |
| Maya Thompson, Ethan Walker, Sofia Garcia, Noah Williams | maya@, ethan@, sofia@, noah@    | Quiet Corners                                |
| Leah Cohen, Omar Haddad, Grace Liu, Diego Santos         | leah@, omar@, grace@, diego@    | Step Free                                    |
| Devon Kim, Avery Patel                                   | devon@, avery@                  | not on a team yet (for the create-team demo) |

The demo LMS course and the public app share one workspace (the `demo` namespace), so a change made in one shows in the other.

## App development and checks

```
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run test:integration` requires the local app on port 3000. To check deployment: `TEST_BASE_URL=https://teamtrack-kappa.vercel.app npm run test:integration`. These checks write clearly marked records only to the synthetic demo. `node --env-file=.env.local --import tsx scripts/clean-test-records.ts` removes those marked updates.

Secrets stay in ignored `.env.local` locally and Vercel server environment settings: DATABASE_URL, SESSION_SECRET, LTI_PRIVATE_JWK (TeamTrack's tool key), LMS_PRIVATE_JWK (the demo LMS platform key), DEMO_PASSWORD. APP_URL is the stable production URL. LTI_REGISTRATION contains the exact platform issuer, global client ID, deployment ID, endpoints and allowed origin. Never copy the private key into Git or public docs.

## Canvas restart after laptop restart

Open Docker Desktop, then:

```
cd .canvas-sandbox
docker compose -p teamtrack-canvas up -d postgres redis web jobs
```

In another terminal:

```
ngrok http http://127.0.0.1:8080
```

Use the same ngrok account/domain configured during setup. If hostname changes, update Canvas domain/security settings and the exact registered issuer/origin/endpoints on Vercel. Do not add wildcard platform registrations.

Canvas course: https://duct-groggy-kitten.ngrok-free.dev/courses/1
Canvas TeamTrack launch: https://duct-groggy-kitten.ngrok-free.dev/courses/1/external_tools/2
Synthetic administrator username: demo-instructor@teamtrack.example. Its password is in ignored `.canvas-sandbox/.env`. Synthetic student login records are in the Canvas `tmp` named volume at `/usr/src/app/tmp/teamtrack-demo-accounts.json`; use the Canvas administrator's normal masquerade UI if a student walkthrough is needed. Never paste credentials into chat or the repository.

Do not stop Docker or the tunnel during the Canvas demonstration. The standalone public app remains available without them.

## Important Canvas setup correction

Canvas LTI client IDs are **global** DeveloperKey identifiers (`developer_key.global_id`), not local database IDs (`developer_key.id`). This sandbox's two values differ. Verify issuer and global client ID before investigating browser framing: an application/json rejection in a cross-origin frame can appear as a Chrome blocked page rather than a readable configuration error. LTI initiation errors now use a readable HTML page.

## Real accounts (classes and groups)

Anyone can create an account on the live site, create a workspace and share its invite code; see the main README. Real workspaces (`w_…` namespaces) live in the same Neon database as the demo. `npm run demo:reset` never touches them.

- Forgotten password (no email service): `node --env-file=.env.local --import tsx scripts/reset-password.ts person@school.edu` prints a one-time password once. Share it privately; they change it from the avatar menu.
- An instructor or organizer can replace a leaked invite code from the Invite dialog; people already in stay in.
- Don't run `npm run test:accounts` against production: it creates accounts.

## GitHub App (repo activity per team)

Register once for the whole site; after that every team connects its own repo from **My team → Connect GitHub repo**, with no per-team setup. Until these env vars exist the GitHub features stay hidden.

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**.
   - Name: anything unique, e.g. `TeamTrack CSS 474`. Homepage: `https://teamtrack-kappa.vercel.app`.
   - Callback URL: `https://teamtrack-kappa.vercel.app/api/github/callback`. Check **Request user authorization (OAuth) during installation**.
   - Webhook: active, URL `https://teamtrack-kappa.vercel.app/api/github/webhook`, secret = a long random string (`openssl rand -hex 32`).
   - Repository permissions: **Contents: Read-only** (GitHub puts the commit list under it), **Pull requests: Read-only**, Metadata: Read-only. Nothing else.
   - Subscribe to events: **Push**, **Pull request**.
   - Where can it be installed: **Any account** (students install it on their own repos or class orgs).
2. After creating: note the App ID, Client ID and the slug (the last part of the app's public URL); generate a client secret and a private key (.pem).
3. Vercel → teamtrack → Settings → Environment Variables (Production): `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, and `GITHUB_APP_PRIVATE_KEY` = `base64 -i key.pem | tr -d '\n'` (raw PEM also works). Redeploy. Delete the .pem from Downloads afterwards; never commit it.

TeamTrack reads only the last 100 commits and recent merged pull requests of the linked repo, cached for 10 minutes and refreshed on push. Linking is verified with the leader's own GitHub sign-in, so a team can only connect repos its leader can access. Local test harness: `tests/e2e/README.md`.

## Team chat and attachments

Each team has one persistent conversation under **Team chat**. Current team members and instructors can read and send; the visibility is labeled in the UI. Removed/inactive members lose access, including downloads. Messages refresh every five seconds while the chat is visible; older history loads on request. This version has no DMs, message editing/deletion, read receipts or file previews.

Task comments and contributions accept private attachments too. `teamtrack_task_file` stores their bytes separately; file metadata, the entry and its activity event save together. Deleting a task removes its file records and releases quota. Normal workspace command requests cannot attach arbitrary file IDs.

Chat uses the existing PostgreSQL connection; no additional service, credentials or package is needed. `teamtrack_chat` and its team/history index are created on first chat access. Messages and private binary attachments are separate from workspace JSON, so normal workspace polling does not transfer file bytes or chat history. File downloads authenticate and recheck current team access every time; there are no public file URLs. All uploads download as attachments rather than rendering in the app origin.

Limits: one file per message, 3 MiB per file, 4,000 characters per message, 50 MiB of attachments per workspace, shared across chat and task updates. At the attachment quota, text and links still work. These limits keep the classroom MVP within the existing function request budget and bound database storage per workspace; monitor total database usage as workspaces grow. Larger files/high-volume use should move attachment bytes to private object storage. The no-database local file-store mode does not support chat.

`demo:reset` clears the synthetic `demo` chat as well as its workspace. Other namespaces are untouched. Deleting a practice workspace on restart cascades to its chat through the database foreign key. Database backups must include `teamtrack_chat` and `teamtrack_task_file`, including `file_data`; copying only `teamtrack_state` does not back up conversations or files.

## Reset and release

`npm run demo:reset` resets only the standalone `demo` namespace, its demo accounts (they re-create with the current DEMO_PASSWORD on next sign-in; run it after changing the password) and its demo LMS roster link (reconnects on the professor's next LMS launch). It never resets Canvas course workspaces. Use only for rehearsal/presentation preparation, not after collecting real pilot work.

Manual deploy after checks: `npx vercel --prod --yes`. Automatic GitHub deployment was not connected successfully; do not assume pushes deploy. Never run production migrations against preview/test databases accidentally. The current synthetic MVP uses transactional PostgreSQL JSON aggregates with optimistic task/agreement versions; it is not the normalized institutional-scale schema in the original architecture proposal.

## Demo script

1. Open the public app and sign in as morgan@teamtrack.test. Point out Pip in the corner: open it to show what needs support (blocked task, pending agreements, unassigned students).
2. Show teams needing support and inspect the blocked route task.
3. Sign out and sign in as alex@teamtrack.test, accept the agreement, add evidence to the interview task and mark it done.
4. Sign back in as the professor, inspect the recorded actor, evidence and event history.
5. LMS launch (always online): open https://teamtrack-kappa.vercel.app/lms, log in as the professor, click TeamTrack in the course menu. It launches embedded over LTI 1.3 and shows "LMS connected" and "Roster synced". Log in as a student to show the student view.
6. Canvas (only while Docker + ngrok run): open https://duct-groggy-kitten.ngrok-free.dev/courses/1 and click TeamTrack in course navigation. It launches embedded in Canvas, shows the course name, instructor role and "Roster synced". Use Sync Canvas roster, then Teams & people to create a team from the real roster.

Pitch backup: `video/out/teamtrack-demo-short.mp4` (19s) and `video/out/teamtrack-demo.mp4` (60s) show the same flow if Canvas or the network is unavailable (see video/README.md).

Canvas course data is separate from the synthetic demo; demo:reset never touches it. If the embedded frame misbehaves on another browser, the launch also works top-level at `/courses/1/external_tools/2?display=borderless`.

## Email recovery and daily reminders

For the free demo setup, create a Brevo account, verify a sender email under Settings → Senders, and create a sending API key under SMTP & API. Set `BREVO_API_KEY` and `EMAIL_FROM` to that verified email. Brevo may replace the visible sender domain for free email addresses; no custom domain purchase is needed for this setup. Account activation/approval must be complete before live delivery.

Alternatively, set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `TeamTrack <notifications@your-verified-domain>`), plus `APP_URL` to the canonical HTTPS site URL. Do not commit credentials. Password recovery remains explicitly unavailable until these are configured; it never returns a reset link in an API response. Resets expire in 30 minutes, are single-use, and revoke existing sessions.

Set a random `CRON_SECRET` in Vercel. `vercel.json` schedules `/api/cron/reminders` daily at 16:00 UTC. Vercel supplies `Authorization: Bearer <CRON_SECRET>`. Users opt into a daily email digest per workspace in the bell inbox; in-app reminders work without mail. The daily job skips practice workspaces, rechecks membership, and records delivery to prevent duplicate sends. Provider failures return an error for inspection and can be retried. Brevo is selected when `BREVO_API_KEY` is set; otherwise Resend is used. All email tests use a mocked transport: verify one supervised delivery with a controlled recipient after configuration before enabling real participants.

Professor entry uses the same account credentials; it does not elevate existing workspace permissions. Classes organize separate workspaces. Owners can generate a single-use, seven-day professor monitoring link under Invite, replace unused links, and remove monitoring access. Monitors have read-only access to precisely that workspace. Group identity remains stable when a monitor joins.
