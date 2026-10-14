# TeamTrack

A deployed classroom MVP for student teamwork and professor oversight, with task ownership, blockers, attributed evidence, versioned agreements and an activity history.

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

`npm run test:integration` checks HTTP authorization and persistence against a running app. See the operations guide before resetting synthetic data or deploying.
