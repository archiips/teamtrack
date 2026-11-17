// Run against the isolated local server/database; never sends email.
import { beforeAll, describe, expect, it } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local server only");
let cookie = "",
  csrf = "",
  id = "";
beforeAll(async () => {
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alex@teamtrack.test",
      password: "local-chat-demo-only",
    }),
  });
  expect(login.status).toBe(200);
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  csrf = (
    await (
      await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
    ).json()
  ).csrf;
});
async function post(path: string, body: unknown, token = csrf) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
      "x-csrf-token": token,
    },
    body: JSON.stringify(body),
  });
}
describe("reminder request boundaries", () => {
  it("requires a session and CSRF for inbox writes", async () => {
    expect((await fetch(base + "/api/notifications")).status).toBe(401);
    expect(
      (await post("/api/notifications", { action: "read", id: "x" }, "wrong"))
        .status,
    ).toBe(403);
    expect(
      (
        await post("/api/notifications", {
          action: "read",
          id: "another-team-private-key",
        })
      ).status,
    ).toBe(404);
  });
  it("returns authorized items and persists read status", async () => {
    const r = await fetch(base + "/api/notifications", {
      headers: { Cookie: cookie },
    });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    const d = await r.json();
    expect(d.emailEnabled).toBe(false);
    expect(d.emailAvailable).toBe(false);
    // Demo Alex has a pending agreement on the reset seed.
    id = d.items[0]?.id;
    expect(id).toBeTruthy();
    const marked = await post("/api/notifications", { action: "read", id });
    expect(marked.status).toBe(200);
    expect(
      (await marked.json()).items.find((x: { id: string }) => x.id === id).read,
    ).toBe(true);
  });
  it("forbids demo email opt-in and protects cron", async () => {
    expect(
      (await post("/api/notifications/email", { enabled: true })).status,
    ).toBe(403);
    expect((await fetch(base + "/api/cron/reminders")).status).toBe(401);
  });
});
