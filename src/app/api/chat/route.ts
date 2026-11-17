import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/auth";
import { readState } from "@/lib/store";
import { chatHistory, saveChat } from "@/lib/chat";
import {
  ChatError,
  chatAccess,
  chatCursor,
  chatInput,
  readChatForm,
} from "@/lib/chat-policy";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: Request) {
  let a;
  try {
    a = await session();
  } catch {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  try {
    const q = new URL(req.url).searchParams;
    const before = chatCursor(q.get("before")),
      after = chatCursor(q.get("after"));
    if (before && after)
      throw new ChatError("Use one message cursor at a time");
    const data = await chatHistory(
      a.namespace,
      a.userId,
      q.get("teamId") || "",
      before,
      after,
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
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
      throw new ChatError("Session expired. Reload before sending.", 403);
    const form = await readChatForm(req);
    const files = form.getAll("file");
    if (files.length > 1 || (files[0] && !(files[0] instanceof File)))
      throw new ChatError("Attach one file per message");
    const input = chatInput({
      teamId: form.get("teamId"),
      requestId: form.get("requestId"),
      body: form.get("body"),
      file: files[0] as File | undefined,
    });
    chatAccess(await readState(a.namespace), a.userId, input.teamId);
    const message = await saveChat(a.namespace, a.userId, input);
    return NextResponse.json(
      { message },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof ChatError
          ? e.message
          : "Could not open or save chat. Please retry.",
    },
    { status: e instanceof ChatError ? e.status : 500 },
  );
}
