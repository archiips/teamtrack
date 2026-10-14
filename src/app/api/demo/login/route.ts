import { NextResponse } from "next/server";
import { createSession, sameOrigin } from "@/lib/auth";
import { readState } from "@/lib/store";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (process.env.DEMO_MODE === "false")
      return NextResponse.json(
        { error: "Demo mode disabled" },
        { status: 403 },
      );
    const { userId } = await req.json();
    const s = await readState();
    if (!s.users.some((u) => u.id === userId))
      return NextResponse.json({ error: "Unknown profile" }, { status: 422 });
    const { token } = await createSession(userId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("tt_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 28800,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Could not start session" },
      { status: 400 },
    );
  }
}
