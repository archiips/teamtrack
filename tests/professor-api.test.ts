import { expect, it } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local app only");
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
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function account(name: string) {
  const r = await call(
    undefined,
    {
      name,
      email: `${name.replaceAll(" ", "-")}-${crypto.randomUUID()}@example.edu`,
      password: "local password 123",
    },
    "/api/auth/signup",
  );
  expect(r.status).toBe(200);
  const cookie = r.cookie!;
  const s = await call({ cookie, csrf: "" }, undefined, "/api/workspace");
  return { cookie, csrf: s.data.csrf };
}
async function state(c: Client) {
  return (await call(c, undefined, "/api/workspace")).data;
}
it("isolates classes, professor invitations, monitoring and existing group membership", async () => {
  const prof = await account("Professor One"),
    other = await account("Professor Two"),
    lead = await account("Student Lead"),
    mate = await account("Team Mate");
  const cls = await call(prof, { action: "class.create", name: "Class One" });
  expect(cls.status).toBe(200);
  const forbidden = await call(other, {
    action: "create",
    role: "instructor",
    classId: cls.data.id,
    course: "Class One",
    project: "Forbidden",
    due: "2030-12-01",
  });
  expect(forbidden.status).not.toBe(200);
  const created = await call(prof, {
    action: "create",
    role: "instructor",
    classId: cls.data.id,
    course: "Class One",
    project: "Team Workspace A",
    due: "2030-12-01",
  });
  expect(created.status).toBe(200);
  prof.cookie = created.cookie!;
  let p = await state(prof);
  prof.csrf = p.csrf;
  expect(p.classes).toHaveLength(1);
  expect(p.workspaces[0].classId).toBe(cls.data.id);
  const group = await call(lead, {
    action: "create",
    role: "student",
    course: "Independent",
    project: "Student Team",
    due: "2030-12-01",
  });
  lead.cookie = group.cookie!;
  let l = await state(lead);
  lead.csrf = l.csrf;
  const inv = await call(lead, { action: "monitor.invite" });
  expect(inv.status).toBe(200);
  const joined = await call(prof, {
    action: "monitor.join",
    token: inv.data.token,
  });
  expect(joined.status).toBe(200);
  prof.cookie = joined.cookie!;
  p = await state(prof);
  prof.csrf = p.csrf;
  expect(p.state.users.find((u: any) => u.role === "instructor").monitor).toBe(
    true,
  );
  expect(
    (
      await call(
        prof,
        { type: "team.create", name: "Illegal" },
        "/api/workspace",
      )
    ).status,
  ).not.toBe(200);
  expect((await call(prof, { action: "monitor.invite" })).status).not.toBe(200);
  expect(
    (await call(other, { action: "monitor.join", token: inv.data.token }))
      .status,
  ).not.toBe(200);
  expect((await state(other)).workspaces).toHaveLength(0);
  const normal = await call(mate, {
    action: "join",
    code: l.state.inviteCode,
    role: "instructor",
  });
  expect(normal.status).toBe(200);
  mate.cookie = normal.cookie!;
  const m = await state(mate);
  expect(m.state.users.find((u: any) => u.id === m.userId).role).toBe(
    "student",
  );
  expect(m.state.teams[0].memberIds).toHaveLength(2);
  const attached = await call(prof, {
    action: "class.attach",
    classId: cls.data.id,
    namespace: p.namespace,
  });
  expect(attached.status).toBe(200);
  p = await state(prof);
  expect(
    p.workspaces.filter((w: any) => w.classId === cls.data.id),
  ).toHaveLength(2);
  expect(
    (await call(other, { action: "switch", namespace: p.namespace })).status,
  ).not.toBe(200);
  const revoked = await call(lead, {
    action: "monitor.remove",
    userId: p.userId,
  });
  expect(revoked.status).toBe(200);
  expect((await call(prof, undefined, "/api/workspace")).status).toBe(401);
  const freshInvite = await call(lead, { action: "monitor.invite" });
  const restored = await call(prof, {
    action: "monitor.join",
    token: freshInvite.data.token,
  });
  expect(restored.status).toBe(200);
  prof.cookie = restored.cookie!;
  expect(
    (await state(prof)).state.users.find((u: any) => u.monitor).active,
  ).toBe(true);
}, 30000);
