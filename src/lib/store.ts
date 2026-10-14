import postgres from "postgres";
import { seed } from "./seed";
import { apply } from "./domain";
import { State, Command } from "./types";
import { readFile, writeFile, mkdir } from "node:fs/promises";
export const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 3,
      prepare: false,
    })
  : null;
let ready: Promise<unknown> | undefined;
let queue = Promise.resolve();
export async function init() {
  if (sql) {
    ready ??= sql`CREATE TABLE IF NOT EXISTS teamtrack_state (id text PRIMARY KEY, data jsonb NOT NULL)`;
    await ready;
    await sql`INSERT INTO teamtrack_state (id,data) VALUES ('demo',${sql.json(seed())}) ON CONFLICT DO NOTHING`;
  }
}
export async function readState(namespace = "demo"): Promise<State> {
  if (sql) {
    await init();
    const rows =
      await sql`SELECT data FROM teamtrack_state WHERE id=${namespace}`;
    if (!rows[0]) throw Error("Course workspace not initialized");
    return rows[0].data as State;
  }
  if (process.env.VERCEL) throw Error("Database is not configured");
  try {
    return JSON.parse(await readFile(".local/state.json", "utf8"));
  } catch {
    await mkdir(".local", { recursive: true });
    const s = seed();
    await writeFile(".local/state.json", JSON.stringify(s));
    return s;
  }
}
export async function mutate(
  actorId: string,
  c: Command,
  namespace = "demo",
): Promise<State> {
  if (sql) {
    await init();
    return sql.begin(async (tx) => {
      const rows =
        await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
      const s = apply(rows[0].data as State, actorId, c);
      await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
      return s;
    }) as Promise<State>;
  }
  let result!: State;
  const operation = queue.then(async () => {
    result = apply(await readState(), actorId, c);
    await writeFile(".local/state.json", JSON.stringify(result));
  });
  queue = operation.catch(() => {});
  await operation;
  return result;
}
