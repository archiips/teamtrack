// Professor's Team progress chart for the 14s pitch video, bars stepped in slow motion.
// Read-only. Run: node --env-file=.env.local video/capture-prof.mjs
// Adds its rects to work/v2/shots/rects.json (written by capture-v2.mjs).
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "http://localhost:3000";
const OUT = fileURLToPath(new URL("./work/v2/shots/", import.meta.url));
mkdirSync(OUT + "prof", { recursive: true });
if (!process.env.DEMO_PASSWORD)
  throw Error("DEMO_PASSWORD missing (use --env-file=.env.local)");
const rects = JSON.parse(readFileSync(OUT + "rects.json", "utf8"));

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto(BASE + "/api/health");
await page.evaluate(() => localStorage.setItem("tt-theme", "light"));
const status = await page.evaluate(
  (pw) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "morgan@teamtrack.test", password: pw }),
    }).then((r) => r.status),
  process.env.DEMO_PASSWORD,
);
if (status !== 200) throw Error("sign-in failed: " + status);
await page.goto(BASE + "/");
await page.waitForSelector(".progress-chart .status-bar");
// Hide the dev badge; show below-the-fold panels settled (the scroll reveal is not part of this shot).
await page.addStyleTag({
  content:
    "nextjs-portal { display: none !important; } .motion-ok :is(.overview-grid,.team-grid,.agreement-grid) > * { animation: none !important; }",
});
const pauseAll = () =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.timeline === document.timeline)
      .forEach((a) => a.pause()),
  );
await pauseAll();
await page.evaluate(() => window.scrollTo(0, 200));
await page.mouse.move(0, 0);
await page.waitForTimeout(2500); // count-ups (JS) finish; CSS animations stay paused
await pauseAll();
const FRAMES = 40;
for (let f = 0; f < FRAMES; f++) {
  await page.evaluate(
    (ms) => {
      for (const a of document.getAnimations())
        if (a.timeline === document.timeline) {
          a.pause();
          a.currentTime = ms;
        }
    },
    120 + f * 33,
  );
  await page.waitForTimeout(60);
  await page.screenshot({
    path: `${OUT}prof/${String(f).padStart(3, "0")}.jpg`,
    type: "jpeg",
    quality: 92,
  });
}
rects.profFrames = FRAMES;
const box = await page.locator(".progress-chart").boundingBox();
rects.progressChart = box;
writeFileSync(OUT + "rects.json", JSON.stringify(rects, null, 2));
await browser.close();
console.log("prof chart captured", box);
