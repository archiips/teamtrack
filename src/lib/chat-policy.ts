import type { State } from "./types";
import { MAX_FILE_BYTES, MAX_WORKSPACE_BYTES } from "./chat-types";
export { MAX_FILE_BYTES, MAX_WORKSPACE_BYTES } from "./chat-types";
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 32 * 1024;
export class ChatError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function chatAccess(s: State, actorId: string, teamId: string) {
  const actor = s.users.find((u) => u.id === actorId && u.active !== false);
  const team = s.teams.find((t) => t.id === teamId);
  if (
    !actor ||
    !team ||
    (actor.role !== "instructor" && !team.memberIds.includes(actorId))
  )
    throw new ChatError("Access denied", 403);
  return actor;
}
export function chatCursor(value: string | null) {
  if (value === null) return null;
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
    throw new ChatError("Invalid message cursor");
  return value;
}
export function attachmentBudget(used: number, incoming: number) {
  if (incoming && used + incoming > MAX_WORKSPACE_BYTES)
    throw new ChatError(
      "This workspace has reached its 50 MB attachment limit. Send a link instead.",
      413,
    );
}
export function chatInput(input: {
  teamId: unknown;
  requestId: unknown;
  body: unknown;
  file?: File;
}) {
  if (
    typeof input.teamId !== "string" ||
    !input.teamId ||
    input.teamId.length > 100
  )
    throw new ChatError("Choose a team");
  if (
    typeof input.requestId !== "string" ||
    !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      input.requestId,
    )
  )
    throw new ChatError("Invalid message request. Reload and retry.");
  if (typeof input.body !== "string" || input.body.length > 4000)
    throw new ChatError("Keep messages within 4,000 characters");
  const body = input.body.trim();
  let file: { name: string; source: File } | undefined;
  if (input.file) {
    if (!input.file.size)
      throw new ChatError("That file is empty. Choose another file.");
    if (input.file.size > MAX_FILE_BYTES)
      throw new ChatError("Files can be up to 3 MB", 413);
    const name =
      input.file.name
        .split(/[\/\\]/)
        .at(-1)!
        .replace(/[\x00-\x1f\x7f"<>]/g, "")
        .trim()
        .slice(0, 180) || "attachment";
    file = { name, source: input.file };
  }
  if (!body && !file) throw new ChatError("Write a message or attach a file");
  return { teamId: input.teamId, requestId: input.requestId, body, file };
}
/** Bound bytes before parsing multipart; do not trust Content-Length. */
export async function readChatForm(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_REQUEST_BYTES)
    throw new ChatError("Files can be up to 3 MB", 413);
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;"))
    throw new ChatError("Invalid message upload");
  const reader = req.body?.getReader();
  if (!reader) throw new ChatError("Write a message or attach a file");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ChatError("Files can be up to 3 MB", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new ChatError("Could not read this upload. Choose the file again.");
  }
}
