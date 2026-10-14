# TeamTrack UI direction

Status: design specification, not a rendered or user-tested interface.

## Visual identity
A calm academic workspace with a distinctive navy navigation rail and warm paper-like working surface. Prioritize readable work and clear ownership. Retain TeamTrack name; replace the deck's purple styling with the user's selected palette.

| Token | Value | Use |
|---|---|---|
| ink | #010736 | Primary text and navigation base |
| navy | #0D1C42 | Navigation surfaces and primary buttons |
| blue | #22396F | Selected controls, links and focus outlines on light surfaces |
| cream | #FCF1D0 | Active navigation text, agreement highlights and companion accents |
| canvas | #F7F8FC | Neutral workspace background |
| surface | #FFFFFF | Forms, task rows and dialogs |

Supporting success/warning/error colors must pass contrast checks and always accompany text/icon labels. Palette values are brand anchors, not proof that every pairing is accessible. Verify normal text at 4.5:1 and large text/non-text indicators at 3:1 where applicable.

Typography: locally served Manrope for interface and headings, system sans-serif fallback. Use 14-16px body, 20-24px section headings, 28-32px page titles; tabular numerals for dates/counts. No oversized marketing hero inside Canvas. Spacing multiples of 4px; compact 6px control radius, 12px dialogs; borders for grouping, shadows reserved for overlays.

## Screens and information hierarchy
- Course overview (instructor): course/project switcher, 'needs attention' team list with reasons, upcoming checkpoints, roster sync state. Main action: create project or manage teams.
- Project setup: project details, checkpoints and roster-to-team assignment; search and explicit Save. Avoid drag-only assignment.
- Team workspace (student and instructor): project/checkpoint context, next action, list/board toggle, task owners and deadlines, agreement status, evidence timeline.
- Task detail drawer: description, owner/status/due date, blocker, contribution updates with links, task discussion and change history. Focus returns to originating row on close.
- Agreement page: readable versioned text, member acceptance list, Accept current version button, publish confirmation explaining acceptance renewal.
- Member detail: assigned/completed task counts with denominator, authored updates and supporting history. No ranking or unexplained percentage.
- Launch/error screens: course-aware loading; expired launch offers Return to Canvas; blocked embedded session offers Open in new window.

Inside Canvas collapse the app rail to a small secondary nav so users do not face two full sidebars. At 768px keep content single-column with a full-width task drawer; at 390px stack controls and use labeled status menus. Standalone demo uses the same screens with a prominent 'Synthetic demo' label.

## Interaction rules
Save buttons show progress and prevent duplicate submissions. Preserve text after failure. Conflict response offers reload/review without silently overwriting. Confirm agreement publication and team reassignment; ordinary task status changes do not need a modal. Task board supports keyboard/menu status changes. Errors sit next to the relevant field with an accessible summary. All empty lists explain the next action. All charts have equivalent text and never encode state only through color.

Motion: 120-180ms opacity/transform for drawers and state changes. Respect prefers-reduced-motion. No automatic card entrance cascades, parallax workspace or moving backgrounds. Visible focus rings, sensible tab order and accessible dialog behavior are required.

## Design reference decisions
[Uiverse buttons](https://uiverse.io/buttons): inspiration for tactile pressed/hover states and compact loading controls. Avoid adopting glow-heavy controls in data screens.
[21st community components](https://21st.dev/community/components): reference source for dialogs, tabs and navigation patterns. Browse individual candidates at UI implementation time; record exact URL, author, license and dependencies before copying. No individual component or its license has been selected/verified yet. Use original accessible styling if a candidate adds unnecessary dependencies.

## Companion decision
Optional small floating 'Track' companion, a cream-and-blue rounded waypoint character, available on onboarding/empty states and tucked into the help corner. It offers a short checklist through a button; it is not an AI chatbot and does not monitor students. It must be dismissible, keyboard accessible, remember dismissal, avoid covering content, and stop motion under reduced-motion settings.

Do not add a WebGL runtime to the core MVP solely for decoration. Prefer an original lightweight illustration with a restrained hover. An externally sourced GLB is permitted only after license/attribution review, compressed size budget <=500KB, static fallback and measured performance check. No asset has been downloaded or selected. Companion ships only after core launch/workflow/accessibility gates; omit it if it delays them.

## Visual acceptance
Inspect instructor overview, student workspace, task drawer, agreement and launch error at 1440, 1024, 768 and 390px; check 200% zoom, long names, missing avatars, empty roster, 30 tasks, overdue dates and loading/error states. Check a real Canvas iframe rather than only a standalone browser screenshot. Review navy/cream balance and hierarchy against this brief before adding decorative elements.
