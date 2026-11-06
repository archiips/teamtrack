import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { session, sessionKey } from "@/lib/auth";
import { readState } from "@/lib/store";
import { leaderOf, visible } from "@/lib/domain";
import { authorizeUrl, githubEnabled, installUrl } from "@/lib/github";
export const dynamic = "force-dynamic";
/**
 * Starts connecting a team's repo. `?install=1` goes to GitHub's install page first
 * (for a repo the app isn't on yet); otherwise straight to GitHub sign-in. Both come
 * back to /api/github/callback carrying this signed state.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = new URL("/", process.env.APP_URL || req.url);
  try {
    if (!githubEnabled()) throw Error("GitHub is not set up on this site");
    const a = await session();
    const teamId = url.searchParams.get("teamId") || "";
    const s = visible(await readState(a.namespace), a.userId);
    const me = s.users.find((u) => u.id === a.userId);
    const t = s.teams.find((x) => x.id === teamId);
    if (!t || (me?.role !== "instructor" && leaderOf(s, t) !== a.userId))
      throw Error("Only the team leader can connect a repo");
    const state = await new SignJWT({
      userId: a.userId,
      namespace: a.namespace,
      teamId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("github-connect")
      .setExpirationTime("15m")
      .sign(sessionKey());
    const callback = new URL("/api/github/callback", home).toString();
    return NextResponse.redirect(
      url.searchParams.get("install")
        ? installUrl(state)
        : authorizeUrl(state, callback),
      302,
    );
  } catch (e) {
    home.searchParams.set(
      "github_error",
      e instanceof Error ? e.message : "Could not reach GitHub",
    );
    return NextResponse.redirect(home, 303);
  }
}
