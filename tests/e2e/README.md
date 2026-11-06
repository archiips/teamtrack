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
