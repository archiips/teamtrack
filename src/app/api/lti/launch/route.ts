import { NextResponse } from "next/server";
import { finishLaunch } from "@/lib/lti";
import { createSession } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const p = new URLSearchParams(await req.text());
    const { userId, namespace } = await finishLaunch(
      p.get("state") || "",
      p.get("id_token") || "",
    );
    const { token } = await createSession(userId, namespace);
    const res = NextResponse.redirect(
      new URL("/", process.env.APP_URL || req.url),
      303,
    );
    res.cookies.set("tt_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 28800,
      path: "/",
    });
    return res;
  } catch(error) {
    console.warn("LTI_VERIFY_REJECTED",error instanceof Error?error.message:"Unknown verification failure");
    return NextResponse.json(
      {
        error:
          "This Canvas launch expired or could not be verified. Return to your course and launch TeamTrack again.",
      },
      { status: 401 },
    );
  }
}
