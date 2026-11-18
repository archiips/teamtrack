import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
const browser = await chromium.launch({ channel: "chrome" }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Professor login", exact: true })
    .click();
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Professor Browser");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`prof-browser-${Date.now()}@example.edu`);
  await page.getByLabel("Password", { exact: true }).fill("local password 123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "New class", exact: true }).click();
  await page.getByLabel("New class name").fill("Class One");
  await page.getByRole("button", { name: "Create class", exact: true }).click();
  await page.getByRole("heading", { name: "Class One", exact: true }).waitFor();
  await page
    .getByText("Create a new team workspace instead", { exact: true })
    .click();
  await page
    .getByLabel("Place this workspace in a class")
    .selectOption({ label: "Class One" });
  await page.getByLabel("Class name", { exact: true }).fill("Class One");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Team workspace A");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Invite", exact: true }).waitFor();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.getByRole("button", { name: /^Professor/ }).click();
  await page
    .getByRole("button", { name: "Create professor invite link", exact: true })
    .click();
  const link = page.getByLabel("Professor invitation", { exact: true });
  await link.waitFor();
  assert.match(await link.inputValue(), /monitor=[a-f0-9]{64}/);
  await mkdir("/tmp/teamtrack-feedback/screens", { recursive: true });
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/professor-invite.png",
  });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Account and workspaces" }).click();
  await page
    .getByRole("menuitem", { name: "Manage classes & teams", exact: true })
    .click();
  await page.getByText("Your classes", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/classes.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/classes-mobile.png",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS professor signup, class creation, child workspace, monitoring invitation, desktop/mobile class UI",
  );
} finally {
  await browser.close();
}
