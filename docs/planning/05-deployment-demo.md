# TeamTrack deployment and demo runbook

Status: planned procedures; no resources provisioned or checks executed.

## Sandbox strategy
Use a genuine Canvas instance with administrator permission to create an LTI developer key. First seek an available hosted developer/test tenant; do not assume Free-for-Teacher includes the needed administrator controls. If none is available, use the official open-source Canvas Docker development setup on a controlled development machine. That is a local sandbox, not a production-hosting recipe. TeamTrack itself remains publicly deployed over HTTPS. A fully remote Canvas sandbox requires separately secured hosting and a resource/cost check.

Checkpoint zero: verify administrator access, create a synthetic course with one instructor and eight students, record issuer/auth/token/JWKS endpoints, register course_navigation and readonly NRPS, test launch and full roster retrieval. A standards simulator can help unit/integration development, but only a real Canvas launch satisfies final acceptance.

## App release
1. Use Vercel Hobby and Neon Free accounts only. Keep the GitHub repository in the personal account. Decline upgrades and paid add-ons.
2. Configure HTTPS app domain and database network access. Store keys and credentials in host secret management.
3. Configure registered Canvas origin and endpoints; publish reachable tool config and public JWKS.
4. Build Next.js on Vercel, apply reviewed migrations using prisma migrate deploy as a controlled release step, deploy and check readiness.
5. Seed the synthetic course idempotently with operator credentials. Never run a global destructive reset.
6. Install the LTI tool using client ID in the sandbox course and enable TeamTrack navigation.
7. Validate instructor/student launches, roster refresh, iframe session persistence and course isolation on deployed URLs.
8. Capture evidence: revision, migration state, test outputs, screenshots, tested browser versions, known limitations and deployment URL in a release report.

MVP uses stateless Vercel Functions; no in-memory session/state storage. Keep database credentials out of browser code. Allow framing only by registered sandbox origins. Disable public role-switcher routes unless DEMO_MODE is enabled; isolated synthetic demo credentials cannot access real courses.

## Synthetic fixture
Course: Product Development Lab, America/Los_Angeles. Project: Campus accessibility study. Two teams of four students. Include an accepted team agreement, one member awaiting acceptance, an overdue open task, a blocked task, completed research with an HTTPS evidence link, and a checkpoint due soon. Relative dates generated from explicit demo anchor date; reset reproduces the same scenario. Use invented names and no real student information.

## Five-minute live demonstration
1. Instructor opens Canvas course and clicks TeamTrack. Show recognized course/role and imported roster.
2. Open team attention list. Explain 'blocked task' and 'agreement awaiting acceptance' as concrete reasons.
3. In a separate student browser profile, open the same tool and accept the agreement.
4. Update an assigned research task, attach a brief evidence link, mark it done and record a blocker on another task.
5. Refresh instructor view. Show persisted changes, author/timestamps and the underlying evidence.
6. Explain that recorded activity supports faculty judgment and is not an automatic grade.

Show actual actions and results, not static screen cuts. Keep instructor/student profiles separate; do not pretend a role-switch button is Canvas authentication.

## Recovery and rollback
Rehearse one expired launch, denied roster permission and network interruption. Preserve database state on Canvas failure and show last successful sync. Have a separately labeled standalone synthetic-demo entry for continuing the product walkthrough if Canvas is unavailable; disclose the integration outage. Keep screenshots/video as backup evidence, not proof of a currently working integration.

Before demo: warm service, verify HTTPS/JWKS, roster and student session, snapshot database, test isolated reset. If release fails, redeploy the previous Vercel deployment; avoid reverse destructive migrations. Restore pre-demo database snapshot only for the synthetic sandbox after operator confirmation. No unattended reset jobs.

## Release gates
All R1-R13 pass or release is explicitly incomplete. Required evidence: Chrome embedded core journey; Safari tested with documented outcome/fallback; cross-team denial; stale-edit handling; complete-sync-only membership removal; persistence after service restart; screenshot/accessibility review. No completion claim from a successful build alone.

## Zero-cost deployment decision (2026-10-13)
| Service | Plan | Role | Cost boundary |
|---|---|---|---|
| GitHub personal public repo | Free | Source and plans | No paid Actions runners |
| Vercel | Hobby | Next.js frontend plus API/LTI endpoints, HTTPS *.vercel.app | Non-commercial educational demo; quotas apply |
| Neon | Free | Persistent PostgreSQL | 1 GB/project, 100 CU-hours/project/month, 5 GB public transfer/project per current docs |
| Canvas | Local open-source sandbox | Genuine instructor/student LTI launch | Existing laptop/container runtime; not an always-on public service |

Expected hosting bill: $0 while using these free plans within quotas. Not an unlimited-availability promise. Never enable a paid upgrade automatically. If a quota blocks the demo, reduce usage or surface the limit; do not purchase capacity. Neon sleeps after five minutes idle, so rehearse after cold start and open the app before presentation. No keepalive polling to defeat free-tier suspension.

Local Canvas remains reachable only on the demo machine unless separately exposed. The deployed Vercel server must reach the sandbox's JWKS, token and roster endpoints: provide a vetted free HTTPS tunnel during integration/demo, or use an available institution-provided sandbox at no cost. Confirm stable endpoints, tunnel policy and reachability in checkpoint zero; free tunnel availability is not assumed. Limit exposure to the demo duration and synthetic users. Without a reachable real sandbox the Canvas integration is incomplete, even if standalone TeamTrack is deployed.

Use the stable production *.vercel.app hostname for LTI registration, not per-commit preview domains. Preview deployments use an isolated development database and cannot access demo-course credentials. Production release is manual after checks; ordinary preview builds never run production migrations. No paid email, AI, file storage, 3D hosting or monitoring is required.

Sources checked 2026-10-13: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel limits](https://vercel.com/docs/limits), [Neon plans](https://neon.com/docs/introduction/plans). Recheck at provisioning because limits can change.
