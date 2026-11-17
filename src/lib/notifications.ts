import { createHash } from "node:crypto";
import { mailConfigured } from "./mail";
import { accountTables } from "./accounts";
import { visible } from "./domain";
import { today } from "./dates";
import type { State } from "./types";
export type Reminder = {
  id: string;
  title: string;
  detail: string;
  teamId: string;
  taskId?: string;
  target: "agreement" | "tasks";
  read?: boolean;
};
export function reminders(
  state: State,
  userId: string,
  day = today(),
): Reminder[] {
  const s = visible(state, userId),
    me = s.users.find((u) => u.id === userId)!;
  const result: Reminder[] = [];
  const digest = (v: string) =>
    createHash("sha256").update(v).digest("hex").slice(0, 24);
  for (const t of s.teams) {
    if (!t.memberIds.includes(userId)) continue;
    if (t.agreement.trim() && !t.accepted.includes(userId))
      result.push({
        id: `agreement:${t.id}:${t.agreementVersion}`,
        title: "Accept your team agreement",
        detail: t.name,
        teamId: t.id,
        target: "agreement",
      });
    if (t.proposal && !t.proposal.approvals.includes(userId))
      result.push({
        id: `proposal:${t.id}:${digest(t.proposal.at + t.proposal.body)}`,
        title: "Review an agreement proposal",
        detail: t.name,
        teamId: t.id,
        target: "agreement",
      });
  }
  for (const t of s.tasks) {
    if (t.status === "done") continue;
    if (
      t.ownerId === userId &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.due) &&
      t.due <= day
    )
      result.push({
        id: `due:${t.id}:${t.due}`,
        title: t.due < day ? "Task overdue" : "Task due today",
        detail: t.title,
        teamId: t.teamId,
        taskId: t.id,
        target: "tasks",
      });
    if (me.role === "instructor" && t.blocker.trim())
      result.push({
        id: `blocked:${t.id}:${digest(t.blocker)}`,
        title: "A team needs help",
        detail: `${t.title}: ${t.blocker}`,
        teamId: t.teamId,
        taskId: t.id,
        target: "tasks",
      });
  }
  return result;
}
let ready: Promise<unknown> | undefined;
export async function notificationTables() {
  const db = await accountTables();
  ready ??= (async () => {
    await db`CREATE TABLE IF NOT EXISTS teamtrack_notification (user_id text NOT NULL, namespace text NOT NULL, reminder_id text NOT NULL, dismissed boolean NOT NULL DEFAULT false, PRIMARY KEY(user_id,namespace,reminder_id))`;
    await db`CREATE TABLE IF NOT EXISTS teamtrack_notification_preference (user_id text NOT NULL, namespace text NOT NULL, email_enabled boolean NOT NULL DEFAULT false, PRIMARY KEY(user_id,namespace))`;
    await db`CREATE TABLE IF NOT EXISTS teamtrack_reminder_delivery (user_id text NOT NULL, namespace text NOT NULL, day text NOT NULL, PRIMARY KEY(user_id,namespace,day))`;
  })();
  await ready;
  return db;
}
export const emailConfigured = () =>
  !!(mailConfigured() && process.env.APP_URL && process.env.CRON_SECRET);
export async function notificationInbox(
  state: State,
  userId: string,
  namespace: string,
) {
  const items = reminders(state, userId);
  const db = await notificationTables();
  const rows =
    await db`SELECT reminder_id,dismissed FROM teamtrack_notification WHERE user_id=${userId} AND namespace=${namespace}`;
  const preferences =
    await db`SELECT email_enabled FROM teamtrack_notification_preference WHERE user_id=${userId} AND namespace=${namespace}`;
  const own = await db`SELECT id FROM teamtrack_user WHERE id=${userId}`;
  return {
    items: items
      .filter((i) => !rows.some((r) => r.reminder_id === i.id && r.dismissed))
      .map((i) => ({ ...i, read: rows.some((r) => r.reminder_id === i.id) })),
    emailEnabled: preferences[0]?.email_enabled === true,
    emailAvailable: !!own[0] && emailConfigured(),
    persistence: true,
  };
}
export async function markReminder(
  userId: string,
  namespace: string,
  id: string,
  dismissed: boolean,
) {
  const db = await notificationTables();
  await db`INSERT INTO teamtrack_notification(user_id,namespace,reminder_id,dismissed) VALUES (${userId},${namespace},${id},${dismissed}) ON CONFLICT(user_id,namespace,reminder_id) DO UPDATE SET dismissed=EXCLUDED.dismissed`;
}
