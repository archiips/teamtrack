// There is no email service, so a forgotten password is reset by hand: this sets a
// one-time password and prints it once. Share it privately; they change it after signing in.
// Run: node --env-file=.env.local --import tsx scripts/reset-password.ts person@school.edu
import { randomBytes } from "node:crypto";
import { sql } from "../src/lib/store";
import { setPassword } from "../src/lib/accounts";
const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) throw Error("Pass the account's email address.");
if (!sql) throw Error("DATABASE_URL required");
const temporary = randomBytes(9).toString("base64url");
if (!(await setPassword(email, temporary)))
  console.log(`No account uses ${email}.`);
else
  console.log(
    `Temporary password for ${email}: ${temporary}\nAsk them to change it from the avatar menu after signing in.`,
  );
await sql.end();
