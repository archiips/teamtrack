import { createHash, randomUUID } from "node:crypto";
import { attachmentDatabase } from "./chat";
import {
  attachmentBudget,
  chatAccess,
  ChatError,
  chatInput,
} from "./chat-policy";
import { apply } from "./domain";
import { readState } from "./store";
import type { State } from "./types";

export async function saveTaskUpload(
  namespace: string,
  actorId: string,
  input: ReturnType<typeof chatInput>,
  kind: unknown,
  url: unknown,
) {
  if (!input.file) throw new ChatError("Choose a file to attach");
  if (kind !== "comment" && kind !== "contribution")
    throw new ChatError("Choose comment or contribution");
  if (typeof url !== "string" || url.length > 4000)
    throw new ChatError("Enter a valid evidence link");
  const taskId = input.teamId;
  const file = input.file;
  const bytes = Buffer.from(await file.source.arrayBuffer());
  const digest = createHash("sha256")
    .update(JSON.stringify([taskId, kind, input.body, url, file.name]))
    .update(bytes)
    .digest("hex");
  const db = await attachmentDatabase();
  return db.begin(async (tx) => {
    const [record] =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    if (!record) throw new ChatError("Access denied", 403);
    const state = record.data as State;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) throw new ChatError("Access denied", 403);
    chatAccess(state, actorId, task.teamId);
    const [prior] =
      await tx`SELECT entry_id,digest FROM teamtrack_task_file WHERE namespace=${namespace} AND actor_id=${actorId} AND request_id=${input.requestId}`;
    if (prior) {
      if (prior.digest !== digest)
        throw new ChatError(
          "This upload request changed. Send it as a new update.",
          409,
        );
      return { state, entryId: prior.entry_id as string };
    }
    const [{ used }] =
      await tx`SELECT coalesce((SELECT sum(file_size) FROM teamtrack_chat WHERE namespace=${namespace}),0) + coalesce((SELECT sum(file_size) FROM teamtrack_task_file WHERE namespace=${namespace}),0) AS used`;
    attachmentBudget(Number(used), bytes.byteLength);
    let next: State;
    try {
      next = apply(state, actorId, {
        type: kind === "comment" ? "comment.add" : "contribution.add",
        taskId,
        body: input.body || "Shared a file.",
        url,
      });
    } catch (e) {
      throw new ChatError(
        e instanceof Error ? e.message : "Could not post this update",
      );
    }
    const entry = next.entries[0],
      id = randomUUID();
    entry.attachment = { id, name: file.name, bytes: bytes.byteLength };
    await tx`INSERT INTO teamtrack_task_file(id,namespace,task_id,entry_id,actor_id,request_id,digest,file_name,file_size,file_data)
      VALUES(${id},${namespace},${taskId},${entry.id},${actorId},${input.requestId},${digest},${file.name},${bytes.byteLength},${bytes})`;
    await tx`UPDATE teamtrack_state SET data=${tx.json(next)} WHERE id=${namespace}`;
    return { state: next, entryId: entry.id };
  });
}
export async function taskFile(namespace: string, actorId: string, id: string) {
  if (
    !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
      id,
    )
  )
    throw new ChatError("File not found", 404);
  const db = await attachmentDatabase();
  const [file] =
    await db`SELECT task_id,entry_id,file_name FROM teamtrack_task_file WHERE namespace=${namespace} AND id=${id}`;
  if (!file) throw new ChatError("File not found", 404);
  const state = await readState(namespace);
  const task = state.tasks.find((t) => t.id === file.task_id);
  if (
    !task ||
    !state.entries.some(
      (e) => e.id === file.entry_id && e.attachment?.id === id,
    )
  )
    throw new ChatError("File not found", 404);
  chatAccess(state, actorId, task.teamId);
  const [data] =
    await db`SELECT file_data FROM teamtrack_task_file WHERE namespace=${namespace} AND id=${id}`;
  if (!data) throw new ChatError("File not found", 404);
  return { name: file.file_name as string, bytes: data.file_data as Buffer };
}
