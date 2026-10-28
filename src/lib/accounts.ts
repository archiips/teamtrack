import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql, init } from "./store";
import { seed } from "./seed";

// Synthetic demo accounts: every seed user with an email signs in with the shared demo password.
function demoPassword() {
  const p = process.env.DEMO_PASSWORD;
  if (!p && process.env.VERCEL) throw Error("Demo password missing");
  return p || "teamtrack474";
}
function hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 32).toString("hex");
}
function matches(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

let ready: Promise<unknown> | undefined;
async function accounts() {
  if (!sql) return;
  await init();
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_account (email text PRIMARY KEY, user_id text NOT NULL, namespace text NOT NULL, password_hash text NOT NULL)`;
    for (const u of seed().users)
      if (u.email)
        await sql`INSERT INTO teamtrack_account VALUES (${u.email},${u.id},'demo',${hash(demoPassword())}) ON CONFLICT DO NOTHING`;
  })();
  await ready;
}

/** Returns the account for these credentials, or null. */
export async function verifyLogin(email: string, password: string) {
  const address = email.trim().toLowerCase();
  if (!address || !password || password.length > 200) return null;
  if (sql) {
    await accounts();
    const rows =
      await sql`SELECT user_id,namespace,password_hash FROM teamtrack_account WHERE email=${address}`;
    if (!rows[0] || !matches(password, rows[0].password_hash)) return null;
    return {
      userId: rows[0].user_id as string,
      namespace: rows[0].namespace as string,
    };
  }
  if (process.env.VERCEL) throw Error("Database is not configured");
  const user = seed().users.find((u) => u.email === address);
  return user && password === demoPassword()
    ? { userId: user.id, namespace: "demo" }
    : null;
}
