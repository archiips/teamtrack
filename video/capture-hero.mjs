// Read-only hero capture of the professor overview at a slide-friendly 1.85:1.
// Run: node --env-file=.env.local video/capture-hero.mjs [light|dark]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "http://localhost:3000";
const OUT = fileURLToPath(new URL("./work/shots/", import.meta.url));
const THEME = process.argv[2] || "light";
if (!process.env.DEMO_PASSWORD)
  throw Error("DEMO_PASSWORD missing (use --env-file=.env.local)");

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 778 },
  deviceScaleFactor: 2,
});
await page.goto(BASE + "/api/health");
await page.evaluate((t) => localStorage.setItem("tt-theme", t), THEME);
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
await page.waitForSelector(".stats");
await page.addStyleTag({
  content: "nextjs-portal { display: none !important; }",
});
await page.waitForTimeout(3500); // count-ups, ring and bar animations settle
await page.mouse.move(900, 300); // Pip looks toward the content
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}hero-overview-${THEME}.png` });
await browser.close();
console.log(`hero-overview-${THEME}.png captured`);
