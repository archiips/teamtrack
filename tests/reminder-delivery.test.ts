import { afterAll, beforeAll, expect, it, vi } from "vitest";
const enabled =
  process.env.DATABASE_URL === "postgres://tt@127.0.0.1:54349/teamtrack";
let sql: (typeof import("../src/lib/store"))["sql"];
let userId = "";
const namespace = "reminder-test-" + Date.now();
let sendCount = 0;
beforeAll(async () => {
  if (!enabled) return;
  process.env.CRON_SECRET = "test-reminder-cron";
  process.env.APP_URL = "http://localhost:3100";
  process.env.BREVO_API_KEY = "test-never-send";
  process.env.EMAIL_FROM = "test@example.edu";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      sendCount++;
      return new Response("{}", { status: 201 });
    }),
  );
  const { createAccount } = await import("../src/lib/accounts");
  userId = await createAccount(
    "Email Reminder",
    "reminder-" + Date.now() + "@example.edu",
    "local password 123",
  );
  ({ sql } = await import("../src/lib/store"));
  const { blankState, person } = await import("../src/lib/domain");
  const s = blankState(
    { course: "Class", project: "Team", description: "", due: "2030-01-01" },
    person(userId, "Email Reminder", "test@example.edu", "student"),
    "TESTCODE",
  );
  await sql!`INSERT INTO teamtrack_state(id,data) VALUES(${namespace},${sql!.json(s)})`;
  await sql!`INSERT INTO teamtrack_member(user_id,namespace) VALUES(${userId},${namespace})`;
  const { notificationTables } = await import("../src/lib/notifications");
  await notificationTables();
  await sql!`INSERT INTO teamtrack_notification_preference(user_id,namespace,email_enabled) VALUES(${userId},${namespace},true)`;
});
afterAll(async () => {
  vi.unstubAllGlobals();
  if (sql) {
    await sql`DELETE FROM teamtrack_notification_preference WHERE namespace=${namespace}`;
    await sql`DELETE FROM teamtrack_reminder_delivery WHERE namespace=${namespace}`;
    await sql`DELETE FROM teamtrack_member WHERE namespace=${namespace}`;
    await sql`DELETE FROM teamtrack_state WHERE id=${namespace}`;
    await sql`DELETE FROM teamtrack_user WHERE id=${userId}`;
    await sql.end();
  }
});
it.skipIf(!enabled)(
  "sends an opted-in daily digest once and does not resend on a repeated cron run",
  async () => {
    const { GET } = await import("../src/app/api/cron/reminders/route");
    const req = () =>
      new Request("http://localhost:3100/api/cron/reminders", {
        headers: { authorization: "Bearer test-reminder-cron" },
      });
    expect((await GET(req())).status).toBe(200);
    expect(sendCount).toBe(1);
    expect((await GET(req())).status).toBe(200);
    expect(sendCount).toBe(1);
  },
);
