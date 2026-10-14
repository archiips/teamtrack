import { sql } from "../src/lib/store";
import { State } from "../src/lib/types";
if (!sql) throw Error("DATABASE_URL required");
await sql.begin(async (tx) => {
  const rows =
    await tx`SELECT data FROM teamtrack_state WHERE id='demo' FOR UPDATE`;
  const s = rows[0].data as State;
  s.entries = s.entries.filter(
    (e) => !e.body.startsWith("Automated integration check "),
  );
  await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id='demo'`;
});
console.log("Removed only automated synthetic test updates.");
await sql.end();
