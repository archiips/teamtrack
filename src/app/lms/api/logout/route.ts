import { NextResponse } from "next/server";
import { app } from "@/lib/lms";
export async function POST() {
  const res = NextResponse.redirect(new URL("/lms", app()), 303);
  res.cookies.set("lms_session", "", { path: "/lms", maxAge: 0 });
  return res;
}
