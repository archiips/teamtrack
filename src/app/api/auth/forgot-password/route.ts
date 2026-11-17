import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import {
  RecoveryUnavailable,
  recoveryMessage,
  requestPasswordRecovery,
} from "@/lib/password-recovery";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { email } = await req.json();
    await requestPasswordRecovery(typeof email === "string" ? email : "");
    return NextResponse.json(
      { ok: true, message: recoveryMessage },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RecoveryUnavailable
            ? error.message
            : "Could not request a reset link. Please retry.",
      },
      { status: error instanceof RecoveryUnavailable ? 503 : 400 },
    );
  }
}
