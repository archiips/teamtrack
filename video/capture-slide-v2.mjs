// Slide images in the current (violet, light) design, as Alex. Read-only: the
// phone shot types into the update form but never submits it.
// Run: node --env-file=.env.local video/capture-slide-v2.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "http://localhost:3000";
const OUT = fileURLToPath(new URL("./out/slide/", import.meta.url));
mkdirSync(OUT, { recursive: true });
if (!process.env.DEMO_PASSWORD)
  throw Error("DEMO_PASSWORD missing (use --env-file=.env.local)");
const browser = await chromium.launch({ channel: "chrome" });

async function signedIn(viewport, scale, extra = {}) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: scale,
    ...extra,
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
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  return page;
}

// 1. Student dashboard strip (2.63:1, like the old bottom image).
{
  const page = await signedIn({ width: 1440, height: 900 }, 2);
  await page.waitForTimeout(3500);
  await page.mouse.move(900, 300);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: OUT + "student-dashboard-violet.png",
    clip: { x: 0, y: 0, width: 1440, height: 548 },
  });

  // 2. My team folder with contribution bars, transparent around it.
  await page.locator('nav button[title="My team"]').click();
  await page.waitForTimeout(2500);
  await page.addStyleTag({
    content: `html, body, .workspace { background: transparent !important; background-image: none !important; }
      .workspace::before, .workspace::after, .doodles, .companion-wrap { display: none !important; }`,
  });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await page
    .locator(".team-grid > *")
    .first()
    .screenshot({
      path: OUT + "team-contribution-violet.png",
      omitBackground: true,
    });
  await page.close();
}

// 3. Phone (1:2): the task's evidence, with an update typed but not shared.
{
  const page = await signedIn({ width: 390, height: 780 }, 3, {
    isMobile: true,
    hasTouch: true,
  });
  await page.locator('nav button[title="Tasks"]').click();
  await page
    .locator(".task-row:has-text('Interview students about campus access')")
    .click();
  await page.waitForSelector(".drawer .entries .entry");
  await page.waitForTimeout(800);
  await page
    .locator("textarea[aria-label='Contribution or comment']")
    .fill(
      "Walked the step-free route from the library to the quad. Two ramps have no signs.",
    );
  await page
    .locator("input[aria-label='Evidence link']")
    .fill("https://drive.example.edu/wayfinders/route-photos");
  await page.locator(".drawer .evidence-heading h3").click();
  await page.locator(".drawer .evidence-heading").evaluate((el) => {
    el.scrollIntoView({ block: "start" });
    let s = el.parentElement;
    while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement;
    if (s) s.scrollTop -= 96;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + "phone-evidence-violet.png" });
  await page.close();
}
await browser.close();
console.log("slide images captured");
