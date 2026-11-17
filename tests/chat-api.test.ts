import { beforeAll, describe, expect, it } from "vitest";

// This suite writes messages/files. Refuse anything except the isolated local app.
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Chat tests must run against a local test database/app");
type Client = { cookie: string; csrf: string };
let alex: Client, jordan: Client, sam: Client, prof: Client;
async function login(name: string): Promise<Client> {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${name}@teamtrack.test`,
      password: process.env.DEMO_PASSWORD || "local-chat-demo-only",
    }),
  });
  expect(r.status).toBe(200);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  const data = await (
    await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
  ).json();
  return { cookie, csrf: data.csrf };
}
async function send(
  c: Client,
  body: string,
  options: {
    teamId?: string;
    requestId?: string;
    file?: File;
    csrf?: string;
    origin?: string;
  } = {},
) {
  const data = new FormData();
  data.set("teamId", options.teamId || "t1");
  data.set("body", body);
  data.set("requestId", options.requestId || crypto.randomUUID());
  if (options.file) data.set("file", options.file);
  return fetch(base + "/api/chat", {
    method: "POST",
    headers: {
      Cookie: c.cookie,
      Origin: options.origin ?? base,
      "x-csrf-token": options.csrf ?? c.csrf,
    },
    body: data,
  });
}
const list = (c: Client, query = "teamId=t1") =>
  fetch(base + "/api/chat?" + query, { headers: { Cookie: c.cookie } });
beforeAll(async () => {
  alex = await login("alex");
  jordan = await login("jordan");
  sam = await login("sam");
  prof = await login("morgan");
});
describe("private team chat over HTTP", () => {
  it("requires a session", async () => {
    expect((await fetch(base + "/api/chat?teamId=t1")).status).toBe(401);
  });
  it("denies another team's list and send", async () => {
    expect((await list(sam)).status).toBe(403);
    expect((await send(sam, "not my team")).status).toBe(403);
  });
  it("requires CSRF and same origin for sends", async () => {
    expect((await send(alex, "no csrf", { csrf: "bad" })).status).toBe(403);
    expect(
      (await send(alex, "wrong origin", { origin: "https://other.example" }))
        .status,
    ).toBe(403);
  });
  it("persists attributed text for teammates and instructors", async () => {
    const r = await send(alex, "Meet at the library at 4? 📚");
    expect(r.status).toBe(200);
    const { message } = await r.json();
    expect(message).toMatchObject({
      body: "Meet at the library at 4? 📚",
      actorId: "s1",
      name: "Alex Chen",
      teamId: "t1",
    });
    for (const c of [jordan, prof]) {
      const r = await list(c);
      expect(r.headers.get("cache-control")).toContain("no-store");
      expect(
        (await r.json()).messages.some(
          (m: { id: string }) => m.id === message.id,
        ),
      ).toBe(true);
    }
  });
  it("downloads exact attachment bytes only after team authorization", async () => {
    const bytes = "Team notes\nA,B\n1,2\n";
    const r = await send(alex, "", {
      file: new File([bytes], "notes.csv", { type: "text/csv" }),
    });
    expect(r.status).toBe(200);
    const { message } = await r.json();
    expect(message.attachment).toMatchObject({
      name: "notes.csv",
      bytes: Buffer.byteLength(bytes),
    });
    const url = base + "/api/chat/files/" + message.id;
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { Cookie: sam.cookie } })).status).toBe(
      403,
    );
    const download = await fetch(url, { headers: { Cookie: jordan.cookie } });
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain(
      "attachment;",
    );
    expect(download.headers.get("x-content-type-options")).toBe("nosniff");
    expect(download.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(download.headers.get("cache-control")).toContain("no-store");
    expect(await download.text()).toBe(bytes);
    const state = await (
      await fetch(base + "/api/workspace", { headers: { Cookie: alex.cookie } })
    ).json();
    expect(JSON.stringify(state)).not.toContain(bytes);
  });
  it("deduplicates retries and rejects a different payload with the same request ID", async () => {
    const requestId = crypto.randomUUID();
    const a = await (await send(alex, "One message", { requestId })).json();
    const b = await (await send(alex, "One message", { requestId })).json();
    expect(a.message.id).toBe(b.message.id);
    expect((await send(alex, "Different message", { requestId })).status).toBe(
      409,
    );
  });
  it("rejects empty, oversized text/files and invalid cursors", async () => {
    expect((await send(alex, "  ")).status).toBe(422);
    expect((await send(alex, "a".repeat(4001))).status).toBe(422);
    expect(
      (
        await send(alex, "", {
          file: new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.zip"),
        })
      ).status,
    ).toBe(413);
    expect((await list(alex, "teamId=t1&before=oops")).status).toBe(422);
    expect(
      (await list(alex, "teamId=t1&before=9223372036854775808")).status,
    ).toBe(422);
    expect((await list(alex, "teamId=t1&before=1&after=2")).status).toBe(422);
  });
  it("pages older and newer messages without losing order", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 53; i++) {
      const r = await send(alex, `Paging ${i}`);
      expect(r.status).toBe(200);
      ids.push((await r.json()).message.id);
    }
    const latest = await (await list(jordan)).json();
    expect(latest.messages).toHaveLength(50);
    expect(latest.hasMore).toBe(true);
    expect(latest.messages.at(-1).id).toBe(ids.at(-1));
    const older = await (
      await list(jordan, `teamId=t1&before=${latest.messages[0].id}`)
    ).json();
    expect(older.messages.some((m: { id: string }) => m.id === ids[0])).toBe(
      true,
    );
    const newer = await (
      await list(jordan, `teamId=t1&after=${ids[0]}`)
    ).json();
    expect(newer.messages[0].id).toBe(ids[1]);
    expect(newer.messages.at(-1).id).toBe(ids[50]);
    expect(newer.hasMore).toBe(true);
  });
  it("keeps namespaces private and revokes chat/file access after team removal", async () => {
    async function account(label: string) {
      const r = await fetch(base + "/api/auth/signup", {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: label + " Chat",
          email: `${label.toLowerCase()}-${crypto.randomUUID()}@example.edu`,
          password: "chat-local-test-password",
        }),
      });
      expect(r.status).toBe(200);
      return current(r.headers.get("set-cookie")!.split(";")[0]);
    }
    async function current(cookie: string) {
      const data = await (
        await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
      ).json();
      return { cookie, csrf: data.csrf, data };
    }
    async function action(c: Client, path: string, data: unknown) {
      return fetch(base + path, {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: c.cookie,
          "x-csrf-token": c.csrf,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    }
    let teacher = await account("Teacher"),
      student = await account("Student");
    const created = await action(teacher, "/api/workspaces", {
      action: "create",
      role: "instructor",
      course: "Chat tests",
      project: "Chat boundaries",
      due: "2030-01-15",
    });
    teacher = await current(created.headers.get("set-cookie")!.split(";")[0]);
    const joined = await action(student, "/api/workspaces", {
      action: "join",
      code: teacher.data.state.inviteCode,
    });
    student = await current(joined.headers.get("set-cookie")!.split(";")[0]);
    const made = await action(teacher, "/api/workspace", {
      type: "team.create",
      name: "Private team",
      memberIds: [student.data.userId],
    });
    expect(made.status).toBe(200);
    const teamId = (await made.json()).state.teams[0].id;
    const r = await send(student, "Private file", {
      teamId,
      file: new File(["private content"], "private.txt"),
    });
    expect(r.status).toBe(200);
    const id = (await r.json()).message.id;
    expect((await list(alex, `teamId=${teamId}`)).status).toBe(403);
    const url = base + "/api/chat/files/" + id;
    expect(
      (await fetch(url, { headers: { Cookie: alex.cookie } })).status,
    ).toBe(404);
    expect(
      (await fetch(url, { headers: { Cookie: teacher.cookie } })).status,
    ).toBe(200);
    const removed = await action(teacher, "/api/workspace", {
      type: "team.update",
      teamId,
      remove: student.data.userId,
    });
    expect(removed.status).toBe(200);
    expect((await list(student, `teamId=${teamId}`)).status).toBe(403);
    expect((await send(student, "Removed", { teamId })).status).toBe(403);
    expect(
      (await fetch(url, { headers: { Cookie: student.cookie } })).status,
    ).toBe(403);
  });
  it("deduplicates simultaneous file retries and rejects substituted bytes", async () => {
    const requestId = crypto.randomUUID();
    const options = { requestId, file: new File(["same"], "retry.txt") };
    const responses = await Promise.all([
      send(alex, "Retry", options),
      send(alex, "Retry", options),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const a = await responses[0].json(),
      b = await responses[1].json();
    expect(a.message.id).toBe(b.message.id);
    expect(
      (
        await send(alex, "Retry", {
          requestId,
          file: new File(["swap"], "retry.txt"),
        })
      ).status,
    ).toBe(409);
  });
  it("enforces the persisted workspace quota under concurrent uploads, without blocking text or another workspace", async () => {
    const signup = await fetch(base + "/api/auth/signup", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Quota Test",
        email: `quota-${crypto.randomUUID()}@example.edu`,
        password: "chat-local-test-password",
      }),
    });
    expect(signup.status).toBe(200);
    let cookie = signup.headers.get("set-cookie")!.split(";")[0];
    const workspace = async () => {
      let d = await (
        await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
      ).json();
      const created = await fetch(base + "/api/workspaces", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: cookie,
          "x-csrf-token": d.csrf,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          role: "student",
          course: "Quota test",
          project: "Private uploads",
          due: "2030-01-15",
        }),
      });
      expect(created.status).toBe(200);
      cookie = created.headers.get("set-cookie")!.split(";")[0];
      d = await (
        await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
      ).json();
      return { client: { cookie, csrf: d.csrf }, teamId: d.state.teams[0].id };
    };
    const { client, teamId } = await workspace();
    // Sixteen maximum-sized files consume 48 MiB; two simultaneous 2 MiB files
    // must serialize at the 50 MiB boundary, admitting exactly one.
    for (let i = 0; i < 16; i++)
      expect(
        (
          await send(client, "", {
            teamId,
            file: new File([new Uint8Array(3 * 1024 * 1024)], "max.bin"),
          })
        ).status,
      ).toBe(200);
    const uploads = await Promise.all(
      [1, 2].map((i) =>
        send(client, "", {
          teamId,
          file: new File(
            [new Uint8Array(2 * 1024 * 1024)],
            `boundary-${i}.bin`,
          ),
        }),
      ),
    );
    expect(uploads.map((r) => r.status).sort()).toEqual([200, 413]);
    expect(
      (await send(client, "Text still works at the file quota", { teamId }))
        .status,
    ).toBe(200);
    const other = await workspace();
    expect(
      (
        await send(other.client, "Different workspace", {
          teamId: other.teamId,
          file: new File(["ok"], "small.txt"),
        })
      ).status,
    ).toBe(200);
  }, 30000);
});
