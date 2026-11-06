import { NextResponse } from "next/server";
import { sameOrigin, signIn } from "@/lib/auth";
import { createAccount } from "@/lib/accounts";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const { name, email, password } = await req.json();
    const id = await createAccount(
      String(name ?? ""),
      String(email ?? ""),
      String(password ?? ""),
    );
    return signIn(NextResponse.json({ ok: true }), id, "", true);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Only our own validation messages reach the person; database errors stay generic.
    const known = /Enter|Use a password|already exists|class demo/.test(
      message,
    );
    return NextResponse.json(
      {
        error: known ? message : "Could not create the account. Please retry.",
      },
      { status: known ? 422 : 500 },
    );
  }
}
