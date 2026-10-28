import { describe, it, expect } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const password = process.env.DEMO_PASSWORD || "teamtrack474";
const emails: Record<string, string> = {
  p1: "morgan@teamtrack.test",
  s1: "alex@teamtrack.test",
  s2: "jordan@teamtrack.test",
  s5: "sam@teamtrack.test",
};
async function login(userId: string) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: emails[userId], password }),
  });
  expect(r.status).toBe(200);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  const data = await (
    await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
  ).json();
  return { cookie, ...data };
}
describe("deployed boundaries", () => {
  it("rejects a wrong password", async () => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ email: emails.s1, password: "wrong-password" }),
    });
    expect(r.status).toBe(401);
  });
  it("denies unauthenticated reads", async () => {
    expect((await fetch(base + "/api/workspace")).status).toBe(401);
  });
  it("denies cross-origin login", async () => {
    expect(
      (
        await fetch(base + "/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://attacker.example",
          },
          body: JSON.stringify({ email: emails.p1, password }),
        })
      ).status,
    ).toBe(400);
  });
  it("student cannot view another team or mutate it", async () => {
    const a = await login("s1");
    expect(a.state.teams.map((t: { id: string }) => t.id)).toEqual(["t1"]);
    const r = await fetch(base + "/api/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        Cookie: a.cookie,
        "x-csrf-token": a.csrf,
      },
      body: JSON.stringify({
        type: "task.update",
        id: "k5",
        version: 1,
        status: "done",
      }),
    });
    expect(r.status).toBe(403);
  });
  it("rejects missing csrf", async () => {
    const a = await login("s1");
    const r = await fetch(base + "/api/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        Cookie: a.cookie,
      },
      body: JSON.stringify({
        type: "agreement.accept",
        teamId: "t1",
        version: 1,
      }),
    });
    expect(r.status).toBe(403);
  });
  it("persists an attributed update visible to professor", async () => {
    const a = await login("s1");
    const body = "Automated integration check " + crypto.randomUUID();
    const r = await fetch(base + "/api/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        Cookie: a.cookie,
        "x-csrf-token": a.csrf,
      },
      body: JSON.stringify({
        type: "contribution.add",
        taskId: "k1",
        body,
        url: "https://www.washington.edu/accessibility/",
      }),
    });
    expect(r.status).toBe(200);
    const p = await login("p1");
    expect(
      p.state.entries.some(
        (e: { body: string; actorId: string }) =>
          e.body === body && e.actorId === "s1",
      ),
    ).toBe(true);
  });
});
