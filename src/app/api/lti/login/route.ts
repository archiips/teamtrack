import { NextResponse } from "next/server";
import { beginLaunch } from "@/lib/lti";
async function launch(req: Request, p: URLSearchParams) {
  try {
    const url = await beginLaunch(
      p.get("iss") || "",
      p.get("client_id") || undefined,
      p.get("login_hint") || "",
      p.get("lti_message_hint") || undefined,
    );
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.warn("LTI_INIT_REJECTED", {
      reason: error instanceof Error ? error.message : "Unknown",
      issuer: p.get("iss"),
      clientId: p.get("client_id"),
    });
    return new NextResponse(
      '<html lang="en"><head><title>TeamTrack launch</title></head><body style="font-family:system-ui;padding:40px;color:#0d1c42"><h1>Canvas connection needs attention</h1><p>This Canvas platform or client ID does not match the configured registration. Ask the demo operator to check the global client ID, then return to your course and launch TeamTrack again.</p></body></html>',
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
export async function GET(req: Request) {
  return launch(req, new URL(req.url).searchParams);
}
export async function POST(req: Request) {
  return launch(req, new URLSearchParams(await req.text()));
}
