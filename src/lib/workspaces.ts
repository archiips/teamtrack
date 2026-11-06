import { randomInt, randomUUID } from "node:crypto";
import { accountById, accountTables } from "./accounts";
import { blankState, person } from "./domain";
import type { State } from "./types";

// No 0/O or 1/I, so a code read aloud or copied by hand still works.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () =>
  Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    "",
  );
/** "abcd-2345 " → "ABCD2345". */
export const normalizeCode = (code: string) =>
  code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export type WorkspaceSummary = {
  namespace: string;
  course: string;
  project: string;
  role: "instructor" | "student";
};

export async function listWorkspaces(
  userId: string,
): Promise<WorkspaceSummary[]> {
  const db = await accountTables();
  const rows = await db`
    SELECT m.namespace, s.data->>'course' AS course, s.data->>'project' AS project,
      (SELECT u FROM jsonb_array_elements(s.data->'users') u WHERE u->>'id' = m.user_id) AS me
    FROM teamtrack_member m JOIN teamtrack_state s ON s.id = m.namespace
    WHERE m.user_id = ${userId} ORDER BY m.joined_at`;
  return rows
    .filter((r) => r.me && r.me.active !== false)
    .map((r) => ({
      namespace: r.namespace,
      course: r.course,
      project: r.project,
      role: r.me.role === "instructor" ? "instructor" : "student",
    }));
}

export async function isMember(userId: string, namespace: string) {
  const db = await accountTables();
  const rows =
    await db`SELECT 1 FROM teamtrack_member WHERE user_id=${userId} AND namespace=${namespace}`;
  return rows.length > 0;
}

/** Sets up a workspace with its creator as instructor or as the first student. */
export async function createWorkspace(
  userId: string,
  body: Record<string, unknown>,
) {
  const me = await accountById(userId);
  if (!me) throw Error("Please sign in");
  const role = body.role === "instructor" ? "instructor" : "student";
  const db = await accountTables();
  const namespace = "w_" + randomUUID().replaceAll("-", "").slice(0, 16);
  for (let attempt = 0; ; attempt++) {
    const code = newCode();
    const state = blankState(
      {
        course: String(body.course ?? ""),
        project: String(body.project ?? ""),
        description: String(body.description ?? ""),
        due: String(body.due ?? ""),
      },
      person(me.id, me.name, me.email, role),
      code,
    );
    try {
      await db.begin(async (tx) => {
        await tx`INSERT INTO teamtrack_invite (code,namespace) VALUES (${code},${namespace})`;
        await tx`INSERT INTO teamtrack_state (id,data) VALUES (${namespace},${tx.json(state)})`;
        await tx`INSERT INTO teamtrack_member (user_id,namespace) VALUES (${me.id},${namespace})`;
      });
      return namespace;
    } catch (e) {
      // A code collision is the only expected failure; anything else is real.
      if (attempt < 3 && String(e).includes("teamtrack_invite_pkey")) continue;
      throw e;
    }
  }
}

/** Adds the person to the workspace behind this code as a student. */
export async function joinWorkspace(userId: string, rawCode: string) {
  const me = await accountById(userId);
  if (!me) throw Error("Please sign in");
  const code = normalizeCode(rawCode);
  if (code.length !== 8) throw Error("Invite codes have 8 letters and numbers");
  const db = await accountTables();
  const found =
    await db`SELECT namespace FROM teamtrack_invite WHERE code=${code}`;
  if (!found[0])
    throw Error("No workspace uses that code. Check it and retry.");
  const namespace = found[0].namespace as string;
  await db.begin(async (tx) => {
    const rows =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = rows[0].data as State;
    const existing = s.users.find((u) => u.id === me.id);
    if (existing?.active === false)
      throw Error("You were removed from this workspace. Ask the organizer.");
    if (!existing) {
      s.users.push(person(me.id, me.name, me.email, "student"));
      s.version++;
      await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
    }
    await tx`INSERT INTO teamtrack_member (user_id,namespace) VALUES (${me.id},${namespace}) ON CONFLICT DO NOTHING`;
  });
  return namespace;
}

/** A fresh code for the workspace; the old one stops working. */
export async function rotateInvite(namespace: string) {
  const db = await accountTables();
  const code = newCode();
  await db.begin(async (tx) => {
    const rows =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = rows[0].data as State;
    await tx`UPDATE teamtrack_invite SET code=${code} WHERE namespace=${namespace}`;
    s.inviteCode = code;
    s.version++;
    await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
  });
}
