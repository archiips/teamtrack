import { NextResponse } from "next/server";
import { readState } from "@/lib/store";
export async function GET() {
  try {
    await readState();
    return NextResponse.json({
      ok: true,
      database: process.env.DATABASE_URL ? "postgres" : "local-development",
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
