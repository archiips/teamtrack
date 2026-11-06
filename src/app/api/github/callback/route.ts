import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { session, sessionKey } from "@/lib/auth";
import { mutate } from "@/lib/store";
import { linkableRepos } from "@/lib/github";
export const dynamic = "force-dynamic";
/**
 * GitHub sends the leader back here after sign-in (or after installing the app, which
 * asks for sign-in too). Their own GitHub token lists exactly the repos they can link,
 * so a repo they can't access can never be attached.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = new URL("/", process.env.APP_URL || req.url);
  try {
    const a = await session();
    const { payload } = await jwtVerify(
      url.searchParams.get("state") || "",
      sessionKey(),
      { algorithms: ["HS256"], audience: "github-connect" },
    );
    if (payload.userId !== a.userId || payload.namespace !== a.namespace)
      throw Error("This GitHub sign-in was for another session");
    const teamId = String(payload.teamId);
    const { login, repos } = await linkableRepos(
      url.searchParams.get("code") || "",
    );
    // Their GitHub username comes for free; it matches their own commits.
    await mutate(a.userId, { type: "profile.github", login }, a.namespace);
    if (repos.length === 1) {
      await mutate(
        a.userId,
        { type: "team.github.link", teamId, ...repos[0] },
        a.namespace,
      );
      home.searchParams.set("github", "linked");
    } else {
      // Several (or none): the page lets them pick, using this signed list.
      const pick = await new SignJWT({
        teamId,
        namespace: a.namespace,
        repos: repos.slice(0, 50),
      })
        .setProtectedHeader({ alg: "HS256" })
        .setAudience("github-pick")
        .setSubject(a.userId)
        .setExpirationTime("15m")
        .sign(sessionKey());
      home.searchParams.set("github_pick", pick);
    }
  } catch (e) {
    console.warn("GITHUB_CONNECT_FAILED", e instanceof Error ? e.message : e);
    home.searchParams.set(
      "github_error",
      e instanceof Error && /leader|session|sign-in/.test(e.message)
        ? e.message
        : "GitHub didn’t finish connecting. Please try again.",
    );
  }
  return NextResponse.redirect(home, 303);
}
