import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local app only");
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("/tmp/teamtrack-feedback/screens", { recursive: true });
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Professor login", exact: true })
    .click();
  await page
    .getByText("Create classes and team workspaces", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .waitFor();
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/professor-login.png",
  });
  await page.goto(base + "/reset-password");
  await page
    .getByText(/invalid|expired|request/i)
    .first()
    .waitFor();
  const login = await page.request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: { email: "alex@teamtrack.test", password: "local-chat-demo-only" },
  });
  assert.equal(login.status(), 200);
  await page.goto(base);
  await page
    .getByRole("button", { name: /reminders/i })
    .first()
    .click();
  await page.getByText("Accept your team agreement", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/reminders.png",
  });
  await page.getByRole("button", { name: "Team chat", exact: true }).click();
  const box = page.getByLabel("Message your team");
  await box.waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Message your team"]').disabled,
  );
  const text = "Enter send " + Date.now();
  await box.fill(text);
  await box.press("Shift+Enter");
  assert.equal(await box.inputValue(), text + "\n");
  await box.fill(text);
  await box.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    ),
  );
  assert.equal(await box.inputValue(), text);
  await box.press("Enter");
  await page
    .locator(".chat-message")
    .filter({ hasText: text })
    .waitFor({ timeout: 5000 });
  assert.equal(await box.inputValue(), "");
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/chat-enter.png",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS professor login, recovery entry, reminders, Shift+Enter, IME, Enter send",
  );
} finally {
  await browser.close();
}
