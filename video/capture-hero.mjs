// Read-only hero capture of the professor overview at a slide-friendly 1.85:1.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "https://teamtrack-kappa.vercel.app";
const OUT = fileURLToPath(new URL("./work/shots/", import.meta.url));
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 778 },
  deviceScaleFactor: 2,
});
await page.goto(BASE + "/api/health");
await page.evaluate(() =>
  fetch("/api/demo/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "p1" }),
  }),
);
await page.goto(BASE + "/");
await page.waitForSelector(".stats");
await page.waitForTimeout(3500); // count-ups, ring and bar animations settle
await page.mouse.move(900, 300); // Pip looks toward the content
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "hero-overview.png" });
await browser.close();
console.log("hero-overview.png captured");
