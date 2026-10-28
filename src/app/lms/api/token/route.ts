import { NextResponse } from "next/server";
import { issueAccessToken } from "@/lib/lms";
export async function POST(req: Request) {
  const p = new URLSearchParams(await req.text());
  if (
    p.get("grant_type") !== "client_credentials" ||
    p.get("client_assertion_type") !==
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
  )
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await issueAccessToken(
        p.get("client_assertion") || "",
        p.get("scope") || "",
      ),
    );
  } catch (e) {
    const scope = e instanceof Error && e.message === "invalid_scope";
    return NextResponse.json(
      { error: scope ? "invalid_scope" : "invalid_client" },
      { status: scope ? 400 : 401 },
    );
  }
}
