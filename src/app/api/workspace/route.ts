import { integrationStatus, requestRosterSync } from "@/lib/lti";
import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { readState, mutate } from "@/lib/store";
import { visible } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await session();
    const s = await readState(a.namespace);
    const state = visible(s, a.userId);
    state.integration = await integrationStatus(a.namespace);
    return NextResponse.json(
      {
        state,
        userId: a.userId,
        csrf: a.csrf,
        namespace: a.namespace,
      },
      { headers: { "Cache-Control": "no-store" } },
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
    const s = await mutate(a.userId, c, a.namespace);
    const state = visible(s, a.userId);
    state.integration = await integrationStatus(a.namespace);
    return NextResponse.json({ state });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save";
    const status =
      message.includes("Access") || message.includes("Instructor")
        ? 403
        : message.includes("changed")
          ? 409
          : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
