import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
const b = await chromium.launch({ channel: "chrome" });
const contexts = [];
async function account(name, portal) {
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(c);
  const email = `flow-${crypto.randomUUID()}@example.edu`,
    password = "local monitor password";
  const r = await c.request.post(base + "/api/auth/signup", {
    headers: { Origin: base },
    data: { name, email, password, portal },
  });
  assert.equal(r.status(), 200);
  return { c, p: await c.newPage(), email, password };
}
async function state(a) {
  return (await a.c.request.get(base + "/api/workspace")).json();
}
async function post(a, data) {
  const s = await state(a);
  const r = await a.c.request.post(base + "/api/workspaces", {
    headers: { Origin: base, "x-csrf-token": s.csrf },
    data,
  });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
try {
  const owner = await account("Team Owner", "student"),
    member = await account("Student Member", "student"),
    prof = await account("Professor", "instructor");
  await post(owner, {
    action: "create",
    role: "student",
    course: "BBUS 444",
    project: "TeamTrack pilot",
    due: "2030-12-01",
  });
  const original = await state(owner);
  await post(member, { action: "join", code: original.state.inviteCode });
  await member.p.goto(base);
  await member.p.getByRole("button", { name: "Invite", exact: true }).click();
  await member.p.getByRole("button", { name: /^Professor/ }).click();
  await member.p
    .getByRole("button", { name: "Create professor invite link", exact: true })
    .click();
  const link = await member.p
    .getByLabel("Professor invitation", { exact: true })
    .inputValue();
  assert.match(link, /monitor=[a-f0-9]{64}/);
  await member.p.screenshot({
    path: "/tmp/teamtrack-new-professor-invite.png",
  });
  await prof.c.clearCookies();
  await prof.p.goto(link);
  await prof.p.getByLabel("Email", { exact: true }).fill(prof.email);
  await prof.p.getByLabel("Password", { exact: true }).fill(prof.password);
  await prof.p.getByRole("button", { name: "Sign in", exact: true }).click();
  await prof.p
    .getByRole("button", { name: "Add team to class", exact: true })
    .waitFor();
  assert.equal(
    (await state(prof)).state,
    null,
    "Do not consume the invitation before class placement",
  );
  assert.equal(
    await prof.p.getByLabel("Project name", { exact: true }).isVisible(),
    false,
  );
  await prof.p
    .getByLabel("Class name for this team", { exact: true })
    .fill("BBUS 444 · Fall 2026");
  await prof.p.screenshot({ path: "/tmp/teamtrack-new-professor-class.png" });
  await prof.p.setViewportSize({ width: 390, height: 844 });
  assert(
    await prof.p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await prof.p.screenshot({
    path: "/tmp/teamtrack-new-professor-class-mobile.png",
  });
  const addBounds = await prof.p
    .getByRole("button", { name: "Add team to class", exact: true })
    .boundingBox();
  assert(
    addBounds && addBounds.y >= 0 && addBounds.y + addBounds.height <= 844,
    "Primary class-placement action is visible without scrolling",
  );
  await prof.p
    .getByRole("button", { name: "Add team to class", exact: true })
    .click();
  await prof.p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .waitFor();
  const joined = await state(prof);
  assert.equal(joined.namespace, original.namespace);
  assert.equal(joined.state.project, "TeamTrack pilot");
  assert.equal(joined.classes[0].name, "BBUS 444 · Fall 2026");
  assert.equal(joined.workspaces[0].classId, joined.classes[0].id);
  assert(joined.state.users.find((u) => u.id === joined.userId).monitor);
  await prof.p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .click();
  await prof.p
    .getByRole("menuitem", { name: "Manage classes & teams", exact: true })
    .click();
  await prof.p
    .getByRole("heading", { name: "BBUS 444 · Fall 2026", exact: true })
    .waitFor();
  await prof.p.getByRole("button", { name: /TeamTrack pilot/ }).waitFor();
  await prof.p.screenshot({ path: "/tmp/teamtrack-new-class-team-list.png" });
  console.log(
    "Monitoring journey passed: ordinary member invitation, professor login without auto-enrollment, class placement, original project retained, read-only membership and class team listing on mobile.",
  );
} finally {
  await b.close();
}
