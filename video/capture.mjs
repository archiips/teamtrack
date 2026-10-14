// Captures real TeamTrack screens for the demo video from the live deployment.
// Uses only the synthetic demo profiles. Run `npm run demo:reset` before and after.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "https://teamtrack-kappa.vercel.app";
const OUT = fileURLToPath(new URL("./work/shots/", import.meta.url));
mkdirSync(OUT + "pip", { recursive: true });
mkdirSync(OUT + "typing", { recursive: true });
const rects = {};

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
});
const page = await context.newPage();
await page.clock.install();

async function login(userId) {
  await page.goto(BASE + "/api/health");
  const status = await page.evaluate(
    (id) =>
      fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      }).then((r) => r.status),
    userId,
  );
  if (status !== 200) throw Error(`login ${userId} failed: ${status}`);
  await page.goto(BASE + "/");
  await page.waitForSelector(".stats");
  // Scroll-driven reveals leave off-screen panels invisible in full-page shots.
  await page.addStyleTag({
    content:
      ".motion-ok :is(.overview-grid,.team-grid,.agreement-grid) > * { animation: none !important; }",
  });
  await settle();
}
/** Let rAF-driven count-ups (fake clock) and CSS animations (real time) finish. */
async function settle(ms = 2600) {
  await page.clock.runFor(ms);
  await page.waitForTimeout(1400);
  await page.mouse.move(700, 470);
  await page.clock.runFor(800);
}
async function rect(selector, name) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw Error(`no box for ${selector}`);
  rects[name] = b;
  return b;
}
async function nav(title) {
  await page.locator(`nav button[title="${title}"]`).click();
  await settle(1200);
}
async function shot(name, opts = {}) {
  await page.screenshot({
    path: OUT + name,
    type: "jpeg",
    quality: 92,
    ...opts,
  });
}

// 1. Professor overview.
await login("p1");
await shot("prof-overview.jpg");
await shot("prof-overview-full.jpg", { fullPage: true });
await rect(".team-summary .reason-chips", "profChips");
await rect(".team-summary", "profTeamRow");
await rect(".stats", "profStats");
rects.profFullHeight = await page.evaluate(() => document.body.scrollHeight);

// 2. Alex overview, with a stepped Pip clip (idle float, then waving).
await login("s1");
await shot("alex-overview.jpg");
const pipBox = await rect(".hero-pip", "alexPip");
const clip = {
  x: pipBox.x - 10,
  y: pipBox.y - 30,
  width: pipBox.width + 20,
  height: pipBox.height + 50,
};
rects.alexPipClip = clip;
await page.mouse.move(380, 260);
for (let f = 0; f < 75; f++) {
  if (f === 30) await page.locator(".hero-pip-model").click();
  await page.clock.runFor(34);
  await page.screenshot({
    path: `${OUT}pip/${String(f).padStart(3, "0")}.png`,
    clip,
    omitBackground: false,
  });
}
await page.keyboard.press("Escape");
await page.clock.runFor(300);

// 3. Agreement: before and after accepting.
await nav("Team agreement");
await shot("alex-agreement.jpg");
await rect("button:has-text('Accept this agreement')", "acceptButton");
await Promise.all([
  page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/workspace") && r.request().method() === "POST",
  ),
  page.locator("button:has-text('Accept this agreement')").click(),
]);
await settle(600);
await shot("alex-agreement-accepted.jpg");

// 4. Task drawer: type an update with evidence, share it, mark it done.
await nav("Tasks");
await rect(
  ".task-row:has-text('Interview students about campus access')",
  "taskRow",
);
await shot("alex-tasks.jpg");
await page
  .locator(".task-row:has-text('Interview students about campus access')")
  .click();
await settle(800);
await page
  .locator("textarea[aria-label='Contribution or comment']")
  .scrollIntoViewIfNeeded();
await settle(400);
await shot("alex-drawer.jpg");
await rect("textarea[aria-label='Contribution or comment']", "drawerText");
await rect("input[aria-label='Evidence link']", "drawerUrl");
await rect("button:has-text('Share update')", "shareButton");
const text =
  "Interviewed 4 more students at the library entrance. All 4 said the step-free route signs are hard to find.";
const textarea = page.locator("textarea[aria-label='Contribution or comment']");
let n = 0;
for (let i = 4; i <= text.length + 3; i += 4) {
  await textarea.fill(text.slice(0, Math.min(i, text.length)));
  await page.clock.runFor(16);
  await shot(`typing/${String(n++).padStart(3, "0")}.jpg`);
}
const link = "https://drive.example.edu/wayfinders/interview-notes";
const url = page.locator("input[aria-label='Evidence link']");
for (let i = 6; i <= link.length + 5; i += 6) {
  await url.fill(link.slice(0, Math.min(i, link.length)));
  await page.clock.runFor(16);
  await shot(`typing/${String(n++).padStart(3, "0")}.jpg`);
}
rects.typingFrames = n;
await Promise.all([
  page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/workspace") && r.request().method() === "POST",
  ),
  page.locator("button:has-text('Share update')").click(),
]);
await settle(500);
await page.locator(".entries .entry").first().scrollIntoViewIfNeeded();
await settle(400);
await shot("alex-drawer-shared.jpg");
await rect(".entries .entry", "newEntry");
await page.locator(".task-properties select").first().scrollIntoViewIfNeeded();
await settle(300);
await rect(".task-properties select", "statusSelect");
await Promise.all([
  page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/workspace") && r.request().method() === "POST",
  ),
  page.locator(".task-properties select").first().selectOption("done"),
]);
await settle(500);
await shot("alex-drawer-done.jpg");

// 5. Professor sees it.
await login("p1");
await nav("Teams & people");
await shot("prof-team.jpg");
await rect(".breakdown-row:has-text('Alex Chen')", "alexRow");
await nav("Course overview");
await shot("prof-overview-after-full.jpg", { fullPage: true });
await rect(".contribution-preview", "firstContribution");
rects.profAfterFullHeight = await page.evaluate(
  () => document.body.scrollHeight,
);

writeFileSync(OUT + "rects.json", JSON.stringify(rects, null, 2));
await browser.close();
console.log(
  "captured",
  Object.keys(rects).length,
  "rects;",
  n,
  "typing frames",
);
