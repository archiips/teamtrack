# TeamTrack

A deployed classroom MVP for student teamwork and professor oversight, with task ownership, blockers, attributed evidence, versioned agreements and an activity history.

## Using it with a real class or group

1. Open https://teamtrack-kappa.vercel.app, choose **Create account** (name, email, password of 8+ characters).
2. **Create a workspace**: the class, project name and final due date. Pick "I'm a student" to set it up for your own group (you become its organizer), or "I'm the instructor" to see every team.
3. Press **Invite** (top right) and share the link or the 8-character code. People who open the link create an account and land in the workspace.
4. Each student opens **My team** and joins a team or starts one. Instructors can also create teams and add or remove people under **Manage**.
5. Add tasks with an owner and due date, post updates with evidence links, raise blockers, and accept the team agreement.

One account can belong to several workspaces; switch from the avatar menu (top right) or the workspace card in the sidebar. There is no email service: a forgotten password is reset by the operator with `scripts/reset-password.ts` (see the operations guide). Canvas is optional; it works without it.

**[Open the live demo](https://teamtrack-kappa.vercel.app)** · **[Operations and demo guide](deploy/README.md)** · **[Planning pack](docs/planning/README.md)**

Uses Next.js/TypeScript on Vercel Hobby and PostgreSQL on Neon Free. Public entry profiles contain synthetic data only. Canvas LTI integration endpoints and a genuine local sandbox are included; see the release report for verified integration status.

## Run locally

```
npm ci
cp .env.example .env.local
# Configure DATABASE_URL and SESSION_SECRET locally; never commit them.
npm run dev
```

Without DATABASE_URL, local development uses an ignored file store. Vercel requires PostgreSQL and a server-only session secret.

```
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run test:integration` checks HTTP authorization and persistence against a running app. `npm run test:accounts` checks sign-up, workspaces, invites and teams over HTTP; it creates accounts, so point `TEST_BASE_URL` at a local server with a local database, never production. See the operations guide before resetting synthetic data or deploying.
