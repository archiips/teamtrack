import { NextResponse } from "next/server";
import { publicJwks } from "@/lib/lms";
export async function GET() {
  try {
    return NextResponse.json(publicJwks());
  } catch {
    return NextResponse.json({ keys: [] });
  }
}
