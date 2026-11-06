import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { sql, init } from "./store";
import { seed } from "./seed";

// Synthetic demo accounts: every seed user with an email signs in with the shared demo password.
function demoPassword() {
  const p = process.env.DEMO_PASSWORD;
  if (!p && process.env.VERCEL) throw Error("Demo password missing");
  return p || "teamtrack474";
}
const demoEnabled = () => process.env.DEMO_MODE !== "false";
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
/** Creates the account tables once per instance. */
export async function accountTables() {
  if (!sql) throw Error("Accounts need a database (set DATABASE_URL)");
  await init();
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_account (email text PRIMARY KEY, user_id text NOT NULL, namespace text NOT NULL, password_hash text NOT NULL)`;
    // Own accounts: one person, any number of workspaces.
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_user (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_member (user_id text NOT NULL, namespace text NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, namespace))`;
    await sql`CREATE TABLE IF NOT EXISTS teamtrack_invite (code text PRIMARY KEY, namespace text UNIQUE NOT NULL)`;
  })();
  await ready;
  return sql;
}
async function demoAccount(email: string) {
  const db = await accountTables();
  const find = () =>
    db`SELECT user_id,namespace,password_hash FROM teamtrack_account WHERE email=${email}`;
  let rows = await find();
  // Demo accounts are created on first use, so they come back after demo:reset clears them.
  const demo = seed().users.find((u) => u.email === email);
  if (!rows[0] && demo) {
    await db`INSERT INTO teamtrack_account VALUES (${email},${demo.id},'demo',${hash(demoPassword())}) ON CONFLICT DO NOTHING`;
    rows = await find();
  }
  return rows[0];
}
const isDemoEmail = (email: string) =>
  seed().users.some((u) => u.email === email) ||
  email.endsWith("@teamtrack.test");

export type Login = { userId: string; namespace: string; account: boolean };

/**
 * The workspace a signed-in person lands in: their most recently joined real one
 * (practice only when it's all they have), or none.
 */
export async function lastWorkspace(userId: string) {
  const db = await accountTables();
  const rows = await db`
    SELECT m.namespace FROM teamtrack_member m JOIN teamtrack_state s ON s.id = m.namespace
    WHERE m.user_id=${userId}
    ORDER BY (s.data->>'practice') = 'true' NULLS FIRST, m.joined_at DESC LIMIT 1`;
  return (rows[0]?.namespace as string) || "";
}

/** Returns the account for these credentials, or null. */
export async function verifyLogin(
  email: string,
  password: string,
): Promise<Login | null> {
  const address = email.trim().toLowerCase();
  if (!address || !password || password.length > 200) return null;
  if (sql) {
    const db = await accountTables();
    const own =
      await db`SELECT id,password_hash FROM teamtrack_user WHERE email=${address}`;
    if (own[0])
      return matches(password, own[0].password_hash)
        ? {
            userId: own[0].id,
            namespace: await lastWorkspace(own[0].id),
            account: true,
          }
        : null;
    if (!demoEnabled()) return null;
    const row = await demoAccount(address);
    if (!row || !matches(password, row.password_hash)) return null;
    return {
      userId: row.user_id as string,
      namespace: row.namespace as string,
      account: false,
    };
  }
  if (process.env.VERCEL) throw Error("Database is not configured");
  const user = seed().users.find((u) => u.email === address);
  return user && password === demoPassword()
    ? { userId: user.id, namespace: "demo", account: false }
    : null;
}

/** Creates an own account. Throws a message fit to show the person. */
export async function createAccount(
  name: string,
  email: string,
  password: string,
) {
  const n = name.trim().replace(/\s+/g, " "),
    address = email.trim().toLowerCase();
  if (n.length < 2 || n.length > 80) throw Error("Enter your full name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 200)
    throw Error("Enter a valid email address");
  if (password.length < 8 || password.length > 200)
    throw Error("Use a password of at least 8 characters");
  if (isDemoEmail(address))
    throw Error("That address belongs to the class demo. Use your own email.");
  const db = await accountTables();
  const id = "u_" + randomUUID().replaceAll("-", "").slice(0, 16);
  const rows =
    await db`INSERT INTO teamtrack_user (id,email,name,password_hash) VALUES (${id},${address},${n},${hash(password)}) ON CONFLICT (email) DO NOTHING RETURNING id`;
  if (!rows[0])
    throw Error("An account with this email already exists. Sign in instead.");
  return id;
}

export async function accountById(userId: string) {
  const db = await accountTables();
  const rows =
    await db`SELECT id,email,name FROM teamtrack_user WHERE id=${userId}`;
  return rows[0] as { id: string; email: string; name: string } | undefined;
}

/** Changes an own account's password after checking the current one. */
export async function changePassword(
  userId: string,
  current: string,
  next: string,
) {
  if (next.length < 8 || next.length > 200)
    throw Error("Use a password of at least 8 characters");
  const db = await accountTables();
  const rows =
    await db`SELECT password_hash FROM teamtrack_user WHERE id=${userId}`;
  if (!rows[0] || !matches(current, rows[0].password_hash))
    throw Error("Your current password is not right");
  await db`UPDATE teamtrack_user SET password_hash=${hash(next)} WHERE id=${userId}`;
}

/** Operator reset (scripts/reset-password.ts). Returns false when no account uses the email. */
export async function setPassword(email: string, password: string) {
  const db = await accountTables();
  const rows =
    await db`UPDATE teamtrack_user SET password_hash=${hash(password)} WHERE email=${email.trim().toLowerCase()} RETURNING id`;
  return rows.length > 0;
}
