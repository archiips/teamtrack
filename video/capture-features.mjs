// Read-only captures for the features slide: a transparent Pip and the task board.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const BASE = process.env.CAPTURE_BASE || "https://teamtrack-kappa.vercel.app";
const OUT = fileURLToPath(new URL("./work/shots/", import.meta.url));
const browser = await chromium.launch({ channel: "chrome" });

// 1. Pip on a transparent background (welcome page hero model).
{
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 3,
  });
  await page.goto(BASE + "/");
  await page.waitForSelector(".welcome-art .hero-model canvas");
  await page.addStyleTag({
    content: `html, body, .welcome, .welcome-story { background: transparent !important; }
      .welcome-story::before, .welcome-story::after, .doodles, .art-label, .model-fallback { display: none !important; }`,
  });
  await page.mouse.move(80, 880); // Pip glances down-left, toward the board
  await page.waitForTimeout(2500);
  await page
    .locator(".welcome-art .hero-model")
    .screenshot({ path: OUT + "pip-transparent.png", omitBackground: true });
  await page.close();
}

// 2. The task board at roughly 1.65:1.
{
  const page = await browser.newPage({
    viewport: { width: 920, height: 1000 },
    deviceScaleFactor: 2,
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
  await page.addStyleTag({
    content: ".companion-wrap { display: none !important; }",
  });
  await page.locator('nav button[title="Tasks"]').click();
  await page.locator("button:has-text('Board view')").click();
  await page.waitForSelector(".board .board-card");
  await page.waitForTimeout(1500);
  await page.mouse.move(0, 0);
  await page
    .locator(".panel:has(.board)")
    .screenshot({ path: OUT + "board.png" });
  await page.close();
}
await browser.close();
console.log("pip-transparent.png and board.png captured");
