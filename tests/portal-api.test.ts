import { expect, it } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
it("keeps student and professor sessions separate, including login landing and workspace switching", async () => {
  let cookie = "",
    csrf = "";
  async function call(path: string, body?: unknown) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie,
        "x-csrf-token": csrf,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    const data = await r.json();
    if (data.csrf) csrf = data.csrf;
    return { status: r.status, data };
  }
  const email = `portal-${crypto.randomUUID()}@example.edu`,
    password = "portal local password";
  expect(
    (await call("/api/auth/signup", { name: "Both Roles", email, password }))
      .status,
  ).toBe(200);
  await call("/api/workspace");
  const student = await call("/api/workspaces", {
    action: "create",
    role: "student",
    course: "Class",
    project: "Student Project",
    due: "2030-12-01",
  });
  await call("/api/workspace");
  const prof = await call("/api/workspaces", {
    action: "create",
    role: "instructor",
    course: "Class",
    project: "Professor Project",
    due: "2030-12-01",
  });
  expect(student.status).toBe(200);
  expect(prof.status).toBe(200);
  await call("/api/auth/login", { email, password, portal: "student" });
  let view = (await call("/api/workspace")).data;
  expect(view.portal).toBe("student");
  expect(view.namespace).toBe(student.data.namespace);
  expect(view.workspaces.map((w: { role: string }) => w.role)).toEqual([
    "student",
  ]);
  expect(
    (
      await call("/api/workspaces", {
        action: "switch",
        namespace: prof.data.namespace,
      })
    ).status,
  ).toBe(422);
  expect(
    (await call("/api/workspaces", { action: "portal", portal: "instructor" }))
      .status,
  ).toBe(200);
  view = (await call("/api/workspace")).data;
  expect(view.portal).toBe("instructor");
  expect(view.namespace).toBe(prof.data.namespace);
  expect(view.workspaces.map((w: { role: string }) => w.role)).toEqual([
    "instructor",
  ]);
  expect(
    (await call("/api/workspaces", { action: "join", code: "ABCDEFGH" })).data
      .error,
  ).toMatch(/student invitation|professor invitation/i);
  await call("/api/auth/login", { email, password, portal: "instructor" });
  view = (await call("/api/workspace")).data;
  expect(view.namespace).toBe(prof.data.namespace);
});

it("keeps the opposite role practice workspace when restarting practice", async () => {
  let cookie = "",
    csrf = "";
  async function call(path: string, body?: unknown) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie,
        "x-csrf-token": csrf,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    const data = await r.json();
    if (data.csrf) csrf = data.csrf;
    return { status: r.status, data };
  }
  await call("/api/auth/signup", {
    name: "Practice Both",
    email: `practice-portals-${crypto.randomUUID()}@example.edu`,
    password: "portal local password",
    portal: "student",
  });
  await call("/api/workspace");
  const student = await call("/api/workspaces", {
    action: "practice",
    role: "student",
  });
  expect(student.status).toBe(200);
  await call("/api/workspace");
  await call("/api/workspaces", { action: "portal", portal: "instructor" });
  let view = (await call("/api/workspace")).data;
  expect(view.state).toBeNull();
  expect(view.portal).toBe("instructor");
  expect(view.workspaces).toHaveLength(0);
  const prof = await call("/api/workspaces", {
    action: "practice",
    role: "instructor",
  });
  expect(prof.status).toBe(200);
  await call("/api/workspace");
  await call("/api/workspaces", { action: "portal", portal: "student" });
  view = (await call("/api/workspace")).data;
  expect(view.namespace).toBe(student.data.namespace);
  expect(view.workspaces).toHaveLength(1);
  await call("/api/workspaces", { action: "practice", role: "student" });
  await call("/api/workspace");
  await call("/api/workspaces", { action: "portal", portal: "instructor" });
  view = (await call("/api/workspace")).data;
  expect(view.namespace).toBe(prof.data.namespace);
  expect(view.workspaces).toHaveLength(1);
});
