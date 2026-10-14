import { NextResponse } from "next/server";
export async function GET() {
  if (!process.env.LTI_PRIVATE_JWK) return NextResponse.json({ keys: [] });
  const { n, e, kid, kty } = JSON.parse(process.env.LTI_PRIVATE_JWK);
  return NextResponse.json({
    keys: [{ n, e, kid, kty, alg: "RS256", use: "sig" }],
  });
}
