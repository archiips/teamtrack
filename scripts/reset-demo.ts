import { sql, init } from "../src/lib/store";
import { seed } from "../src/lib/seed";
if (process.argv[2] !== "--synthetic-demo-only")
  throw Error("Pass --synthetic-demo-only to reset the demo namespace.");
if (!sql) throw Error("DATABASE_URL required");
await init();
await sql`UPDATE teamtrack_state SET data=${sql.json(seed())} WHERE id='demo'`;
console.log("Synthetic demo reset; Canvas course namespaces untouched.");
await sql.end();
