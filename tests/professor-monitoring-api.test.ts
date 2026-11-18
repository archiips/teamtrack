import { it, expect } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
type Client = { cookie: string; csrf: string };
async function call(
  c: Client | undefined,
  body?: unknown,
  path = "/api/workspaces",
) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(c ? { Cookie: c.cookie, "x-csrf-token": c.csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (c) {
    const cookie = r.headers.get("set-cookie");
    if (cookie) c.cookie = cookie.split(";")[0];
    if (data.csrf) c.csrf = data.csrf;
  }
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function account(name: string, portal = "student") {
  const r = await call(
    undefined,
    {
      name,
      email: `monitor-${crypto.randomUUID()}@example.edu`,
      password: "local monitor password",
      portal,
    },
    "/api/auth/signup",
  );
  expect(r.status).toBe(200);
  const c = { cookie: r.cookie!, csrf: "" };
  await call(c, undefined, "/api/workspace");
  return c;
}
it("lets a group member invite a professor and places the same project in a class atomically", async () => {
  const owner = await account("Team Owner"),
    member = await account("Team Member"),
    prof = await account("Professor", "instructor");
  await call(owner, {
    action: "create",
    role: "student",
    course: "Original course",
    project: "Existing Student Project",
    due: "2030-12-01",
  });
  const original = (await call(owner, undefined, "/api/workspace")).data;
  expect(
    (await call(member, { action: "join", code: original.state.inviteCode }))
      .status,
  ).toBe(200);
  await call(member, undefined, "/api/workspace");
  const invite = await call(member, { action: "monitor.invite" });
  expect(invite.status).toBe(200);
  const joined = await call(prof, {
    action: "monitor.join",
    token: invite.data.token,
    className: "BBUS 444",
  });
  expect(joined.status).toBe(200);
  const p = (await call(prof, undefined, "/api/workspace")).data;
  expect(p.namespace).toBe(original.namespace);
  expect(p.state.project).toBe("Existing Student Project");
  expect(p.classes).toHaveLength(1);
  expect(p.classes[0].name).toBe("BBUS 444");
  expect(p.workspaces[0].classId).toBe(p.classes[0].id);
  expect(
    p.state.users.find((u: { id: string }) => u.id === p.userId).monitor,
  ).toBe(true);
  expect(
    (
      await call(
        prof,
        { type: "project.update", project: "Changed" },
        "/api/workspace",
      )
    ).status,
  ).toBe(403);
  const other = await account("Other Professor", "instructor");
  const next = await call(member, { action: "monitor.invite" });
  expect(
    (
      await call(other, {
        action: "monitor.join",
        token: next.data.token,
        classId: p.classes[0].id,
      })
    ).status,
  ).not.toBe(200);
  expect(
    (
      await call(other, {
        action: "monitor.join",
        token: next.data.token,
        className: "Own class",
      })
    ).status,
  ).toBe(200);
  const otherState = (await call(other, undefined, "/api/workspace")).data;
  expect(otherState.classes[0].name).toBe("Own class");
  await call(owner, {
    action: "create",
    role: "student",
    course: "Original course",
    project: "Second team",
    due: "2030-12-01",
  });
  await call(owner, undefined, "/api/workspace");
  const secondInvite = await call(owner, { action: "monitor.invite" });
  expect(
    (
      await call(prof, {
        action: "monitor.join",
        token: secondInvite.data.token,
        classId: p.classes[0].id,
      })
    ).status,
  ).toBe(200);
  const placed = (await call(prof, undefined, "/api/workspace")).data;
  expect(placed.classes).toHaveLength(1);
  expect(
    placed.workspaces.filter(
      (w: { classId: string }) => w.classId === p.classes[0].id,
    ),
  ).toHaveLength(2);
}, 20000);
it("does not let a class student invite a monitor across other teams", async () => {
  const teacher = await account("Class Instructor", "instructor"),
    student = await account("Class Student");
  await call(teacher, {
    action: "create",
    role: "instructor",
    course: "Multi team class",
    project: "Class project",
    due: "2030-12-01",
  });
  const s = (await call(teacher, undefined, "/api/workspace")).data;
  await call(student, { action: "join", code: s.state.inviteCode });
  await call(student, undefined, "/api/workspace");
  expect((await call(student, { action: "monitor.invite" })).status).toBe(422);
  const practice = await account("Private Practice");
  await call(practice, { action: "practice", role: "student" });
  await call(practice, undefined, "/api/workspace");
  expect((await call(practice, { action: "monitor.invite" })).status).not.toBe(
    200,
  );
});
