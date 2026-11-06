import { NextResponse } from "next/server";
import { forgetRepo, validWebhook } from "@/lib/github";
/** GitHub calls this on pushes and pull request changes; the next read refetches. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!validWebhook(body, req.headers.get("x-hub-signature-256")))
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  try {
    const repo = JSON.parse(body)?.repository?.full_name;
    if (typeof repo === "string") await forgetRepo(repo);
  } catch {}
  return NextResponse.json({ ok: true });
}
