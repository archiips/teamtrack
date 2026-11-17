import { session, sameOrigin } from "@/lib/auth";
import { readState, sql } from "@/lib/store";
import {
  reminders,
  notificationInbox,
  markReminder,
} from "@/lib/notifications";
export const dynamic = "force-dynamic";
export async function GET() {
  let a;
  try {
    a = await session();
  } catch {
    return Response.json({ error: "Please sign in" }, { status: 401 });
  }
  try {
    const s = await readState(a.namespace);
    const items = reminders(s, a.userId);
    return Response.json(
      sql
        ? await notificationInbox(s, a.userId, a.namespace)
        : {
            items,
            emailEnabled: false,
            emailAvailable: false,
            persistence: false,
          },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Reminders unavailable" }, { status: 403 });
  }
}
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
    const raw = await req.text();
    if (raw.length > 2000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    const b = JSON.parse(raw),
      s = await readState(a.namespace);
    if (
      !["read", "dismiss"].includes(b.action) ||
      !reminders(s, a.userId).some((i) => i.id === b.id)
    )
      return Response.json({ error: "Reminder not found" }, { status: 404 });
    await markReminder(a.userId, a.namespace, b.id, b.action === "dismiss");
    return Response.json(await notificationInbox(s, a.userId, a.namespace), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Could not save reminder" }, { status: 422 });
  }
}
