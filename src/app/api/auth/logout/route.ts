import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("tt_session");
  return res;
}
