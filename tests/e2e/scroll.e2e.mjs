import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local app and isolated database only");
const browser = await chromium.launch({ channel: "chrome" });
const before = `:root .stats>div,:root .project-strip,:root .panel,:root .pip-bubble,:root .page-heading .primary,.folder-tile .folder-front{backdrop-filter:blur(20px) saturate(170%)}@keyframes original-reveal{from{opacity:0;transform:translateY(28px)}}@supports(animation-timeline:view()){.motion-ok :is(.overview-grid,.team-grid,.agreement-grid)>*{animation:original-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 35%}}`;
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page.goto(base);
  await page.request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: {
      email: "morgan@teamtrack.test",
      password: process.env.DEMO_PASSWORD || "local-chat-demo-only",
    },
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Teams & people", exact: true })
    .click();
  await page.waitForTimeout(1200);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Performance.enable");
  const results = [];
  // Alternate order across paired trials to reduce warmup/order bias.
  for (let trial = 0; trial < 6; trial++)
    for (const variant of trial % 2
      ? ["optimized", "original"]
      : ["original", "optimized"]) {
      const style =
        variant === "original"
          ? await page.addStyleTag({ content: before })
          : null;
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      const first = (await cdp.send("Performance.getMetrics")).metrics;
      const frames = await page.evaluate(async () => {
        const gaps = [];
        let last = performance.now(),
          start = last;
        await new Promise((resolve) => {
          function tick(t) {
            gaps.push(t - last);
            last = t;
            window.scrollTo(
              0,
              Math.min(
                document.documentElement.scrollHeight - innerHeight,
                (t - start) * 0.8,
              ),
            );
            if (t - start < 1400) requestAnimationFrame(tick);
            else resolve();
          }
          requestAnimationFrame(tick);
        });
        gaps.sort((a, b) => a - b);
        return {
          frames: gaps.length,
          p95: gaps[Math.floor(gaps.length * 0.95)],
          over33: gaps.filter((x) => x > 33).length,
          height: document.documentElement.scrollHeight,
        };
      });
      const last = (await cdp.send("Performance.getMetrics")).metrics;
      const delta = (n) =>
        Math.round(
          ((last.find((x) => x.name === n)?.value || 0) -
            (first.find((x) => x.name === n)?.value || 0)) *
            1000,
        );
      results.push({
        variant,
        trial,
        ...frames,
        taskMs: delta("TaskDuration"),
        styleMs: delta("RecalcStyleDuration"),
      });
      if (style) await style.evaluate((el) => el.remove());
    }
  await writeFile(
    process.argv[2] || "/private/tmp/teamtrack-scroll-comparison.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
