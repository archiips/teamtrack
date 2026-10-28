import { sql } from "../src/lib/store";
import { State } from "../src/lib/types";
if (!sql) throw Error("DATABASE_URL required");
await sql.begin(async (tx) => {
  const rows =
    await tx`SELECT data FROM teamtrack_state WHERE id='demo' FOR UPDATE`;
  const s = rows[0].data as State;
  const qa = s.entries.filter((e) =>
    e.body.startsWith("Automated integration check "),
  );
  // Each test entry also logged an event with the same actor and timestamp.
  const stamps = new Set(qa.map((e) => `${e.actorId}|${e.at}`));
  const before = s.events.length;
  s.entries = s.entries.filter((e) => !qa.includes(e));
  s.events = s.events.filter(
    (e) =>
      !(
        stamps.has(`${e.actorId}|${e.at}`) &&
        e.body.startsWith("Added evidence to ")
      ),
  );
  console.log(
    `Removing ${qa.length} test updates and ${before - s.events.length} matching events.`,
  );
  await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id='demo'`;
});
console.log("Removed only automated synthetic test updates.");
await sql.end();
