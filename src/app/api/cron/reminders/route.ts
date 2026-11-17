import { timingSafeEqual } from "node:crypto";
import {
  notificationTables,
  notificationInbox,
  emailConfigured,
} from "@/lib/notifications";
import { readState } from "@/lib/store";
import { today } from "@/lib/dates";
import { sendMail } from "@/lib/mail";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET,
    header = req.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret || ""}`),
    actual = Buffer.from(header);
  if (
    !secret ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!emailConfigured())
    return Response.json(
      { error: "Email delivery is not configured" },
      { status: 503 },
    );
  const db = await notificationTables(),
    day = today();
  let sent = 0,
    failed = 0;
  const members =
    await db`SELECT p.user_id,p.namespace,u.email FROM teamtrack_notification_preference p JOIN teamtrack_member m ON m.user_id=p.user_id AND m.namespace=p.namespace JOIN teamtrack_user u ON u.id=p.user_id WHERE p.email_enabled=true`;
  for (const m of members) {
    let claimed = false;
    try {
      const s = await readState(m.namespace),
        inbox = await notificationInbox(s, m.user_id, m.namespace);
      if (!inbox.items.length || s.practice) continue;
      const claim =
        await db`INSERT INTO teamtrack_reminder_delivery(user_id,namespace,day) VALUES (${m.user_id},${m.namespace},${day}) ON CONFLICT DO NOTHING RETURNING user_id`;
      if (!claim[0]) continue;
      claimed = true;
      await sendMail({
        to: m.email,
        subject: `TeamTrack: ${inbox.items.length} reminder${inbox.items.length === 1 ? "" : "s"}`,
        text: `${s.course}\n\n${inbox.items.map((i) => `${i.title}: ${i.detail}`).join("\n")}\n\nOpen TeamTrack: ${new URL(process.env.APP_URL!).origin}\n\nTurn off daily emails in Reminders inside this workspace.`,
      });
      sent++;
    } catch {
      failed++;
      if (claimed)
        await db`DELETE FROM teamtrack_reminder_delivery WHERE user_id=${m.user_id} AND namespace=${m.namespace} AND day=${day}`;
    }
  }
  return Response.json({ sent, failed }, { status: failed ? 500 : 200 });
}
