import { createHash, randomBytes } from "node:crypto";
import { accountTables, hashPassword } from "./accounts";
import { mailConfigured, sendMail } from "./mail";

export class RecoveryUnavailable extends Error {}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const recoveryMessage =
  "If an account uses that email, a password reset link has been sent. Check your inbox and spam folder.";
let ready: Promise<unknown> | undefined;
async function tables() {
  const db = await accountTables();
  ready ??= (async () => {
    await db`CREATE TABLE IF NOT EXISTS teamtrack_password_reset (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES teamtrack_user(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await db`CREATE TABLE IF NOT EXISTS teamtrack_recovery_limit (key text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL)`;
  })();
  await ready;
  return db;
}
function appUrl() {
  try {
    const url = new URL(process.env.APP_URL || "");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      throw Error();
    return url.origin;
  } catch {
    throw new RecoveryUnavailable(
      "Password recovery is not configured. Contact your workspace administrator.",
    );
  }
}
/** Atomic shared limit; no raw email/IP is persisted. Throttled requests retain the generic response. */
async function allowed(key: string, max: number) {
  const db = await tables();
  const rows =
    await db`INSERT INTO teamtrack_recovery_limit (key,window_start,attempts) VALUES (${key},now(),1)
    ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN teamtrack_recovery_limit.window_start < now()-interval '1 hour' THEN 1 ELSE LEAST(teamtrack_recovery_limit.attempts+1,10000) END,
    window_start=CASE WHEN teamtrack_recovery_limit.window_start < now()-interval '1 hour' THEN now() ELSE teamtrack_recovery_limit.window_start END RETURNING attempts`;
  return rows[0].attempts <= max;
}
export async function requestPasswordRecovery(email: string) {
  const origin = appUrl();
  if (!mailConfigured())
    throw new RecoveryUnavailable(
      "Password recovery email is not configured. Contact your workspace administrator.",
    );
  const address = email.trim().toLowerCase();
  if (address.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    return;
  if (!(await allowed(`email:${digest(address)}`, 3))) return;
  // A global cap bounds requests using an unlimited supply of email addresses.
  if (!(await allowed("delivery:global", 100))) return;
  const db = await tables();
  const [user] = await db`SELECT id FROM teamtrack_user WHERE email=${address}`;
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  await db`INSERT INTO teamtrack_password_reset (token_hash,user_id,expires_at) VALUES (${digest(token)},${user.id},now()+interval '30 minutes')`;
  try {
    await sendMail({
      to: address,
      subject: "Reset your TeamTrack password",
      text: `Use this link to choose a new TeamTrack password:\n\n${origin}/reset-password#token=${token}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.`,
    });
  } catch {
    await db`DELETE FROM teamtrack_password_reset WHERE token_hash=${digest(token)}`;
    // Do not disclose account existence through provider failure responses.
  }
}
export async function resetPassword(token: string, password: string) {
  if (password.length < 8 || password.length > 200)
    throw Error("Use a password of at least 8 characters");
  if (!/^[a-f0-9]{64}$/.test(token))
    throw Error("This reset link is invalid or expired. Request a new link.");
  const db = await tables();
  const passwordHash = hashPassword(password);
  const changed = await db.begin(async (tx) => {
    const [record] =
      await tx`SELECT user_id FROM teamtrack_password_reset WHERE token_hash=${digest(token)} AND expires_at>now()`;
    if (!record) return false;
    // Serialize all tokens for the same identity, then consume every outstanding link.
    const [user] =
      await tx`SELECT id FROM teamtrack_user WHERE id=${record.user_id} FOR UPDATE`;
    if (!user) return false;
    const [stillValid] =
      await tx`DELETE FROM teamtrack_password_reset WHERE token_hash=${digest(token)} AND expires_at>now() RETURNING user_id`;
    if (!stillValid) return false;
    await tx`UPDATE teamtrack_user SET password_hash=${passwordHash}, auth_version=auth_version+1 WHERE id=${user.id}`;
    await tx`DELETE FROM teamtrack_password_reset WHERE user_id=${user.id}`;
    return true;
  });
  if (!changed)
    throw Error("This reset link is invalid or expired. Request a new link.");
}
