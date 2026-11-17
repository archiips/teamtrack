import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local test app only");
const out = process.argv[2] || "/private/tmp/teamtrack-task-files";
await mkdir(out, { recursive: true });
const browser =
    process.env.BROWSER_ENGINE === "webkit"
      ? await webkit.launch()
      : await chromium.launch({ channel: "chrome" }),
  errors = [];
async function person(name, viewport = { width: 1440, height: 900 }) {
  const p = await browser.newPage({ viewport });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base);
  const r = await p.request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: { email: name + "@teamtrack.test", password: "local-chat-demo-only" },
  });
  assert.equal(r.status(), 200);
  await p.reload();
  return p;
}
async function openTask(p) {
  await p.locator(".sidebar nav button").filter({ hasText: "Tasks" }).click();
  await p.locator(".task-row").first().click();
  await p.getByLabel("Contribution or comment").waitFor();
}
async function download(p, filename, expected) {
  const link = p.locator("a.task-attachment").filter({ hasText: filename });
  await link.waitFor();
  const [f] = await Promise.all([p.waitForEvent("download"), link.click()]);
  assert.equal(await readFile(await f.path(), "utf8"), expected);
}
try {
  const p = await person("alex"),
    run = Date.now().toString(36);
  await openTask(p);
  await p.getByLabel("Evidence link").fill("http://example.com/previous-draft");
  await p.getByRole("button", { name: "Comment", exact: true }).click();
  await p
    .getByLabel("Contribution or comment")
    .fill("Comment with file " + run);
  await p.getByLabel("Attach a file to this task update").setInputFiles({
    name: "comment-" + run + ".txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Comment attachment contents"),
  });
  const firstUpload = p.waitForResponse(
    (r) =>
      r.url().endsWith("/api/task-entries") && r.request().method() === "POST",
  );
  await p.getByRole("button", { name: "Send comment", exact: true }).click();
  assert.equal(
    (await firstUpload).status(),
    200,
    "A hidden contribution link must not block a comment",
  );
  await download(p, "comment-" + run + ".txt", "Comment attachment contents");
  console.log("PASS comment upload and download");
  await p.getByRole("button", { name: "Contribution", exact: true }).click();
  await p.getByLabel("Attach a file to this task update").setInputFiles({
    name: "contribution-" + run + ".csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,work\nAlex,research\n"),
  });
  await p.getByRole("button", { name: "Share update", exact: true }).click();
  await download(
    p,
    "contribution-" + run + ".csv",
    "name,work\nAlex,research\n",
  );
  console.log("PASS file-only contribution");
  for (const name of ["jordan", "morgan"]) {
    const mate = await person(name);
    await openTask(mate);
    await download(
      mate,
      "comment-" + run + ".txt",
      "Comment attachment contents",
    );
    await mate.close();
  }
  console.log("PASS teammate and instructor downloads");
  await p.reload();
  await openTask(p);
  await download(p, "comment-" + run + ".txt", "Comment attachment contents");
  console.log("PASS attachments survive reload");
  await p.getByRole("button", { name: "Comment", exact: true }).click();
  await p.getByLabel("Contribution or comment").fill("Retry file " + run);
  await p.getByLabel("Attach a file to this task update").setInputFiles({
    name: "retry-" + run + ".txt",
    mimeType: "text/plain",
    buffer: Buffer.from("safe retry"),
  });
  await p.route("**/api/task-entries", async (route) => {
    await route.fetch();
    await route.abort("failed");
    await p.unroute("**/api/task-entries");
  });
  await p.getByRole("button", { name: "Send comment", exact: true }).click();
  await p.locator('.task-entry-composer [role="alert"]').waitFor();
  assert.equal(
    await p.getByLabel("Contribution or comment").inputValue(),
    "Retry file " + run,
  );
  await p.getByRole("button", { name: "Comment", exact: true }).click();
  await p.getByRole("button", { name: "Send comment", exact: true }).click();
  await p
    .locator("a.task-attachment")
    .filter({ hasText: "retry-" + run + ".txt" })
    .waitFor();
  assert.equal(
    await p
      .locator("a.task-attachment")
      .filter({ hasText: "retry-" + run + ".txt" })
      .count(),
    1,
  );
  console.log("PASS failed upload preserves draft and retry deduplicates");
  await p.screenshot({ path: out + "/task-desktop.png", fullPage: true });
  await p.getByRole("button", { name: "Close task", exact: true }).click();
  await p.getByRole("button", { name: "Switch to dark mode" }).click();
  await openTask(p);
  await p.screenshot({ path: out + "/task-dark.png", fullPage: true });
  const phone = await person("alex", { width: 390, height: 844 });
  await openTask(phone);
  await phone.getByRole("button", { name: "Comment", exact: true }).click();
  await phone.getByLabel("Attach a file to this task update").setInputFiles({
    name: "phone-" + run + ".txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Phone task file"),
  });
  await phone
    .getByRole("button", { name: "Send comment", exact: true })
    .click();
  await download(phone, "phone-" + run + ".txt", "Phone task file");
  await phone.screenshot({ path: out + "/task-phone.png", fullPage: true });
  assert.ok(
    await phone
      .locator(".drawer")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  console.log("PASS mobile task upload, download and no horizontal overflow");
  assert.deepEqual(errors, []);
  console.log("All task attachment browser checks passed; no page errors");
} finally {
  await browser.close();
}
