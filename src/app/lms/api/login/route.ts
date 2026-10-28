import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { verifyLogin } from "@/lib/accounts";
import { startLmsSession } from "@/lib/lms";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { email, password } = await req.json();
    const account = await verifyLogin(
      String(email ?? ""),
      String(password ?? ""),
    );
    if (!account || account.namespace !== "demo")
      return NextResponse.json(
        { error: "That email and password don't match a course account." },
        { status: 401 },
      );
    const res = NextResponse.json({ ok: true });
    res.cookies.set("lms_session", await startLmsSession(account.userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 28800,
      path: "/lms",
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Could not sign in. Please retry." },
      { status: 400 },
    );
  }
}
