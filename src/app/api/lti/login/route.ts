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
  } catch {
    return NextResponse.json(
      {
        error:
          "Canvas launch is not configured or this platform is not registered.",
      },
      { status: 400 },
    );
  }
}
export async function GET(req: Request) {
  return launch(req, new URL(req.url).searchParams);
}
export async function POST(req: Request) {
  return launch(req, new URLSearchParams(await req.text()));
}
