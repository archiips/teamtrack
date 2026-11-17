# Professor access and reminders implementation plan

Goal: extend existing accounts with professor entry and explicitly invited monitoring, class organization, actionable reminders, and password recovery. Preserve student/team privacy, all existing workspaces, and current chat/file work.

Discovery: accounts already span workspaces; instructor workspaces contain teams. Invite codes currently always create students. Group detection depends on absence of instructors and must stay stable when a monitor joins. Chat currently requires Ctrl/Cmd+Enter. Password recovery is operator-only. Existing source changes are uncommitted; preserve this checkout's baseline and do not commit unrelated changes.

Design choices awaiting user: nested class/team workspaces versus existing class workspace with teams; in-app versus email reminders. Implement independent keyboard/UI work while awaiting these answers. No implicit role escalation from a professor login button.

Milestones and checks:
- [x] Professor flow: explicit entry, permission-scoped invitations, multiple classes/workspaces. Test student invite cannot elevate role, monitor cannot gain unrelated class access, existing group behavior stays stable.
- [x] Notifications: pending contract acceptance/votes and relevant tasks, scoped to authorized data; avoid duplicates and stale reminders, provide navigation and persistent read state.
- [x] Password recovery: generic response, random hashed single-use expiring tokens, shared rate limits, trusted reset origin, mail delivery only when configured, invalidate old sessions. Test expiry, replay, unknown accounts, and delivery failure.
- [x] Chat: Enter sends, Shift+Enter newline, IME composition never sends; retain visible Send and file-only sends. Test browser interactions.
- [x] Overview: direct labels and distinct accents with accessible contrast and mobile layout.
- [x] Run unit, HTTP permission/recovery checks against isolated local database, typecheck, lint, build, and browser checks. Review diff and update Linear based on fresh evidence.

Critique: avoid replacing the existing workspace model unnecessarily. A professor entry is navigation, not proof of authorization. Monitor invitations need revocation and stable group identity. In-app reminders should derive from current state so resolved work disappears. Email requires deployment credentials and a verified sender, so do not claim production delivery without a real configured provider. Do not connect tests to .env.local's database.

Linear: TEA-17 professor; TEA-18 reminders; TEA-19 recovery; TEA-20 cards; TEA-21 keyboard.

Confirmed: classes contain team workspaces, plus independently invited workspaces; include email reminders and password resets. Implement classes as an additive account-owned grouping of authorized workspaces, preserving workspace boundaries and existing teams. A professor may only create/attach workspaces to classes they own. A monitor invite grants read-only instructor visibility to exactly its workspace, never automatic membership of sibling workspaces. Store group/class identity explicitly so a monitor joining never changes student group semantics. New professor entry sets an onboarding preference only, not authorization.

Execution: root owns class/workspace flow and integrations; recovery and notifications use distinct files. No concurrent edits to the same files. Keep existing dirty checkout as the authoritative source; no source in temporary folders. No commits or deployment implied. Local mail capture only; live mail configuration remains an external dependency.

Review: corrected inactive monitor re-invitation, disabled monitoring edit controls, added daily cron schedule, verified revocation and invitation replay. Browser checks cover professor signup/class/child workspace/invitation, mobile overflow, reset completion, reminders, Enter/Shift+Enter/IME. Security audit found two Next cache advisories in 16.4.3; patched Next and eslint-config-next to compatible 16.4.6. Production npm audit now reports 0.

Email: user has no mail provider/domain. Added free-demo Brevo transport (verified sender address, provider may rewrite free sender domain) alongside optional Resend. Account setup and a supervised real delivery remain required before claiming live email is active. No live email has been sent.

Final handoff: source and plan persist in the project checkout. No commit, push, deployment, or live email was performed. Checks: unit61; recovery/reminder DB5 + cron1; feedback HTTP4; accounts4; chat11; files6; professor/feedback/recovery browser suites; lint/typecheck/build/diff-check. Provider activation is the only external prerequisite for live emails.
