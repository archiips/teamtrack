import { NextResponse } from "next/server";
import { sameOrigin, signIn } from "@/lib/auth";
import { verifyLogin } from "@/lib/accounts";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { email, password } = await req.json();
    const account = await verifyLogin(
      String(email ?? ""),
      String(password ?? ""),
    );
    if (!account)
      return NextResponse.json(
        { error: "That email and password don't match an account." },
        { status: 401 },
      );
    return signIn(
      NextResponse.json({ ok: true }),
      account.userId,
      account.namespace,
      account.account,
    );
  } catch {
    return NextResponse.json(
      { error: "Could not sign in. Please retry." },
      { status: 400 },
    );
  }
}
