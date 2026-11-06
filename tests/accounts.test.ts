// Own accounts end to end over HTTP. Creates accounts and workspaces, so run it
// against a local database only: TEST_BASE_URL=http://localhost:3100 npm run test:accounts
import { describe, it, expect } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const run = Date.now().toString(36);
type Client = { cookie: string; csrf: string };
async function call(
  c: Client | null,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any; cookie?: string }> {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(c ? { Cookie: c.cookie, "x-csrf-token": c.csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = r.headers.get("set-cookie")?.split(";")[0];
  return { status: r.status, data: await r.json(), cookie: set };
}
async function session(cookie: string): Promise<Client & { data: any }> {
  const r = await call({ cookie, csrf: "" }, "/api/workspace");
  return { cookie, csrf: r.data.csrf, data: r.data };
}
async function signup(name: string) {
  const email = `${name.toLowerCase()}-${run}@example.edu`;
  const r = await call(null, "/api/auth/signup", {
    name: `${name} Tester`,
    email,
    password: "correct horse 1",
  });
  expect(r.status).toBe(200);
  return { email, ...(await session(r.cookie!)) };
}
describe("own accounts", () => {
  it("signs up, creates a workspace, invites a classmate who forms a team", async () => {
    const lead = await signup("Lead");
    expect(lead.data.state).toBeNull();
    const created = await call(lead, "/api/workspaces", {
      action: "create",
      role: "student",
      course: "CSS 360",
      project: "Group app",
      due: "2030-01-15",
    });
    expect(created.status).toBe(200);
    const l = await session(created.cookie!);
    const code = l.data.state.inviteCode;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(l.data.state.users[0].owner).toBe(true);

    const t = await call(l, "/api/workspace", {
      type: "team.create",
      name: "Debuggers",
    });
    expect(t.status).toBe(200);

    const mate = await signup("Mate");
    const joined = await call(mate, "/api/workspaces", {
      action: "join",
      code: code.slice(0, 4).toLowerCase() + "-" + code.slice(4),
    });
    expect(joined.status).toBe(200);
    const m = await session(joined.cookie!);
    expect(m.data.state.teams).toEqual([]);
    expect(m.data.openTeams).toHaveLength(1);
    const j = await call(m, "/api/workspace", {
      type: "team.join",
      teamId: m.data.openTeams[0].id,
    });
    expect(j.status).toBe(200);
    expect(j.data.state.teams[0].memberIds).toHaveLength(2);
    // Classmates don't see each other's emails.
    const leadSeen = j.data.state.users.find((u: any) => u.owner);
    expect(leadSeen.email).toBeUndefined();
    expect(m.data.workspaces).toHaveLength(1);
  });
  it("signs back in to the last workspace", async () => {
    const a = await signup("Return");
    await call(a, "/api/workspaces", {
      action: "create",
      role: "instructor",
      course: "CSS 474",
      project: "Studio",
      due: "2030-01-15",
    });
    const r = await call(null, "/api/auth/login", {
      email: a.email,
      password: "correct horse 1",
    });
    expect(r.status).toBe(200);
    const s = await session(r.cookie!);
    expect(s.data.state.project).toBe("Studio");
    expect(s.data.state.users[0].role).toBe("instructor");
  });
  it("rejects bad sign-ups, wrong passwords, wrong codes and foreign workspaces", async () => {
    const a = await signup("Edge");
    const dup = await call(null, "/api/auth/signup", {
      name: "Again",
      email: a.email,
      password: "another pass",
    });
    expect(dup.status).toBe(422);
    expect(
      (
        await call(null, "/api/auth/signup", {
          name: "Short",
          email: `s-${run}@x.edu`,
          password: "short",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(null, "/api/auth/signup", {
          name: "Demo",
          email: "alex@teamtrack.test",
          password: "long enough",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(null, "/api/auth/login", {
          email: a.email,
          password: "wrong password",
        })
      ).status,
    ).toBe(401);
    expect(
      (await call(a, "/api/workspaces", { action: "join", code: "ZZZZ-ZZZZ" }))
        .status,
    ).toBe(422);
    expect(
      (
        await call(a, "/api/workspaces", {
          action: "switch",
          namespace: "demo",
        })
      ).status,
    ).toBe(422);
    // Commands need a workspace first.
    expect(
      (await call(a, "/api/workspace", { type: "team.create", name: "X" }))
        .status,
    ).toBe(422);
  });
  it("changes a password", async () => {
    const a = await signup("Pw");
    expect(
      (
        await call(a, "/api/auth/password", {
          current: "nope",
          next: "brand new pass",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(a, "/api/auth/password", {
          current: "correct horse 1",
          next: "brand new pass",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(null, "/api/auth/login", {
          email: a.email,
          password: "brand new pass",
        })
      ).status,
    ).toBe(200);
  });
});
