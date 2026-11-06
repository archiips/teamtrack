import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
export function sessionKey() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.VERCEL) throw Error("Session secret missing");
  return new TextEncoder().encode(
    s || "local-development-only-secret-not-for-deployment",
  );
}
// Own accounts stay signed in for a month; demo and LTI sessions for a class period.
const lifetime = (account: boolean) => (account ? 30 * 86400 : 8 * 3600);
/** `namespace` is "" for an own account that has no workspace yet. */
export async function createSession(
  userId: string,
  namespace = "demo",
  account = false,
) {
  const csrf = crypto.randomUUID();
  const token = await new SignJWT({ userId, csrf, namespace, account })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + lifetime(account))
    .sign(sessionKey());
  return { token, csrf };
}
/** Signs in on this response (first-party cookie). */
export async function signIn(
  res: NextResponse,
  userId: string,
  namespace: string,
  account: boolean,
) {
  const { token } = await createSession(userId, namespace, account);
  res.cookies.set("tt_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: lifetime(account),
    path: "/",
  });
  return res;
}
export async function session() {
  const token = (await cookies()).get("tt_session")?.value;
  if (!token) throw Error("Please sign in");
  const { payload } = await jwtVerify(token, sessionKey(), {
    algorithms: ["HS256"],
  });
  if (typeof payload.userId !== "string" || typeof payload.csrf !== "string")
    throw Error("Invalid session");
  return {
    userId: payload.userId,
    csrf: payload.csrf,
    namespace:
      typeof payload.namespace === "string" ? payload.namespace : "demo",
    account: payload.account === true,
  };
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw Error("Invalid request origin");
}
