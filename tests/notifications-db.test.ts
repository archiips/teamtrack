import { afterAll, describe, expect, it } from "vitest";
import { seed } from "../src/lib/seed";
import { sql } from "../src/lib/store";
import {
  notificationInbox,
  markReminder,
  notificationTables,
} from "../src/lib/notifications";
if (
  !/^postgres:\/\/tt@127\.0\.0\.1:54349\/teamtrack$/.test(
    process.env.DATABASE_URL || "",
  )
)
  throw Error("Use isolated local notification test database");
const ns = `notification_test_${Date.now()}`;
afterAll(async () => {
  if (sql) {
    await sql`DELETE FROM teamtrack_notification WHERE namespace=${ns}`;
    await sql`DELETE FROM teamtrack_notification_preference WHERE namespace=${ns}`;
    await sql.end();
  }
});
describe("durable isolated inbox", () => {
  it("persists read and dismissed keys per person and workspace, and removes resolved reminders", async () => {
    const s = seed();
    s.teams[0].accepted = [];
    const first = await notificationInbox(s, "s1", ns),
      item = first.items.find((x) => x.target === "agreement")!;
    expect(item.read).toBe(false);
    await markReminder("s1", ns, item.id, false);
    expect(
      (await notificationInbox(s, "s1", ns)).items.find((x) => x.id === item.id)
        ?.read,
    ).toBe(true);
    expect(
      (await notificationInbox(s, "s2", ns)).items.find((x) => x.id === item.id)
        ?.read,
    ).toBe(false);
    expect(
      (await notificationInbox(s, "s1", ns + "_other")).items.find(
        (x) => x.id === item.id,
      )?.read,
    ).toBe(false);
    await markReminder("s1", ns, item.id, true);
    expect(
      (await notificationInbox(s, "s1", ns)).items.some(
        (x) => x.id === item.id,
      ),
    ).toBe(false);
    s.teams[0].agreementVersion++;
    expect(
      (await notificationInbox(s, "s1", ns)).items.find(
        (x) => x.target === "agreement",
      )?.read,
    ).toBe(false);
    s.teams[0].accepted.push("s1");
    expect(
      (await notificationInbox(s, "s1", ns)).items.some(
        (x) => x.target === "agreement",
      ),
    ).toBe(false);
  });
  it("defaults email off and isolates its stored preference", async () => {
    const db = await notificationTables();
    expect((await notificationInbox(seed(), "s1", ns)).emailEnabled).toBe(
      false,
    );
    await db`INSERT INTO teamtrack_notification_preference(user_id,namespace,email_enabled) VALUES ('s1',${ns},true)`;
    expect((await notificationInbox(seed(), "s1", ns)).emailEnabled).toBe(true);
    expect((await notificationInbox(seed(), "s2", ns)).emailEnabled).toBe(
      false,
    );
  });
});
