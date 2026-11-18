# Separate student and professor navigation

Outcome: a login choice selects a persistent portal, not just onboarding copy. One account may still have both roles, with an explicit switch. Existing memberships and permissions remain intact; no automatic promotion of Delta members.

Cause: AuthPanel stored a local hint, verifyLogin chose the last workspace irrespective of role, and API/UI returned all memberships.

Design: optional signed session portal for own accounts; login selects the latest matching membership; workspace response filters memberships/classes and refuses to render mismatched active state. Workspace actions preserve portal and reject accidental cross-portal switching/creation/join. Explicit portal action switches to matching membership or empty onboarding. Legacy sessions remain compatible and infer the active workspace role. Demo/LTI sessions retain their scoped behavior.

UI: visible portal identity and explicit switch in workspace/account onboarding navigation. Professor invitation links select professor entry; student invite codes clearly identified as student access. Private sample labels explain separate copies; practice reset only replaces samples for the selected role.

Rejected: separate accounts (unnecessary credentials), frontend-only filtering (does not fix login landing), global account role (breaks users who teach and study).

Checkpoints: reproduce wrong landing with HTTP test; implement session/API selection; update navigation/sample copy; exercise same-account role switching in browser; run existing suites/build; review diff; push development/main and deploy fix.

Acceptance: same account has student+instructor workspaces; each login and refresh returns only the matching list and landing; explicit switch works including no-workspace accounts; wrong-role switch/join cannot silently enroll professor as student; private practice does not replace opposite-role samples; no changes to real workspace data.

Validation: tests/portal-api.test.ts against disposable local Postgres; npm test, lint/typecheck/build; targeted account/professor HTTP regression tests; isolated Chrome role switching/refresh and practice labels. Production read-only health and login screen checks after deployment.

Critique: portal is navigation, never privilege escalation. Token/invite checks and membership remain authoritative. Optional portal handles old sessions without forcing sign-out; explicit switching is required for new sessions. Labels must not imply a new sample was auto-created. Avoid changing Alan's access or resetting user samples during migration.
