// Portrait (1:2) phone capture of a task's evidence, for slide layouts.
// Fills the update form for the picture but never submits it.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "https://teamtrack-kappa.vercel.app";
const OUT = fileURLToPath(new URL("./work/shots/", import.meta.url));
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await page.goto(BASE + "/api/health");
await page.evaluate(() =>
  fetch("/api/demo/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "s1" }),
  }),
);
await page.goto(BASE + "/");
await page.waitForSelector(".stats");
await page.locator('nav button[title="Tasks"]').click();
await page
  .locator(".task-row:has-text('Interview students about campus access')")
  .click();
await page.waitForSelector(".drawer .entries .entry");
await page.waitForTimeout(800);
// Typed but never submitted: the demo data is not changed.
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
await page.screenshot({ path: OUT + "phone-evidence.png" });
await browser.close();
console.log("phone-evidence.png captured");
