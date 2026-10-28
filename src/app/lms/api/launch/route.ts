import { NextResponse } from "next/server";
import { DEMO_LMS } from "@/lib/lti";
import { app, lmsIssuer, lmsUser } from "@/lib/lms";
// Third-party initiated login: the LMS hands the browser to TeamTrack's OIDC login endpoint.
export async function GET() {
  const user = await lmsUser();
  if (!user) return NextResponse.redirect(new URL("/lms", app()), 303);
  const url = new URL(app() + "/api/lti/login");
  url.search = new URLSearchParams({
    iss: lmsIssuer(),
    login_hint: user.id,
    target_link_uri: app() + "/api/lti/launch",
    client_id: DEMO_LMS.clientId,
    lti_message_hint: "teamtrack-nav",
  }).toString();
  return NextResponse.redirect(url, 302);
}
