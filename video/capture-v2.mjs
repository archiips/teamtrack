// Captures the current (violet, light) student screens for the 20s pitch video.
// Read-only: clicks only switch views. Run against the local dev server:
//   node --env-file=.env.local video/capture-v2.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "http://localhost:3000";
const OUT = fileURLToPath(new URL("./work/v2/shots/", import.meta.url));
mkdirSync(OUT + "team", { recursive: true });
if (!process.env.DEMO_PASSWORD)
  throw Error("DEMO_PASSWORD missing (use --env-file=.env.local)");
const rects = {};

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
      body: JSON.stringify({ email: "alex@teamtrack.test", password: pw }),
    }).then((r) => r.status),
  process.env.DEMO_PASSWORD,
);
if (status !== 200) throw Error("sign-in failed: " + status);
await page.goto(BASE + "/");
await page.waitForSelector(".stats");
// Hide the Next.js dev badge; it is not part of the product.
await page.addStyleTag({
  content: "nextjs-portal { display: none !important; }",
});

const settle = (ms = 1600) => page.waitForTimeout(ms);
const shot = (name) =>
  page.screenshot({ path: OUT + name, type: "jpeg", quality: 92 });
async function rect(selector, name) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw Error("no box for " + selector);
  rects[name] = b;
}

// Tasks, all and mine (list view).
await rect('nav button[title="Tasks"]', "navTasks");
await page.locator('nav button[title="Tasks"]').click();
await settle();
await page.mouse.move(0, 0);
await rect(".tabs button:has-text('Assigned to me')", "tabMine");
await rect(".tabs button:has-text('All tasks')", "tabAll");
await rect("button:has-text('Board view')", "boardButton");
await shot("tasks-all.jpg");
await page.locator(".tabs button:has-text('Assigned to me')").click();
await settle(900);
await page.mouse.move(0, 0);
await rect(
  ".task-row:has-text('Interview students about campus access')",
  "myOpenTask",
);
await rect(".task-row:has-text('Photograph entrance signage')", "myDoneTask");
await shot("tasks-mine.jpg");

// Board (all tasks).
await page.locator(".tabs button:has-text('All tasks')").click();
await page.locator("button:has-text('Board view')").click();
await page.waitForSelector(".board .board-card");
await settle();
await page.mouse.move(0, 0);
await rect(".board-column:has-text('In progress')", "inProgressColumn");
await rect(
  ".board-card:has-text('Map the north campus accessibility route')",
  "jordanCard",
);
await rect('nav button[title="My team"]', "navTeam");
await shot("board.jpg");

// My team: step the real reveal animations 33ms at a time.
await page.locator('nav button[title="My team"]').click();
await page.evaluate(() => window.scrollTo(0, 150));
const timed = () =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.timeline === document.timeline)
      .forEach((a) => a.pause()),
  );
await timed();
await page.waitForTimeout(400);
await timed();
await page.mouse.move(0, 0);
const FRAMES = 40;
for (let f = 0; f < FRAMES; f++) {
  await page.evaluate((ms) => {
    for (const a of document.getAnimations())
      if (a.timeline === document.timeline) {
        a.pause();
        a.currentTime = ms;
      }
  }, f * 33);
  await page.waitForTimeout(60);
  await page.screenshot({
    path: `${OUT}team/${String(f).padStart(3, "0")}.jpg`,
    type: "jpeg",
    quality: 92,
  });
}
rects.teamFrames = FRAMES;
await rect(".team-grid > *", "teamFolder");
await rect(".breakdown-row:has-text('Alex Chen')", "alexRow");
await rect(".breakdown", "breakdown");

writeFileSync(OUT + "rects.json", JSON.stringify(rects, null, 2));
await browser.close();
console.log("captured", Object.keys(rects).length, "rects");
