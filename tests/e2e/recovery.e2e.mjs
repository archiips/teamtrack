import { chromium } from "playwright";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomBytes, createHash } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (
  !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) ||
  process.env.DATABASE_URL !== "postgres://tt@127.0.0.1:54349/teamtrack"
)
  throw Error("Isolated local DB/app only");
const sql = postgres(process.env.DATABASE_URL),
  browser = await chromium.launch({ channel: "chrome" }),
  page = await browser.newPage();
const email = `reset-browser-${Date.now()}@example.edu`;
try {
  await page.goto(base);
  const r = await page.request.post(base + "/api/auth/signup", {
    headers: { Origin: base },
    data: { name: "Recovery Browser", email, password: "old password 123" },
  });
  assert.equal(r.status(), 200);
  const [u] = await sql`SELECT id FROM teamtrack_user WHERE email=${email}`;
  const token = randomBytes(32).toString("hex");
  await sql`INSERT INTO teamtrack_password_reset(token_hash,user_id,expires_at) VALUES(${createHash("sha256").update(token).digest("hex")},${u.id},now()+interval '30 minutes')`;
  await page.goto(base + "/reset-password#token=" + token);
  await page
    .getByLabel("New password", { exact: true })
    .fill("new password 456");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("new password 456");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your password has been reset" })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await page.screenshot({
    path: "/tmp/teamtrack-feedback/screens/password-reset.png",
  });
  const login = await page.request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: { email, password: "new password 456" },
  });
  assert.equal(login.status(), 200);
  console.log("PASS browser reset, URL fragment removal, new password login");
  await sql`DELETE FROM teamtrack_user WHERE id=${u.id}`;
} finally {
  await browser.close();
  await sql.end();
}
