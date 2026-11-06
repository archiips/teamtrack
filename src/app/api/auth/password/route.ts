import { NextResponse } from "next/server";
import { sameOrigin, session } from "@/lib/auth";
import { changePassword } from "@/lib/accounts";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await session();
    if (!a.account || req.headers.get("x-csrf-token") !== a.csrf)
      return NextResponse.json(
        { error: "Please sign in again" },
        { status: 403 },
      );
    const { current, next } = await req.json();
    await changePassword(a.userId, String(current ?? ""), String(next ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const known = /password/.test(message);
    return NextResponse.json(
      { error: known ? message : "Could not change the password." },
      { status: known ? 422 : 400 },
    );
  }
}
