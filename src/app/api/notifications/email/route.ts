import { session, sameOrigin } from "@/lib/auth";
import { readState } from "@/lib/store";
import { visible } from "@/lib/domain";
import { notificationTables, emailConfigured } from "@/lib/notifications";
export async function POST(req: Request) {
  let a;
  try {
    a = await session();
  } catch {
    return Response.json({ error: "Please sign in" }, { status: 401 });
  }
  try {
    sameOrigin(req);
    if (req.headers.get("x-csrf-token") !== a.csrf) throw Error();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 403 });
  }
  try {
    visible(await readState(a.namespace), a.userId);
    if (!a.account)
      return Response.json(
        { error: "Email reminders require your own account" },
        { status: 403 },
      );
    const raw = await req.text();
    if (raw.length > 200) throw Error();
    const b = JSON.parse(raw);
    if (typeof b.enabled !== "boolean") throw Error();
    if (b.enabled && !emailConfigured())
      return Response.json(
        { error: "Email delivery is not configured yet" },
        { status: 503 },
      );
    const db = await notificationTables();
    const members =
      await db`SELECT m.user_id FROM teamtrack_member m JOIN teamtrack_user u ON u.id=m.user_id WHERE m.user_id=${a.userId} AND m.namespace=${a.namespace}`;
    if (!members[0])
      return Response.json(
        { error: "Workspace access denied" },
        { status: 403 },
      );
    await db`INSERT INTO teamtrack_notification_preference(user_id,namespace,email_enabled) VALUES (${a.userId},${a.namespace},${b.enabled}) ON CONFLICT(user_id,namespace) DO UPDATE SET email_enabled=EXCLUDED.email_enabled`;
    return Response.json({ emailEnabled: b.enabled });
  } catch {
    return Response.json(
      { error: "Could not save email preference" },
      { status: 422 },
    );
  }
}
