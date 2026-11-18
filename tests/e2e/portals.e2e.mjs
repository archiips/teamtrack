import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local app only");
const b = await chromium.launch({ channel: "chrome" });
const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }),
  p = await c.newPage(),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const email = `browser-portals-${Date.now()}@example.edu`,
  password = "portal browser password";
async function state() {
  const r = await c.request.get(base + "/api/workspace");
  assert.equal(r.status(), 200);
  return r.json();
}
async function post(path, data, csrf) {
  const r = await c.request.post(base + path, {
    headers: { Origin: base, ...(csrf ? { "x-csrf-token": csrf } : {}) },
    data,
  });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function login(prof) {
  await c.clearCookies();
  await p.goto(base);
  await p
    .getByRole("button", {
      name: prof ? "Professor login" : "Student login",
      exact: true,
    })
    .click();
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .waitFor();
}
try {
  await post("/api/auth/signup", { name: "Portal Browser", email, password });
  let s = await state();
  await post(
    "/api/workspaces",
    {
      action: "create",
      role: "student",
      course: "Local test",
      project: "Student Portal Project",
      due: "2030-12-01",
    },
    s.csrf,
  );
  s = await state();
  await post(
    "/api/workspaces",
    {
      action: "create",
      role: "instructor",
      course: "Local test",
      project: "Professor Portal Project",
      due: "2030-12-01",
    },
    s.csrf,
  );
  await login(false);
  s = await state();
  assert.equal(s.portal, "student");
  assert.equal(s.state.project, "Student Portal Project");
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .click();
  assert.equal(
    await p.getByRole("menuitem", { name: /Professor Portal Project/ }).count(),
    0,
  );
  await p
    .getByRole("menuitem", { name: "Switch to professor portal", exact: true })
    .click();
  await p
    .getByText(/Professor portal ·/)
    .first()
    .waitFor();
  s = await state();
  assert.equal(s.state.project, "Professor Portal Project");
  assert(s.workspaces.every((w) => w.role === "instructor"));
  await p.reload();
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .waitFor();
  s = await state();
  assert.equal(s.portal, "instructor");
  await p.screenshot({ path: "/tmp/teamtrack-professor-portal.png" });
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .click();
  await p
    .getByRole("menuitem", { name: "Switch to student portal", exact: true })
    .click();
  await p
    .getByText(/Student portal ·/)
    .first()
    .waitFor();
  await login(true);
  s = await state();
  assert.equal(s.portal, "instructor");
  assert.equal(s.state.project, "Professor Portal Project");
  await p.setViewportSize({ width: 390, height: 844 });
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .click();
  const toggle = p.getByRole("menuitem", {
      name: "Switch to student portal",
      exact: true,
    }),
    box = await toggle.boundingBox();
  assert(box && box.y >= 0 && box.y + box.height <= 844);
  await toggle.click();
  await p
    .getByText(/Student portal ·/)
    .first()
    .waitFor({ state: "attached" });
  s = await state();
  await post(
    "/api/workspaces",
    { action: "practice", role: "student" },
    s.csrf,
  );
  await p.reload();
  await p.getByText(/your own sample copy, not a shared project/).waitFor();
  await p.screenshot({ path: "/tmp/teamtrack-private-practice.png" });
  const emptyContext = await b.newContext({
    viewport: { width: 390, height: 844 },
  });
  const emptyPage = await emptyContext.newPage();
  const signup = await emptyContext.request.post(base + "/api/auth/signup", {
    headers: { Origin: base },
    data: {
      name: "Empty portals",
      email: `empty-${Date.now()}@example.edu`,
      password,
      portal: "student",
    },
  });
  assert.equal(signup.status(), 200);
  await emptyPage.goto(base);
  await emptyPage
    .getByRole("button", { name: "Switch to professor portal", exact: true })
    .click();
  await emptyPage.getByText("Your classes", { exact: true }).waitFor();
  await emptyPage
    .getByRole("button", { name: "Switch to student portal", exact: true })
    .click();
  await emptyPage
    .getByRole("heading", {
      name: "Join with a student invite code",
      exact: true,
    })
    .waitFor();
  await emptyContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "Portal browser checks passed: role login, filtered menus, explicit switching, refresh, mobile control visibility, private-practice label.",
  );
} finally {
  await b.close();
}
