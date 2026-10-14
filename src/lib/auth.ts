import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
function key() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.VERCEL) throw Error("Session secret missing");
  return new TextEncoder().encode(
    s || "local-development-only-secret-not-for-deployment",
  );
}
export async function createSession(userId: string, namespace = "demo") {
  const csrf = crypto.randomUUID();
  const token = await new SignJWT({ userId, csrf, namespace })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key());
  return { token, csrf };
}
export async function session() {
  const token = (await cookies()).get("tt_session")?.value;
  if (!token) throw Error("Please choose a demo profile");
  const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
  if (typeof payload.userId !== "string" || typeof payload.csrf !== "string")
    throw Error("Invalid session");
  return {
    userId: payload.userId,
    csrf: payload.csrf,
    namespace:
      typeof payload.namespace === "string" ? payload.namespace : "demo",
  };
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw Error("Invalid request origin");
}
