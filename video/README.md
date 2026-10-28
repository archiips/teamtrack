# TeamTrack demo video

Two cuts, 1920×1080 / 30fps: a 19-second pitch cut (`teamtrack-demo-short.mp4`) and a 60-second walkthrough (`teamtrack-demo.mp4`). Both start in the Canvas sandbox and follow a professor and a student through the real product. Every product shot is a capture of the live app; motion, captions and cursor are added on top.

## Violet pitch cut (20s, current design) — `teamtrack-demo-v2.mp4`

Matches the violet / liquid-glass design (light mode), from a student's (Alex's) point of view: hook "Group project." → "What's *mine*?" → Tasks, click **Assigned to me** ("Know exactly what's yours.") → **Board view**, camera on In progress with Jordan's blocked task ("See what teammates are working on.") → **My team**, the real contribution-bar animation captured in slow motion ("Everyone's contribution, side by side.") → logo, "Clear tasks. Fair teams."

```
node --env-file=.env.local video/capture-v2.mjs   # local dev server, read-only; password read from .env.local, never printed
CUT=v2 node video/music.mjs
node video/render.mjs --cut v2
sh video/deliver.sh v2                            # -> video/out/teamtrack-demo-v2.mp4 (+ poster)
```

Files: `stage2.html` / `stage2.js` (violet stage), `capture-v2.mjs`. Older navy cuts below use `stage.html` / `stage.js`.

## Navy pitch cut (19s, previous design)

Hook "Who did *what?*" → click TeamTrack in Canvas → embedded app with roster synced ("It lives inside your Canvas course.") → team attention chips ("See which teams need a hand.") → Alex types and shares evidence ("Students log real evidence.") → professor sees the new contribution ("Professors see who did what.") → logo, "Built for Canvas. Never auto-grades."

## Navy walkthrough storyboard (60s, previous design)

| Time | Scene | Caption |
|---|---|---|
| 0–4s | Hook: "Group project." → "Who did *what?*" | — |
| 4–11s | Canvas course page; cursor clicks **TeamTrack** in course navigation | It lives inside your Canvas course. |
| 11–17s | TeamTrack embedded in Canvas; roster sync highlighted | Your Canvas roster, already there. |
| 17–27s | Professor overview; camera moves to team attention chips | See which teams need a hand, and why. |
| 27–31s | Student (Alex) overview; Pip turns and waves | Pip points students to their next step. |
| 31–41s | Accept the agreement; type an update with an evidence link; share; mark done | Students log real evidence, not just checkboxes. |
| 41–51s | Professor sees Alex's updated breakdown and the new contribution | Every contribution, recorded with who did it. |
| 51–55s | "Supports faculty judgment. *Never* auto-grades." | — |
| 55–60s | Logo, "Built for Canvas. Designed around people.", URL | — |

Only synthetic demo profiles and the synthetic Canvas sandbox appear. The sandbox's tunnel hostname is never shown.

## Rebuild

Requires Node 22, FFmpeg and Google Chrome (driven by Playwright).

```
npm run demo:reset
node video/capture.mjs          # real app screens -> video/work/shots (writes demo data)
npm run demo:reset
node video/render.mjs --stills 4.5,13.5,24,40.4,49.6   # optional spot checks
node video/music.mjs            # original soundtrack -> video/work/music.wav
CUT=short node video/music.mjs  # pitch-cut soundtrack -> video/work/music-short.wav
node video/render.mjs           # frames -> video/work/video-noaudio.mp4
node video/render.mjs --cut short
sh video/deliver.sh long        # mux, poster frame -> video/out/
sh video/deliver.sh short
```

The two Canvas frames (`canvas-course.jpg`, `canvas-teamtrack.jpg`) were captured from a logged-in browser; the capture script never signs in to Canvas. `video/work/` and `video/out/` are git-ignored.

## Assets

- Product screens: captured from https://teamtrack-kappa.vercel.app (synthetic demo data).
- Fonts: Fredoka, Instrument Serif (SIL OFL 1.1), Manrope (SIL OFL 1.1), same files the app serves.
- Music and sound effects: original, synthesized by `music.mjs`; no samples or licensed audio.
- Motion style: inspired by hera.video and the brag (`/brag-slim`) method; no code or assets copied.
