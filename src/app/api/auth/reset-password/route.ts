import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { resetPassword } from "@/lib/password-recovery";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { token, password } = await req.json();
    await resetPassword(
      typeof token === "string" ? token : "",
      typeof password === "string" ? password : "",
    );
    const res = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    res.cookies.set("tt_session", "", { maxAge: 0, path: "/" });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known =
      message.startsWith("Use a password") ||
      message.startsWith("This reset link");
    return NextResponse.json(
      {
        error: known ? message : "Could not reset your password. Please retry.",
      },
      { status: known ? 422 : 400 },
    );
  }
}
