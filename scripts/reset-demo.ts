import { sql, init } from "../src/lib/store";
import { seed } from "../src/lib/seed";
if (process.argv[2] !== "--synthetic-demo-only")
  throw Error("Pass --synthetic-demo-only to reset the demo namespace.");
if (!sql) throw Error("DATABASE_URL required");
await init();
await sql`UPDATE teamtrack_state SET data=${sql.json(seed())} WHERE id='demo'`;
// Demo accounts re-create on next sign-in with the current DEMO_PASSWORD; the demo LMS
// reconnects the roster on the professor's next launch.
await sql`DELETE FROM teamtrack_account WHERE namespace='demo'`.catch(() => {});
await sql`DELETE FROM teamtrack_course WHERE namespace='demo'`.catch(() => {});
console.log("Synthetic demo reset; Canvas course namespaces untouched.");
await sql.end();
