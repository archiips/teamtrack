import { beforeAll, describe, it, expect } from "vitest";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local app and database only");
type Client = { cookie: string; csrf: string };
let alex: Client, jordan: Client, sam: Client, prof: Client;
async function login(name: string) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: name + "@teamtrack.test",
      password: "local-chat-demo-only",
    }),
  });
  expect(r.status).toBe(200);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  const d = await (
    await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
  ).json();
  return { cookie, csrf: d.csrf };
}
async function send(
  c: Client,
  options: {
    taskId?: string;
    body?: string;
    kind?: string;
    file?: File;
    requestId?: string;
    csrf?: string;
    url?: string;
  } = {},
) {
  const f = new FormData();
  f.set("taskId", options.taskId || "k1");
  f.set("body", options.body ?? "Task file test");
  f.set("kind", options.kind || "comment");
  f.set("url", options.url || "");
  f.set("requestId", options.requestId || crypto.randomUUID());
  f.set("file", options.file || new File(["Project notes\n"], "notes.txt"));
  return fetch(base + "/api/task-entries", {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: c.cookie,
      "x-csrf-token": options.csrf ?? c.csrf,
    },
    body: f,
  });
}
beforeAll(async () => {
  alex = await login("alex");
  jordan = await login("jordan");
  sam = await login("sam");
  prof = await login("morgan");
});
describe("private task comment and contribution files", () => {
  it("requires session, CSRF and current team access", async () => {
    expect(
      (await fetch(base + "/api/task-entries", { method: "POST" })).status,
    ).toBe(401);
    expect((await send(alex, { csrf: "bad" })).status).toBe(403);
    expect((await send(sam)).status).toBe(403);
  });
  it("posts a comment with private attachment, attributed history and exact download bytes", async () => {
    const r = await send(alex);
    expect(r.status).toBe(200);
    const d = await r.json();
    const entry = d.state.entries.find(
      (e: { id: string }) => e.id === d.entryId,
    );
    expect(entry).toMatchObject({
      actorId: "s1",
      kind: "comment",
      body: "Task file test",
      attachment: { name: "notes.txt", bytes: 14 },
    });
    const url = base + "/api/task-entries/files/" + entry.attachment.id;
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { Cookie: sam.cookie } })).status).toBe(
      403,
    );
    for (const c of [jordan, prof]) {
      const f = await fetch(url, { headers: { Cookie: c.cookie } });
      expect(f.status).toBe(200);
      expect(f.headers.get("content-type")).toBe("application/octet-stream");
      expect(f.headers.get("content-disposition")).toContain("attachment;");
      expect(f.headers.get("cache-control")).toContain("no-store");
      expect(await f.text()).toBe("Project notes\n");
    }
    expect(d.state.events[0].actorId).toBe("s1");
  });
  it("supports attachment-only comments and contributions", async () => {
    for (const kind of ["comment", "contribution"]) {
      const r = await send(alex, { kind, body: "" });
      expect(r.status).toBe(200);
      const d = await r.json();
      expect(
        d.state.entries.find((e: { id: string }) => e.id === d.entryId).kind,
      ).toBe(kind);
    }
  });
  it("deduplicates retries and rejects changed file bytes", async () => {
    const requestId = crypto.randomUUID();
    const a = await (await send(alex, { requestId })).json();
    const b = await (await send(alex, { requestId })).json();
    expect(a.entryId).toBeDefined();
    expect(a.entryId).toBe(b.entryId);
    expect(
      (
        await send(alex, {
          requestId,
          file: new File(["Other content\n"], "notes.txt"),
        })
      ).status,
    ).toBe(409);
  });
  it("rejects oversized files and unsafe links without posting an entry", async () => {
    expect(
      (
        await send(alex, {
          file: new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.zip"),
        })
      ).status,
    ).toBe(413);
    expect((await send(alex, { url: "javascript:alert(1)" })).status).toBe(422);
  });
  it("removes downloads and storage when its task is deleted", async () => {
    const created = await fetch(base + "/api/workspace", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: alex.cookie,
        "x-csrf-token": alex.csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "task.create",
        teamId: "t1",
        title: "Attachment delete test",
        ownerId: "s1",
        due: "2030-01-15",
      }),
    });
    expect(created.status).toBe(200);
    const task = (await created.json()).state.tasks.at(-1);
    const r = await send(alex, { taskId: task.id });
    expect(r.status).toBe(200);
    const d = await r.json();
    const entry = d.state.entries.find(
      (e: { id: string }) => e.id === d.entryId,
    );
    const deleted = await fetch(base + "/api/workspace", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: alex.cookie,
        "x-csrf-token": alex.csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "task.delete",
        id: task.id,
        version: task.version,
      }),
    });
    expect(deleted.status).toBe(200);
    expect(
      (
        await fetch(base + "/api/task-entries/files/" + entry.attachment.id, {
          headers: { Cookie: alex.cookie },
        })
      ).status,
    ).toBe(404);
  });
});
