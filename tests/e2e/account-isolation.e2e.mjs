import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
const b = await chromium.launch({ channel: "chrome" }),
  c = await b.newContext(),
  p = await c.newPage();
async function make(name) {
  const r = await c.request.post(base + "/api/auth/signup", {
    headers: { Origin: base },
    data: {
      name,
      email: `isolation-${Date.now()}-${name}@example.edu`,
      password: "local isolation password",
      portal: "student",
    },
  });
  assert.equal(r.status(), 200);
  let s = await (await c.request.get(base + "/api/workspace")).json();
  const w = await c.request.post(base + "/api/workspaces", {
    headers: { Origin: base, "x-csrf-token": s.csrf },
    data: {
      action: "create",
      role: "student",
      course: "Private",
      project: name,
      due: "2030-12-01",
    },
  });
  assert.equal(w.status(), 200);
  s = await (await c.request.get(base + "/api/workspace")).json();
  return s;
}
try {
  const first = await make("FirstPrivate");
  await p.goto(base);
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .waitFor();
  let release;
  const gate = new Promise((r) => (release = r));
  let pending;
  const intercepted = new Promise((r) => (pending = r));
  await p.route("**/api/workspace", async (route) => {
    const response = await route.fetch();
    pending();
    await gate;
    await route.fulfill({ response });
  });
  await p
    .getByRole("button", { name: "Refresh workspace", exact: true })
    .click();
  await intercepted;
  let releaseLogout;
  const logoutGate = new Promise((r) => (releaseLogout = r));
  let logoutPending;
  const logoutSeen = new Promise((r) => (logoutPending = r));
  await p.route("**/api/auth/logout", async (route) => {
    logoutPending();
    await logoutGate;
    await route.continue();
  });
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .click();
  await p.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await logoutSeen;
  assert.equal(
    await p.getByRole("button", { name: "Student login", exact: true }).count(),
    0,
    "Do not display a new login before the old cookie is cleared",
  );
  release();
  releaseLogout();
  await p.getByRole("button", { name: "Student login", exact: true }).waitFor();
  await p.unroute("**/api/workspace");
  await p.unroute("**/api/auth/logout");
  const second = await make("SecondPrivate");
  await p.goto(base);
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .waitFor();
  const visible = await (await c.request.get(base + "/api/workspace")).json();
  assert.equal(visible.namespace, second.namespace);
  assert(!visible.workspaces.some((w) => w.namespace === first.namespace));
  await p
    .getByRole("button", { name: "Account and workspaces", exact: true })
    .click();
  assert.equal(
    await p.getByRole("menuitem", { name: /FirstPrivate/ }).count(),
    0,
  );
  console.log(
    "Browser isolation passed: delayed refresh/logout cannot restore prior account; second account has only its workspaces.",
  );
} finally {
  await b.close();
}
