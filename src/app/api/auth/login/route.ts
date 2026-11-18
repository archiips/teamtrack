import { NextResponse } from "next/server";
import { sameOrigin, signIn, portalValue } from "@/lib/auth";
import { listWorkspaces } from "@/lib/workspaces";
import { verifyLogin } from "@/lib/accounts";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { email, password, portal: requestedPortal } = await req.json();
    const portal = portalValue(requestedPortal);
    const account = await verifyLogin(
      String(email ?? ""),
      String(password ?? ""),
    );
    if (!account)
      return NextResponse.json(
        { error: "That email and password don't match an account." },
        { status: 401 },
      );
    const namespace =
      account.account && portal
        ? (await listWorkspaces(account.userId))
            .filter((w) => w.role === portal)
            .at(-1)?.namespace || ""
        : account.namespace;
    return signIn(
      NextResponse.json({ ok: true }),
      account.userId,
      namespace,
      account.account,
      account.account ? portal : undefined,
    );
  } catch {
    return NextResponse.json(
      { error: "Could not sign in. Please retry." },
      { status: 400 },
    );
  }
}
