import { expect, it } from "vitest";
import postgres from "postgres";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
const enabled =
  process.env.DATABASE_URL === "postgres://tt@127.0.0.1:54349/teamtrack";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local only");
it.skipIf(!enabled)(
  "isolates unrelated accounts and rejects every workspace API after membership revocation",
  async () => {
    const db = postgres(process.env.DATABASE_URL!, { max: 1 });
    type Client = {
      cookie: string;
      csrf: string;
      namespace: string;
      userId: string;
      teamId: string;
    };
    async function req(c: Client | undefined, path: string, body?: unknown) {
      return fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          ...(c ? { Cookie: c.cookie, "x-csrf-token": c.csrf } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    async function make(name: string): Promise<Client> {
      let r = await req(undefined, "/api/auth/signup", {
        name,
        email: `${name.replaceAll(" ", "-")}-${crypto.randomUUID()}@example.edu`,
        password: "local access password",
        portal: "student",
      });
      expect(r.status).toBe(200);
      const c = {
        cookie: r.headers.get("set-cookie")!.split(";")[0],
        csrf: "",
        namespace: "",
        userId: "",
        teamId: "",
      };
      let s = await (await req(c, "/api/workspace")).json();
      c.csrf = s.csrf;
      r = await req(c, "/api/workspaces", {
        action: "create",
        role: "student",
        course: "Access test",
        project: name,
        due: "2030-12-01",
      });
      expect(r.status).toBe(200);
      c.cookie = r.headers.get("set-cookie")!.split(";")[0];
      s = await (await req(c, "/api/workspace")).json();
      return {
        ...c,
        csrf: s.csrf,
        namespace: s.namespace,
        userId: s.userId,
        teamId: s.state.teams[0].id,
      };
    }
    try {
      const owner = await make("Private Owner"),
        outsider = await make("Uninvited");
      const list = await (
        await req(outsider, "/api/workspace?namespace=" + owner.namespace)
      ).json();
      expect(list.namespace).toBe(outsider.namespace);
      expect(
        list.workspaces.some(
          (w: { namespace: string }) => w.namespace === owner.namespace,
        ),
      ).toBe(false);
      expect(
        (
          await req(outsider, "/api/workspaces", {
            action: "switch",
            namespace: owner.namespace,
          })
        ).status,
      ).toBe(422);
      expect(
        (await req(outsider, "/api/chat?teamId=" + owner.teamId)).status,
      ).toBe(403);
      const form = new FormData();
      form.set("teamId", owner.teamId);
      form.set("body", "Private fixture");
      form.set("requestId", crypto.randomUUID());
      form.set("file", new File(["private fixture"], "private.txt"));
      const sent = await fetch(base + "/api/chat", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: owner.cookie,
          "x-csrf-token": owner.csrf,
        },
        body: form,
      });
      expect(sent.status).toBe(200);
      const message = (await sent.json()).message;
      expect(
        (await req(outsider, "/api/chat/files/" + message.id)).status,
      ).toBe(404);
      const parts = owner.cookie.slice("tt_session=".length).split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      payload.namespace = outsider.namespace;
      parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
      expect(
        (
          await req(
            { ...owner, cookie: "tt_session=" + parts.join(".") },
            "/api/workspace",
          )
        ).status,
      ).toBe(401);
      await db`DELETE FROM teamtrack_member WHERE user_id=${owner.userId} AND namespace=${owner.namespace}`;
      expect(
        (await req(owner, "/api/chat?teamId=" + owner.teamId)).status,
      ).toBe(401);
      expect((await req(owner, "/api/chat/files/" + message.id)).status).toBe(
        401,
      );
      for (const path of [
        "/api/notifications",
        "/api/github/activity",
        "/api/task-entries/files/00000000-0000-4000-8000-000000000001",
      ]) {
        expect((await req(owner, path)).status).toBe(401);
      }
      expect(
        (await req(owner, "/api/workspaces", { action: "monitor.invite" }))
          .status,
      ).not.toBe(200);
      expect(
        (
          await req(owner, "/api/workspace", {
            type: "agreement.accept",
            teamId: owner.teamId,
            version: 1,
          })
        ).status,
      ).toBe(403);
    } finally {
      await db.end();
    }
  },
);
