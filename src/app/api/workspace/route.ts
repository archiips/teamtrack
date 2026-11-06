import { integrationStatus, requestRosterSync } from "@/lib/lti";
import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { readState, mutate } from "@/lib/store";
import { openTeams, visible } from "@/lib/domain";
import { accountById } from "@/lib/accounts";
import { listWorkspaces, rotateInvite } from "@/lib/workspaces";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await session();
    const headers = { "Cache-Control": "no-store" };
    const account = a.account ? await accountById(a.userId) : undefined;
    if (a.account && !account) throw Error("Please sign in");
    const workspaces = a.account ? await listWorkspaces(a.userId) : [];
    // An own account with no workspace yet: the client shows create / join.
    if (!a.namespace)
      return NextResponse.json(
        { state: null, account, workspaces, csrf: a.csrf },
        { headers },
      );
    const s = await readState(a.namespace);
    const state = visible(s, a.userId);
    state.integration = await integrationStatus(a.namespace);
    return NextResponse.json(
      {
        state,
        userId: a.userId,
        csrf: a.csrf,
        namespace: a.namespace,
        account,
        workspaces,
        openTeams: openTeams(s, a.userId),
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await session();
    if (req.headers.get("x-csrf-token") !== a.csrf)
      return NextResponse.json(
        { error: "Session expired. Reload." },
        { status: 403 },
      );
    if (Number(req.headers.get("content-length")) > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const raw = await req.text();
    if (raw.length > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const c = JSON.parse(raw);
    if (!c || typeof c.type !== "string") throw Error("Invalid action");
    if (c.type === "invite.rotate") {
      const current = await readState(a.namespace);
      const me = current.users.find((u) => u.id === a.userId);
      if (!current.inviteCode || !(me?.role === "instructor" || me?.owner))
        throw Error("Only the workspace organizer can change this");
      await rotateInvite(a.namespace);
      const s = await readState(a.namespace);
      return NextResponse.json({
        state: visible(s, a.userId),
        openTeams: openTeams(s, a.userId),
      });
    }
    if (c.type === "roster.sync") {
      const current = await readState(a.namespace);
      visible(current, a.userId);
      if (current.users.find((u) => u.id === a.userId)?.role !== "instructor")
        throw Error("Instructor access required");
      await requestRosterSync(a.namespace);
      const state = visible(await readState(a.namespace), a.userId);
      state.integration = await integrationStatus(a.namespace);
      return NextResponse.json({ state });
    }
    if (!a.namespace) throw Error("Choose a workspace first");
    const s = await mutate(a.userId, c, a.namespace);
    const state = visible(s, a.userId);
    state.integration = await integrationStatus(a.namespace);
    return NextResponse.json({ state, openTeams: openTeams(s, a.userId) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save";
    const status =
      message.includes("Access") ||
      message.includes("Instructor") ||
      message.includes("organizer")
        ? 403
        : message.includes("changed")
          ? 409
          : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
