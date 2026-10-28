import { NextResponse } from "next/server";
import { createSession, sameOrigin } from "@/lib/auth";
import { verifyLogin } from "@/lib/accounts";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (process.env.DEMO_MODE === "false")
      return NextResponse.json(
        { error: "Demo sign-in is disabled" },
        { status: 403 },
      );
    const { email, password } = await req.json();
    const account = await verifyLogin(
      String(email ?? ""),
      String(password ?? ""),
    );
    if (!account)
      return NextResponse.json(
        { error: "That email and password don't match a demo account." },
        { status: 401 },
      );
    const { token } = await createSession(account.userId, account.namespace);
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
      { error: "Could not sign in. Please retry." },
      { status: 400 },
    );
  }
}
