import { NextResponse } from "next/server";
import { sameOrigin, session, signIn, portalValue } from "@/lib/auth";
import {
  createWorkspace,
  isMember,
  joinWorkspace,
  practiceWorkspace,
  listWorkspaces,
} from "@/lib/workspaces";
import {
  createClass,
  requireClassOwner,
  attachClass,
  monitorInvite,
  joinMonitor,
  removeMonitor,
} from "@/lib/classes";
export const dynamic = "force-dynamic";
/** Create, join or switch workspaces; each re-issues the session for the chosen one. */
export async function POST(req: Request) {
  let a;
  try {
    sameOrigin(req);
    a = await session();
  } catch {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  if (!a.account || req.headers.get("x-csrf-token") !== a.csrf)
    return NextResponse.json(
      { error: "Session expired. Reload." },
      { status: 403 },
    );
  try {
    const body = await req.json();
    if (body.action === "portal") {
      const portal = portalValue(body.portal);
      if (!portal) throw Error("Choose a valid portal");
      const namespace =
        (await listWorkspaces(a.userId)).filter((w) => w.role === portal).at(-1)
          ?.namespace || "";
      return signIn(
        NextResponse.json({ ok: true }),
        a.userId,
        namespace,
        true,
        portal,
      );
    }
    if (
      a.portal === "student" &&
      ["class.create", "class.attach", "monitor.join"].includes(body.action)
    )
      throw Error("Choose the professor portal for this action");
    if (a.portal === "instructor" && body.action === "join")
      throw Error(
        "This is a student invitation. Ask the organizer for a professor invitation link.",
      );
    if (
      a.portal &&
      ["create", "practice"].includes(body.action) &&
      body.role !== a.portal
    )
      throw Error("Choose the matching portal before creating a workspace");
    if (a.portal && body.action === "switch") {
      const target = (await listWorkspaces(a.userId)).find(
        (w) => w.namespace === body.namespace,
      );
      if (!target || target.role !== a.portal)
        throw Error("Choose the matching portal to open this workspace");
    }
    let namespace: string;
    if (body.action === "class.create") {
      const id = await createClass(a.userId, body.name);
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === "class.attach") {
      await attachClass(
        a.userId,
        String(body.classId ?? ""),
        String(body.namespace ?? ""),
      );
      return NextResponse.json({ ok: true });
    }
    if (body.action === "monitor.invite") {
      const token = await monitorInvite(a.userId, a.namespace);
      return NextResponse.json({ ok: true, token });
    }
    if (body.action === "monitor.remove") {
      await removeMonitor(a.userId, a.namespace, String(body.userId ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "monitor.join")
      namespace = await joinMonitor(a.userId, String(body.token ?? ""));
    else if (body.action === "create") {
      if (body.classId) {
        await requireClassOwner(a.userId, String(body.classId));
        if (body.role !== "instructor")
          throw Error("Instructor access required");
      }
      namespace = await createWorkspace(a.userId, body);
      if (body.classId)
        await attachClass(a.userId, String(body.classId), namespace);
    } else if (body.action === "join")
      namespace = await joinWorkspace(a.userId, String(body.code ?? ""));
    else if (body.action === "practice")
      namespace = await practiceWorkspace(a.userId, body.role);
    else if (body.action === "switch") {
      namespace = String(body.namespace ?? "");
      if (!(await isMember(a.userId, namespace)))
        throw Error("You’re not a member of that workspace");
    } else throw Error("Unknown action");
    return signIn(
      NextResponse.json({ ok: true, namespace }),
      a.userId,
      namespace,
      true,
      body.action === "monitor.join" ? "instructor" : a.portal,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save";
    const known =
      /Enter|Choose|code|workspace|removed|Unknown action|valid text|invite|invitation|Class|Instructor|already belong/.test(
        message,
      );
    return NextResponse.json(
      { error: known ? message : "Could not save. Please retry." },
      { status: known ? 422 : 500 },
    );
  }
}
