# TeamTrack product requirements

Status: proposed MVP scope for review.

## Problem and hypothesis
Student group projects can hide unclear ownership, missed milestones and unequal participation. Professors need evidence early enough to intervene, while students need a low-friction way to coordinate and document work. These are problems stated by the supplied materials, not independently validated research findings.

Hypothesis: a course-integrated workspace combining explicit expectations, assigned work and reviewable evidence improves visibility without demanding excessive reporting. Validate with faculty and student use; do not claim it objectively measures effort or fairness.

## Users and responsibilities
- Instructor: manages projects and teams for courses where Canvas grants an instructor role; sees all teams in that course.
- Student: sees their own team workspace and can contribute to its work.
- Canvas administrator: installs/configures the integration; no university administration portal in MVP.
- TA and unfamiliar roles: denied access with an explanation in MVP until an explicit mapping is configured. No silent instructor escalation.

## Core journeys
Instructor opens TeamTrack in Canvas, synchronizes roster, creates a project with checkpoints and forms teams. A student opens TeamTrack, accepts the current agreement, creates or updates an assigned task, records an evidence link and raises a blocker. The instructor sees the blocker and overdue checkpoint, inspects the history, and records a response. Another student refreshes and sees saved state.

## Requirements and acceptance
| ID | Requirement | Acceptance |
|---|---|---|
| R1 | Real Canvas course launch | Valid registered LTI launch opens the correct course without a TeamTrack password; invalid or replayed launches fail |
| R2 | Roster sync | Instructor imports all pages of active course members, sees last successful sync and can retry; missing email is allowed |
| R3 | Team formation | Instructor creates named teams and assigns enrolled students; student belongs to at most one team per project |
| R4 | Project/checkpoints | Instructor creates title, description, due date and ordered checkpoints; course timezone appears next to dates |
| R5 | Team agreement | Members view versioned expectations and accept individually; editing creates a new version and renews acceptance |
| R6 | Tasks | Team members create tasks with one active team owner, due date, status and optional blocker; changes persist across sessions |
| R7 | Contribution records | Student records a short update linked to a task and optional HTTPS evidence URL; author and timestamp are visible |
| R8 | History | Task creation, reassignment, status changes, agreement publication/acceptance and evidence revisions produce immutable application-level events |
| R9 | Instructor overview | Course team list shows explicit reasons for attention: overdue open tasks, open blockers or missing agreement acceptance |
| R10 | Inspect evidence | Instructor opens team/member detail and sees task outcomes, updates and history with contextual labels |
| R11 | Scoped access | Student cannot read another team's records or mutate instructor resources by changing URLs or request bodies |
| R12 | Demo usability | Seeded class supports instructor and student walkthrough, loading/empty/error states and persisted changes after reload |
| R13 | Embedded accessibility | Core workflow works at 768px iframe width and 390px standalone width, keyboard-only, reduced motion and 200% zoom |

## Contribution model
Show completed/assigned tasks, evidence updates and unresolved blockers separately. A task has one accountable owner; collaborators can add attributed updates. Task count is not effort, quality or a grade. No combined numerical contribution score, leaderboard, automatic grade or accusation of freeloading. Missing evidence means 'no update recorded', not 'no work done'.

Updates may be corrected by their author; retain revision history and original author. Teammates can respond through task comments; instructor can add a visible review note. All MVP task comments and notes are visible to the team and instructor, with an explicit label. Confidential reports and private peer evaluations are out of scope.

## Scope decisions
Include lightweight task comments and external evidence links. Defer separate chat, uploaded-file storage, document editing, Canvas assignment sync, automatic Canvas group import, grade passback, AI summaries, notifications by email, billing and campus-wide analytics. Teams are managed in TeamTrack from the Canvas roster. The mockup's Messages/Files areas become task discussion/evidence in this release rather than unfinished navigation.

## Constraints and limits
Title 1-120 characters; task description/update/comment up to 4,000 characters; agreement up to 12,000. Evidence URL must use HTTPS; never fetch its contents server-side. Due dates represent explicit instants entered in the course timezone. Completion uses saved status, not elapsed time. Team changes require instructor action and a history event. No hard deletion of teams with work in MVP; archive instead.

## Pilot evaluation
Demo acceptance is functional, not proof of educational impact. For a later voluntary pilot, record completion of core journeys, participant-reported clarity, time spent entering a weekly update, and professor time locating a specific blocker. Report failed attempts and participant counts. Do not invent adoption targets before baseline interviews.

## Commercial assumptions
University licensing remains a hypothesis. Canvas proposes $4/student and presentation proposes $12/student/year; neither price is selected here. Whole-campus enrollment multiplication is a revenue scenario, not an MVP pilot forecast. Existing tools and specialized peer-assessment alternatives need deeper competitive validation before claiming uniqueness.
