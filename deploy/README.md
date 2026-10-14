# MVP operations

Public app: https://teamtrack-kappa.vercel.app
Repository: https://github.com/archiips/teamtrack
Hosting: Vercel Hobby and Neon Free; no paid add-ons. Real Canvas is a local synthetic sandbox, exposed temporarily through the configured free ngrok domain.

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

Secrets stay in ignored `.env.local` locally and Vercel server environment settings: DATABASE_URL, SESSION_SECRET, LTI_PRIVATE_JWK. APP_URL is the stable production URL. LTI_REGISTRATION contains the exact platform issuer, global client ID, deployment ID, endpoints and allowed origin. Never copy the private key into Git or public docs.

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

## Reset and release
`npm run demo:reset` resets only the standalone `demo` namespace. It never resets Canvas course workspaces. Use only for rehearsal/presentation preparation, not after collecting real pilot work.

Manual deploy after checks: `npx vercel --prod --yes`. Automatic GitHub deployment was not connected successfully; do not assume pushes deploy. Never run production migrations against preview/test databases accidentally. The current synthetic MVP uses transactional PostgreSQL JSON aggregates with optimistic task/agreement versions; it is not the normalized institutional-scale schema in the original architecture proposal.

## Demo script
1. Open the public app and choose the professor profile.
2. Show teams needing support and inspect the blocked route task.
3. Switch demo profile to Alex, accept the agreement, add evidence to the interview task and mark it done.
4. Switch back to professor, refresh, inspect the recorded actor, evidence and event history.
5. Separately demonstrate genuine Canvas launch and roster sync only after their checks pass. A synthetic profile selector is not Canvas authentication.
