import { randomBytes, createHash, randomUUID } from "node:crypto";
import { accountTables, accountById } from "./accounts";
import { visible, person, isGroup } from "./domain";
import type { State } from "./types";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
export type ClassSummary = { id: string; name: string };
let ready: Promise<unknown> | undefined;
async function tables() {
  const db = await accountTables();
  ready ??= (async () => {
    await db`CREATE TABLE IF NOT EXISTS teamtrack_class (id text PRIMARY KEY, owner_id text NOT NULL, name text NOT NULL)`;
    await db`CREATE TABLE IF NOT EXISTS teamtrack_class_workspace (class_id text NOT NULL, namespace text NOT NULL, PRIMARY KEY(class_id,namespace))`;
    await db`CREATE TABLE IF NOT EXISTS teamtrack_monitor_invite (token_hash text PRIMARY KEY, namespace text NOT NULL, expires_at timestamptz NOT NULL)`;
  })();
  await ready;
  return db;
}
export async function listClasses(userId: string): Promise<ClassSummary[]> {
  const db = await tables();
  return (await db`SELECT id,name FROM teamtrack_class WHERE owner_id=${userId} ORDER BY name`) as unknown as ClassSummary[];
}
export async function createClass(userId: string, name: unknown) {
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw Error("Enter a class name");
  const db = await tables();
  const id = "c_" + randomUUID();
  await db`INSERT INTO teamtrack_class VALUES(${id},${userId},${name.trim()})`;
  return id;
}
export async function requireClassOwner(userId: string, id: string) {
  const db = await tables();
  const rows =
    await db`SELECT 1 FROM teamtrack_class WHERE id=${id} AND owner_id=${userId}`;
  if (!rows.length) throw Error("Class access denied");
}
export async function attachClass(
  userId: string,
  classId: string,
  namespace: string,
) {
  await requireClassOwner(userId, classId);
  const db = await tables();
  await db.begin(async (tx) => {
    const rows =
      await tx`SELECT s.data FROM teamtrack_member m JOIN teamtrack_state s ON s.id=m.namespace WHERE m.user_id=${userId} AND m.namespace=${namespace}`;
    const s = rows[0]?.data as State | undefined;
    if (
      !s ||
      !visible(s, userId).users.some(
        (u) => u.id === userId && u.role === "instructor",
      )
    )
      throw Error("Instructor access required");
    await tx`DELETE FROM teamtrack_class_workspace WHERE namespace=${namespace} AND class_id IN (SELECT id FROM teamtrack_class WHERE owner_id=${userId})`;
    await tx`INSERT INTO teamtrack_class_workspace VALUES(${classId},${namespace}) ON CONFLICT DO NOTHING`;
  });
}
export async function classMapping(
  userId: string,
): Promise<Record<string, string>> {
  const db = await tables();
  const rows =
    await db`SELECT cw.namespace,cw.class_id FROM teamtrack_class_workspace cw JOIN teamtrack_class c ON c.id=cw.class_id WHERE c.owner_id=${userId}`;
  return Object.fromEntries(rows.map((r) => [r.namespace, r.class_id]));
}
export async function monitorInvite(userId: string, namespace: string) {
  const db = await tables();
  const token = randomBytes(32).toString("hex");
  await db.begin(async (tx) => {
    const rows =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = rows[0]?.data as State | undefined;
    const me = s?.users.find((u) => u.id === userId && u.active !== false);
    const groupMember =
      s && isGroup(s) && s.teams.some((t) => t.memberIds.includes(userId));
    if (
      !s ||
      !me ||
      me.monitor ||
      !(me.owner || me.role === "instructor" || groupMember)
    )
      throw Error(
        "Only the workspace organizer or a group member can invite a professor",
      );
    if (s.practice) throw Error("Private practice workspaces cannot be shared");
    // Replace invalidates unused links. An invite expires after seven days and is single use.
    await tx`DELETE FROM teamtrack_monitor_invite WHERE namespace=${namespace}`;
    await tx`INSERT INTO teamtrack_monitor_invite VALUES(${digest(token)},${namespace},now()+interval '7 days')`;
  });
  return token;
}
export async function joinMonitor(
  userId: string,
  token: string,
  placement?: { classId?: string; className?: string },
) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error("Invalid professor invite");
  const me = await accountById(userId);
  if (!me) throw Error("Please sign in");
  const db = await tables();
  return await db.begin(async (tx) => {
    let classId = placement?.classId || "";
    if (classId) {
      const owned =
        await tx`SELECT 1 FROM teamtrack_class WHERE id=${classId} AND owner_id=${userId}`;
      if (!owned.length) throw Error("Class access denied");
    } else if (placement?.className) {
      const name = placement.className.trim();
      if (!name || name.length > 120) throw Error("Enter a class name");
      classId = "c_" + randomUUID();
      await tx`INSERT INTO teamtrack_class(id,owner_id,name) VALUES(${classId},${userId},${name})`;
    }
    const inv =
      await tx`DELETE FROM teamtrack_monitor_invite WHERE token_hash=${digest(token)} AND expires_at>now() RETURNING namespace`;
    if (!inv.length) throw Error("Professor invite expired or already used");
    const namespace = String(inv[0].namespace);
    const rows =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = rows[0].data as State;
    const existing = s.users.find((u) => u.id === userId);
    if (existing && !(existing.monitor && existing.active === false))
      throw Error(
        "You already belong to this workspace; your current role is unchanged",
      );
    s.workspaceKind ??= isGroup(s) ? "group" : "class";
    if (existing) existing.active = true;
    else
      s.users.push({
        ...person(me.id, me.name, me.email, "instructor"),
        monitor: true,
      });
    s.version++;
    await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
    await tx`INSERT INTO teamtrack_member(user_id,namespace) VALUES(${userId},${namespace}) ON CONFLICT DO NOTHING`;
    if (classId) {
      await tx`DELETE FROM teamtrack_class_workspace WHERE namespace=${namespace} AND class_id IN (SELECT id FROM teamtrack_class WHERE owner_id=${userId})`;
      await tx`INSERT INTO teamtrack_class_workspace(class_id,namespace) VALUES(${classId},${namespace}) ON CONFLICT DO NOTHING`;
    }
    return namespace;
  });
}
export async function removeMonitor(
  userId: string,
  namespace: string,
  target: string,
) {
  const db = await tables();
  await db.begin(async (tx) => {
    const rows =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = rows[0]?.data as State | undefined;
    const me = s?.users.find((u) => u.id === userId && u.active !== false);
    if (!s || !me || me.monitor || !(me.owner || me.role === "instructor"))
      throw Error("Only the workspace organizer can remove a professor");
    const member = s.users.find((u) => u.id === target && u.monitor);
    if (!member) throw Error("Monitoring professor not found");
    member.active = false;
    s.version++;
    await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
    await tx`DELETE FROM teamtrack_member WHERE user_id=${target} AND namespace=${namespace}`;
  });
}
