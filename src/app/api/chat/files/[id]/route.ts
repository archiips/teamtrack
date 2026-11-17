import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { chatFile } from "@/lib/chat";
import { ChatError, chatCursor } from "@/lib/chat-policy";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/chat/files/[id]">,
) {
  let a;
  try {
    a = await session();
  } catch {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  try {
    const id = chatCursor((await ctx.params).id)!;
    const file = await chatFile(a.namespace, a.userId, id);
    // Always download, including HTML/SVG. Never execute uploaded content in the app origin.
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ChatError
            ? e.message
            : "Could not download this file. Please retry.",
      },
      { status: e instanceof ChatError ? e.status : 500 },
    );
  }
}
