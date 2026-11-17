import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local test app only");
const out = process.argv[2] || "/private/tmp/teamtrack-chat-checks";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [],
  results = [];
const run = Date.now().toString(36);
async function person(name, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  const login = await page.request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: {
      email: `${name}@teamtrack.test`,
      password: process.env.DEMO_PASSWORD || "local-chat-demo-only",
    },
  });
  assert.equal(login.status(), 200);
  await page.reload();
  await page.getByRole("button", { name: "Team chat", exact: true }).click();
  await page.getByLabel("Message your team").waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Message your team"]').disabled,
  );
  return page;
}
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log("PASS", name);
}
const message = (p, text) =>
  p.locator(".chat-message").filter({ has: p.locator("p", { hasText: text }) });
try {
  const alex = await person("alex"),
    jordan = await person("jordan"),
    prof = await person("morgan");
  const text = `Can we meet at the library? ${run}`;
  let retryText;
  await check(
    "keyboard send, teammate poll, instructor visibility",
    async () => {
      await alex.getByLabel("Message your team").fill(text);
      await alex.getByLabel("Message your team").press("Control+Enter");
      await message(alex, text).waitFor();
      await message(jordan, text).waitFor({ timeout: 10000 });
      await message(prof, text).waitFor({ timeout: 10000 });
      assert.equal(await alex.getByLabel("Message your team").inputValue(), "");
    },
  );
  await check("attachment-only send and exact private download", async () => {
    await alex.getByLabel("Attach a file", { exact: true }).setInputFiles({
      name: `team-notes-${run}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from("owner,task\nAlex,interviews\n"),
    });
    await alex
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    const link = jordan
      .getByRole("link")
      .filter({ hasText: `team-notes-${run}.csv` });
    await link.waitFor({ timeout: 10000 });
    const [download] = await Promise.all([
      jordan.waitForEvent("download"),
      link.click(),
    ]);
    assert.equal(download.suggestedFilename(), `team-notes-${run}.csv`);
    assert.equal(
      await readFile(await download.path(), "utf8"),
      "owner,task\nAlex,interviews\n",
    );
  });
  await check(
    "lost send response preserves draft and retry creates one message",
    async () => {
      retryText = `Retry safely ${run}`;
      let savedId;
      await alex.route("**/api/chat", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        savedId = (await response.json()).message.id;
        await route.abort("failed");
        await alex.unroute("**/api/chat");
      });
      await alex.getByLabel("Message your team").fill(retryText);
      await alex
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await alex.locator('.chat-composer [role="alert"]').waitFor();
      assert.equal(
        await alex.getByLabel("Message your team").inputValue(),
        retryText,
      );
      await alex
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await alex.getByText("Message sent", { exact: true }).waitFor();
      const data = await (
        await alex.request.get(base + "/api/chat?teamId=t1")
      ).json();
      const found = data.messages.filter((m) => m.body === retryText);
      assert.equal(found.length, 1);
      assert.equal(found[0].id, savedId);
    },
  );
  await check(
    "poll preserves draft and reading position; older history stays in place",
    async () => {
      await message(jordan, retryText).waitFor({ timeout: 10000 });
      await jordan
        .locator(".chat-transcript")
        .evaluate((el) => (el.scrollTop = 0));
      await jordan.getByLabel("Message your team").fill("Draft stays here");
      const before = await jordan
        .locator(".chat-transcript")
        .evaluate((el) => el.scrollTop);
      await alex
        .getByLabel("Message your team")
        .fill(`New while reading ${run}`);
      await alex
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await jordan
        .getByRole("button", { name: /1 new message/ })
        .waitFor({ timeout: 10000 });
      assert.equal(
        await jordan.getByLabel("Message your team").inputValue(),
        "Draft stays here",
      );
      assert.equal(
        await jordan.locator(".chat-transcript").evaluate((el) => el.scrollTop),
        before,
      );
      const oldestBefore = await jordan
        .locator(".chat-message")
        .first()
        .innerText();
      await jordan
        .getByRole("button", { name: "Load older messages", exact: true })
        .click();
      await jordan.waitForTimeout(300);
      assert.notEqual(
        await jordan.locator(".chat-message").first().innerText(),
        oldestBefore,
      );
      assert.ok(
        await jordan
          .locator(".chat-transcript")
          .evaluate((el) => el.scrollTop > 0),
      );
    },
  );
  await check(
    "chat history and composer recover after a denied fetch",
    async () => {
      const marker = await alex.locator(".chat-message").last().innerText();
      let blocked = false;
      await alex.route("**/api/chat?**", async (route) => {
        if (!blocked) {
          blocked = true;
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ error: "Temporary access denial test" }),
          });
        } else await route.continue();
      });
      await alex
        .getByText("Temporary access denial test")
        .waitFor({ timeout: 8000 });
      await alex.getByRole("button", { name: "Retry", exact: true }).click();
      await alex.locator(".chat-message").first().waitFor({ timeout: 6000 });
      assert.equal(
        await alex.getByLabel("Message your team").isEnabled(),
        true,
      );
      assert.ok(
        (await alex.locator(".chat-message").last().innerText()).includes(
          marker,
        ),
      );
      await alex.unroute("**/api/chat?**");
    },
  );
  await check("oversize attachment rejected without losing text", async () => {
    await alex.getByLabel("Message your team").fill("Keep this draft");
    await alex.getByLabel("Attach a file", { exact: true }).setInputFiles({
      name: "large.zip",
      mimeType: "application/zip",
      buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
    });
    await alex.getByText(/Files can be up to 3 MB/).waitFor();
    assert.equal(
      await alex.getByLabel("Message your team").inputValue(),
      "Keep this draft",
    );
  });
  await check(
    "reload persists history and other teams remain private",
    async () => {
      await jordan.reload();
      await jordan
        .getByRole("button", { name: "Team chat", exact: true })
        .click();
      await message(jordan, text).waitFor();
      const sam = await person("sam");
      const r = await sam.request.get(base + "/api/chat?teamId=t1");
      assert.equal(r.status(), 403);
      assert.equal(await message(sam, text).count(), 0);
    },
  );
  await check("desktop light, dark and 390px layout", async () => {
    await alex.getByLabel("Message your team").fill("");
    await alex.screenshot({ path: out + "/chat-desktop.png", fullPage: true });
    await alex.getByRole("button", { name: "Switch to dark mode" }).click();
    await alex.screenshot({ path: out + "/chat-dark.png", fullPage: true });
    const phone = await person("alex", { width: 390, height: 844 });
    await phone
      .getByLabel("Message your team")
      .fill("A very long filename should still fit on my phone.");
    await phone.getByLabel("Attach a file", { exact: true }).setInputFiles({
      name: "Project-notes-".repeat(8) + ".txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Phone notes"),
    });
    await phone
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await phone.getByText("Message sent", { exact: true }).waitFor();
    await phone.screenshot({ path: out + "/chat-phone.png", fullPage: true });
    assert.ok(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(
      await phone
        .getByRole("button", { name: "Team chat", exact: true })
        .isVisible(),
    );
    const clipped = await phone
      .locator(".sidebar nav button")
      .evaluateAll((els) => els.some((el) => el.scrollWidth > el.clientWidth));
    assert.equal(clipped, false);
    await phone.getByRole("button", { name: "My team", exact: true }).click();
    await phone.locator(".breakdown").waitFor();
  });
  await check(
    "hidden-page polling guard and reduced-motion content stays visible",
    async () => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion: "reduce",
      });
      const p = await context.newPage();
      await p.goto(base);
      await p.request.post(base + "/api/auth/login", {
        headers: { Origin: base },
        data: {
          email: "morgan@teamtrack.test",
          password: process.env.DEMO_PASSWORD || "local-chat-demo-only",
        },
      });
      await p.reload();
      await p
        .getByRole("button", { name: "Teams & people", exact: true })
        .click();
      assert.equal(
        await p
          .locator(".team-grid .folder")
          .first()
          .evaluate((el) => getComputedStyle(el).opacity),
        "1",
      );
      assert.equal(
        await p
          .locator(".panel")
          .first()
          .evaluate((el) => getComputedStyle(el).backdropFilter),
        "none",
      );
      await p.getByRole("button", { name: "Team chat", exact: true }).click();
      await p.waitForFunction(
        () =>
          !document.querySelector('[aria-label="Message your team"]').disabled,
      );
      await p.evaluate(() =>
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        }),
      );
      let polls = 0;
      p.on("request", (r) => {
        if (r.url().includes("/api/chat?")) polls++;
      });
      await p.waitForTimeout(5500);
      assert.equal(polls, 0);
    },
  );
  assert.deepEqual(errors, []);
  console.log(
    `${results.length} browser checks passed; no page errors. Screenshots: ${out}`,
  );
} catch (e) {
  for (const c of browser.contexts())
    for (const [i, p] of c.pages().entries())
      await p
        .screenshot({
          path: out + "/failure-" + c.pages().length + "-" + i + ".png",
          fullPage: true,
          animations: "disabled",
        })
        .catch(() => {});
  throw e;
} finally {
  await browser.close();
}
