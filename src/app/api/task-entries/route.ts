import { NextResponse } from "next/server";
import { sameOrigin, session } from "@/lib/auth";
import { ChatError, chatInput, readChatForm } from "@/lib/chat-policy";
import { saveTaskUpload } from "@/lib/task-files";
import { openTeams, visible } from "@/lib/domain";
import { integrationStatus } from "@/lib/lti";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request) {
  let a;
  try {
    a = await session();
  } catch {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  try {
    try {
      sameOrigin(req);
    } catch {
      throw new ChatError("Invalid request origin", 403);
    }
    if (req.headers.get("x-csrf-token") !== a.csrf)
      throw new ChatError("Session expired. Reload before uploading.", 403);
    const form = await readChatForm(req),
      files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File))
      throw new ChatError("Attach one file to this update");
    const input = chatInput({
      teamId: form.get("taskId"),
      body: form.get("body"),
      requestId: form.get("requestId"),
      file: files[0],
    });
    const saved = await saveTaskUpload(
      a.namespace,
      a.userId,
      input,
      form.get("kind"),
      form.get("url") || "",
    );
    const state = visible(saved.state, a.userId);
    state.integration = await integrationStatus(a.namespace);
    return NextResponse.json(
      {
        state,
        entryId: saved.entryId,
        openTeams: openTeams(saved.state, a.userId),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ChatError
            ? e.message
            : "Could not upload this file. Your draft is kept; please retry.",
      },
      { status: e instanceof ChatError ? e.status : 500 },
    );
  }
}
