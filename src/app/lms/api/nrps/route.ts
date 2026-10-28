import { NextResponse } from "next/server";
import { memberships } from "@/lib/lms";
// Names and Roles Provisioning Service: the course roster, for tools holding a valid token.
export async function GET(req: Request) {
  try {
    return NextResponse.json(
      await memberships(req.headers.get("authorization")),
      {
        headers: {
          "Content-Type":
            "application/vnd.ims.lti-nrps.v2.membershipcontainer+json",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
