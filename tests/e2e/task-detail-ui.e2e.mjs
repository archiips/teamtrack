import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
const b = await chromium.launch({ channel: "chrome" }),
  c = await b.newContext({ viewport: { width: 1440, height: 1000 } }),
  p = await c.newPage();
async function request(path, data) {
  const state = await (await c.request.get(base + "/api/workspace")).json();
  const r = await c.request.post(base + path, {
    headers: { Origin: base, "x-csrf-token": state.csrf },
    data,
  });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
try {
  await c.request.post(base + "/api/auth/signup", {
    headers: { Origin: base },
    data: {
      name: "Task UI Tester",
      email: `task-ui-${crypto.randomUUID()}@example.edu`,
      password: "local task password",
      portal: "student",
    },
  });
  await request("/api/workspaces", {
    action: "create",
    role: "student",
    course: "CSS 474",
    project: "TeamTrack",
    due: "2030-12-01",
  });
  const state = await (await c.request.get(base + "/api/workspace")).json();
  await request("/api/workspace", {
    type: "task.create",
    title: "Refine professor onboarding",
    description:
      "Make it easy to monitor existing team workspaces and organize them by class.",
    teamId: state.state.teams[0].id,
    ownerId: state.userId,
    due: "2030-11-20",
    checkpoint: "Build",
  });
  await p.goto(base);
  await p.locator(".sidebar nav button").filter({ hasText: "Tasks" }).click();
  await p.locator(".task-row").first().click();
  await p.getByLabel("Contribution or comment").waitFor();
  assert.equal(await p.getByLabel("Blocker explanation").isVisible(), false);
  for (const width of [1440, 390]) {
    await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await p.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "dark"),
    );
    const send = await p
      .getByRole("button", { name: "Share update", exact: true })
      .boundingBox();
    assert(
      send &&
        send.y >= 0 &&
        send.y + send.height <= (width === 390 ? 844 : 1000),
      "Composer submit remains visible without scrolling",
    );
    await p.screenshot({
      path: `/tmp/teamtrack-task-detail-${width}-dark.png`,
    });
  }
  await p.getByRole("button", { name: "Comment", exact: true }).click();
  await p
    .getByLabel("Contribution or comment")
    .fill("The class placement flow is clear now.");
  await p
    .getByLabel("Attach a file to this task update")
    .setInputFiles({
      name: "feedback.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Class placement feedback"),
    });
  await p.getByRole("button", { name: "Send comment", exact: true }).click();
  await p
    .locator(".entry")
    .filter({ hasText: "The class placement flow is clear now." })
    .waitFor();
  await p
    .locator("a.task-attachment")
    .filter({ hasText: "feedback.txt" })
    .waitFor();
  await p.getByText("Add a blocker", { exact: true }).click();
  await p
    .getByLabel("Blocker explanation")
    .fill("Waiting for the next review.");
  await p
    .locator(".blocker-box")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await p.getByText("Blocker needs attention", { exact: true }).waitFor();
  console.log(
    "Task detail UI passed: compact dark desktop/mobile, initial submit visibility, collapsed blocker, comment attachment and blocker save.",
  );
} finally {
  await b.close();
}
