import assert from "node:assert/strict";
const base = "http://localhost:3100";
async function post(path, body, c) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(c ? { Cookie: c.cookie, "x-csrf-token": c.csrf } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function current(cookie) {
  const data = await (
    await fetch(base + "/api/workspace", { headers: { Cookie: cookie } })
  ).json();
  return { cookie, csrf: data.csrf, data };
}
let r = await post("/api/auth/signup", {
  name: "Shared Quota",
  email: "shared-" + crypto.randomUUID() + "@example.edu",
  password: "test-shared-quota-only",
});
assert.equal(r.status, 200);
let c = await current(r.headers.get("set-cookie").split(";")[0]);
r = await post(
  "/api/workspaces",
  {
    action: "create",
    role: "student",
    course: "Shared quota",
    project: "Task file limit",
    due: "2030-01-15",
  },
  c,
);
assert.equal(r.status, 200);
c = await current(r.headers.get("set-cookie").split(";")[0]);
const teamId = c.data.state.teams[0].id;
r = await post(
  "/api/workspace",
  {
    type: "task.create",
    teamId,
    title: "Quota task",
    ownerId: c.data.userId,
    due: "2030-01-15",
  },
  c,
);
const task = (await r.json()).state.tasks[0];
async function file(path, bytes) {
  const f = new FormData();
  f.set("teamId", teamId);
  f.set("taskId", task.id);
  f.set("body", "");
  f.set("kind", "comment");
  f.set("url", "");
  f.set("requestId", crypto.randomUUID());
  f.set("file", new File([new Uint8Array(bytes)], "quota.bin"));
  return fetch(base + path, {
    method: "POST",
    headers: { Origin: base, Cookie: c.cookie, "x-csrf-token": c.csrf },
    body: f,
  });
}
for (let i = 0; i < 16; i++)
  assert.equal((await file("/api/chat", 3 * 1024 * 1024)).status, 200);
const uploaded = await file("/api/task-entries", 2 * 1024 * 1024);
assert.equal(uploaded.status, 200);
const saved = await uploaded.json();
const privateId = saved.state.entries.find((e) => e.id === saved.entryId)
  .attachment.id;
const firstWorkspace = c;
r = await post(
  "/api/workspaces",
  {
    action: "create",
    role: "student",
    course: "Other workspace",
    project: "Namespace boundary",
    due: "2030-01-15",
  },
  c,
);
assert.equal(r.status, 200);
c = await current(r.headers.get("set-cookie").split(";")[0]);
assert.equal(
  (
    await fetch(base + "/api/task-entries/files/" + privateId, {
      headers: { Cookie: c.cookie },
    })
  ).status,
  404,
);
c = firstWorkspace;
console.log(
  "PASS a valid task file cannot be downloaded from another workspace",
);
assert.equal((await file("/api/chat", 1)).status, 413);
assert.equal((await file("/api/task-entries", 1)).status, 413);
assert.equal(
  (
    await post(
      "/api/workspace",
      { type: "task.delete", id: task.id, version: task.version },
      c,
    )
  ).status,
  200,
);
assert.equal((await file("/api/chat", 2 * 1024 * 1024)).status, 200);
console.log(
  "PASS task and chat files share 50 MiB quota; task deletion releases binary storage",
);
