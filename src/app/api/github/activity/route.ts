import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { readState } from "@/lib/store";
import { visible } from "@/lib/domain";
import { repoActivity } from "@/lib/github";
export const dynamic = "force-dynamic";
/** Repo activity for the teams this person can see (?teamId=… for one). */
export async function GET(req: Request) {
  try {
    const a = await session();
    const s = visible(await readState(a.namespace), a.userId);
    const only = new URL(req.url).searchParams.get("teamId");
    const teams = s.teams.filter((t) => t.github && (!only || t.id === only));
    const results = await Promise.all(
      teams.map(async (t) => {
        try {
          return [
            t.id,
            await repoActivity(t.github!.installationId, t.github!.repo),
          ];
        } catch (e) {
          console.warn("GITHUB_ACTIVITY_FAILED", t.github!.repo, String(e));
          return [
            t.id,
            {
              error:
                "TeamTrack can’t read this repo right now. The app may have been removed from it; the team leader can reconnect.",
            },
          ];
        }
      }),
    );
    return NextResponse.json(Object.fromEntries(results), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
}
