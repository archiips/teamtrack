import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { sameOrigin, session, sessionKey } from "@/lib/auth";
import { mutate } from "@/lib/store";
import { openTeams, visible } from "@/lib/domain";
export const dynamic = "force-dynamic";
/** Links the repo the leader picked from the list GitHub returned for them. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await session();
    if (req.headers.get("x-csrf-token") !== a.csrf)
      return NextResponse.json(
        { error: "Session expired. Reload." },
        { status: 403 },
      );
    const { pick, repo } = await req.json();
    const { payload } = await jwtVerify(String(pick), sessionKey(), {
      algorithms: ["HS256"],
      audience: "github-pick",
      subject: a.userId,
    });
    if (payload.namespace !== a.namespace)
      throw Error("Open the workspace you connected from");
    const choice = (
      payload.repos as { installationId: number; repo: string }[]
    ).find((r) => r.repo === repo);
    if (!choice) throw Error("Choose one of your repositories");
    const s = await mutate(
      a.userId,
      {
        type: "team.github.link",
        teamId: payload.teamId,
        installationId: choice.installationId,
        repo: choice.repo,
      },
      a.namespace,
    );
    return NextResponse.json({
      state: visible(s, a.userId),
      openTeams: openTeams(s, a.userId),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return NextResponse.json(
      {
        error: /exp/.test(message)
          ? "That GitHub sign-in expired. Connect again."
          : message || "Could not connect the repo",
      },
      { status: 422 },
    );
  }
}
