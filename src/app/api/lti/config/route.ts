import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const base = process.env.APP_URL || new URL(req.url).origin;
  return NextResponse.json({
    title: "TeamTrack",
    description: "Student teamwork and contribution evidence",
    oidc_initiation_url: base + "/api/lti/login",
    target_link_uri: base + "/api/lti/launch",
    scopes: [
      "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
    ],
    public_jwk_url: base + "/api/lti/jwks",
    extensions: [
      {
        platform: "canvas.instructure.com",
        settings: {
          privacy_level: "public",
          placements: [
            {
              placement: "course_navigation",
              message_type: "LtiResourceLinkRequest",
              text: "TeamTrack",
              target_link_uri: base + "/api/lti/launch",
            },
          ],
        },
      },
    ],
  });
}
