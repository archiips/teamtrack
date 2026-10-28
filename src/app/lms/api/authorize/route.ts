import { DEMO_LMS } from "@/lib/lti";
import { app, idToken, lmsUser } from "@/lib/lms";
const escape = (v: string) =>
  v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function page(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opening TeamTrack</title></head><body style="font-family:system-ui;padding:40px;color:#1b0f3b">${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
// OIDC authorization endpoint: checks the request, then posts a signed id_token back to TeamTrack.
async function authorize(p: URLSearchParams) {
  const redirect = app() + "/api/lti/launch";
  const user = await lmsUser();
  if (
    p.get("client_id") !== DEMO_LMS.clientId ||
    p.get("redirect_uri") !== redirect ||
    p.get("response_type") !== "id_token" ||
    p.get("response_mode") !== "form_post" ||
    !p.get("scope")?.split(" ").includes("openid") ||
    !p.get("state") ||
    !p.get("nonce")
  )
    return page(
      "<h1>Launch request rejected</h1><p>The tool sent an invalid login request.</p>",
      400,
    );
  if (!user || user.id !== p.get("login_hint"))
    return page(
      '<h1>Please sign in again</h1><p>Your course session ended. <a href="/lms" target="_top">Sign in to the course</a> and open TeamTrack again.</p>',
      401,
    );
  const token = await idToken(user, p.get("nonce")!);
  return page(
    `<form method="post" action="${escape(redirect)}"><input type="hidden" name="id_token" value="${escape(token)}"><input type="hidden" name="state" value="${escape(p.get("state")!)}"><noscript><button>Continue to TeamTrack</button></noscript></form><script>document.forms[0].submit()</script>`,
  );
}
export async function GET(req: Request) {
  return authorize(new URL(req.url).searchParams);
}
export async function POST(req: Request) {
  return authorize(new URLSearchParams(await req.text()));
}
