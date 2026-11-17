import { createHash } from "node:crypto";
import { sql, readState, init } from "./store";
import {
  attachmentBudget,
  ChatError,
  chatAccess,
  chatInput,
} from "./chat-policy";
import type { ChatMessage, ChatPage } from "./chat-types";
import type { State } from "./types";
let ready: Promise<unknown> | undefined;
export async function attachmentDatabase() {
  if (!sql)
    throw new ChatError(
      "Chat needs a database. Set DATABASE_URL to use team chat locally.",
      503,
    );
  await init();
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_chat (
      id bigserial PRIMARY KEY, namespace text NOT NULL REFERENCES teamtrack_state(id) ON DELETE CASCADE, team_id text NOT NULL,
      actor_id text NOT NULL, author jsonb NOT NULL, body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL,
      file_name text, file_size integer NOT NULL DEFAULT 0, file_data bytea,
      digest text NOT NULL, UNIQUE(namespace,actor_id,request_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS teamtrack_chat_team_idx ON teamtrack_chat(namespace,team_id,id)`;
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_task_file (
      id uuid PRIMARY KEY, namespace text NOT NULL REFERENCES teamtrack_state(id) ON DELETE CASCADE,
      task_id text NOT NULL, entry_id text NOT NULL, actor_id text NOT NULL,
      request_id uuid NOT NULL, digest text NOT NULL, file_name text NOT NULL,
      file_size integer NOT NULL, file_data bytea NOT NULL,
      UNIQUE(namespace,actor_id,request_id), UNIQUE(namespace,entry_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS teamtrack_task_file_workspace_idx ON teamtrack_task_file(namespace,task_id)`;
  })();
  await ready;
  return sql;
}
type Row = {
  id: string;
  team_id: string;
  actor_id: string;
  author: {
    name: string;
    initials: string;
    color: string;
    role: "student" | "instructor";
  };
  body: string;
  created_at: Date;
  file_name: string | null;
  file_size: number;
};
function message(row: Row): ChatMessage {
  return {
    id: String(row.id),
    teamId: row.team_id,
    actorId: row.actor_id,
    ...row.author,
    body: row.body,
    at: new Date(row.created_at).toISOString(),
    ...(row.file_name
      ? { attachment: { name: row.file_name, bytes: row.file_size } }
      : {}),
  };
}
export async function chatHistory(
  namespace: string,
  actorId: string,
  teamId: string,
  before: string | null,
  after: string | null,
): Promise<ChatPage> {
  chatAccess(await readState(namespace), actorId, teamId);
  const db = await attachmentDatabase();
  // Deliberately omit file_data: listing chat never reads/transmits file bytes.
  const columns = db`id,team_id,actor_id,author,body,created_at,file_name,file_size`;
  const rows = after
    ? await db<
        Row[]
      >`SELECT ${columns} FROM teamtrack_chat WHERE namespace=${namespace} AND team_id=${teamId} AND id>${after} ORDER BY id ASC LIMIT 51`
    : before
      ? await db<
          Row[]
        >`SELECT ${columns} FROM teamtrack_chat WHERE namespace=${namespace} AND team_id=${teamId} AND id<${before} ORDER BY id DESC LIMIT 51`
      : await db<
          Row[]
        >`SELECT ${columns} FROM teamtrack_chat WHERE namespace=${namespace} AND team_id=${teamId} ORDER BY id DESC LIMIT 51`;
  const page = rows.slice(0, 50);
  if (!after) page.reverse();
  return { messages: page.map(message), hasMore: rows.length > 50 };
}
export async function saveChat(
  namespace: string,
  actorId: string,
  input: ReturnType<typeof chatInput>,
) {
  const db = await attachmentDatabase();
  const bytes = input.file
    ? Buffer.from(await input.file.source.arrayBuffer())
    : null;
  const digest = createHash("sha256")
    .update(JSON.stringify([input.teamId, input.body, input.file?.name || ""]))
    .update(bytes || "")
    .digest("hex");
  return db.begin(async (tx) => {
    // Membership and attachment budget are checked under the same workspace lock as team edits.
    const states =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    if (!states[0]) throw new ChatError("Access denied", 403);
    const actor = chatAccess(states[0].data as State, actorId, input.teamId);
    if (actor.monitor)
      throw new ChatError("Monitoring access is read-only", 403);
    const prior = await tx<
      (Row & { digest: string })[]
    >`SELECT id,team_id,actor_id,author,body,created_at,file_name,file_size,digest FROM teamtrack_chat WHERE namespace=${namespace} AND actor_id=${actorId} AND request_id=${input.requestId}`;
    if (prior[0]) {
      if (prior[0].digest !== digest)
        throw new ChatError(
          "This message request changed. Send it as a new message.",
          409,
        );
      return message(prior[0]);
    }
    if (bytes) {
      const [{ used }] =
        await tx`SELECT coalesce((SELECT sum(file_size) FROM teamtrack_chat WHERE namespace=${namespace}),0) + coalesce((SELECT sum(file_size) FROM teamtrack_task_file WHERE namespace=${namespace}),0) AS used`;
      attachmentBudget(Number(used), bytes.byteLength);
    }
    const author = {
      name: actor.name,
      initials: actor.initials,
      color: actor.color,
      role: actor.role,
    };
    const rows = await tx<
      Row[]
    >`INSERT INTO teamtrack_chat(namespace,team_id,actor_id,author,body,request_id,file_name,file_size,file_data,digest)
      VALUES(${namespace},${input.teamId},${actorId},${tx.json(author)},${input.body},${input.requestId},${input.file?.name || null},${bytes?.byteLength || 0},${bytes},${digest})
      RETURNING id,team_id,actor_id,author,body,created_at,file_name,file_size`;
    return message(rows[0]);
  });
}
export async function chatFile(namespace: string, actorId: string, id: string) {
  const db = await attachmentDatabase();
  const rows =
    await db`SELECT team_id,file_name FROM teamtrack_chat WHERE namespace=${namespace} AND id=${id} AND file_name IS NOT NULL`;
  if (!rows[0]) throw new ChatError("File not found", 404);
  chatAccess(await readState(namespace), actorId, rows[0].team_id);
  const [file] =
    await db`SELECT file_name,file_data FROM teamtrack_chat WHERE namespace=${namespace} AND id=${id}`;
  return { name: file.file_name as string, bytes: file.file_data as Buffer };
}
