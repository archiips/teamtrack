import { NextResponse } from "next/server";
import { sameOrigin, session, signIn } from "@/lib/auth";
import {
  createWorkspace,
  isMember,
  joinWorkspace,
  practiceWorkspace,
} from "@/lib/workspaces";
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
    let namespace: string;
    if (body.action === "create")
      namespace = await createWorkspace(a.userId, body);
    else if (body.action === "join")
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
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save";
    const known =
      /Enter|Choose|code|workspace|removed|Unknown action|valid text/.test(
        message,
      );
    return NextResponse.json(
      { error: known ? message : "Could not save. Please retry." },
      { status: known ? 422 : 500 },
    );
  }
}
