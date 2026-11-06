import { today } from "./dates";
import { State, Command, Task, User } from "./types";
const text = (v: unknown, max = 4000) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("Please enter valid text");
  return v.trim();
};
export function visible(s: State, userId: string): State {
  const u = s.users.find((x) => x.id === userId);
  if (!u || u.active === false) throw Error("Access denied");
  if (u.role === "instructor") return s;
  const teams = s.teams.filter((t) => t.memberIds.includes(userId)),
    ids = new Set(teams.map((t) => t.id)),
    tasks = s.tasks.filter((t) => ids.has(t.teamId)),
    ks = new Set(tasks.map((t) => t.id));
  return {
    ...s,
    teams,
    tasks,
    entries: s.entries.filter((e) => ks.has(e.taskId)),
    events: s.events.filter((e) => ids.has(e.teamId)),
    users: s.users
      .filter(
        (x) =>
          x.id === userId ||
          teams.some((t) => t.memberIds.includes(x.id)) ||
          x.role === "instructor",
      )
      .map((x) => (x.id === userId ? x : { ...x, email: undefined })),
  };
}
/** Teams a student without a team can join: names and sizes only. */
export function openTeams(s: State, userId: string) {
  const u = s.users.find((x) => x.id === userId);
  if (
    !u ||
    u.role !== "student" ||
    s.teams.some((t) => t.memberIds.includes(userId))
  )
    return [];
  return s.teams.map((t) => ({
    id: t.id,
    name: t.name,
    size: t.memberIds.length,
  }));
}
const colors = ["blue", "purple", "green", "orange"];
/** A workspace member built from an account. */
export function person(
  id: string,
  name: string,
  email: string,
  role: User["role"],
): User {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const color = colors[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4];
  return { id, name, email, role, initials, color, active: true };
}
/** A new, empty workspace whose only member is its creator. */
/**
 * A workspace a student set up for their own group: no instructor, exactly one team.
 * Instructor workspaces hold any number of teams.
 */
export function isGroup(s: State) {
  return !!s.inviteCode && !s.users.some((u) => u.role === "instructor");
}
function newTeam(name: string, memberIds: string[]) {
  return {
    id: crypto.randomUUID(),
    name,
    memberIds,
    agreement:
      "We meet once a week and reply in our group chat within a day.\nEvery task has one owner and a due date.\nIf something is in the way, we raise a blocker early.",
    agreementVersion: 1,
    accepted: [] as string[],
  };
}
export function blankState(
  b: {
    course: string;
    project: string;
    description: string;
    due: string;
    team?: string;
  },
  creator: User,
  inviteCode: string,
): State {
  const course = text(b.course, 120),
    project = text(b.project, 120),
    due = dateOnly(b.due);
  const start = new Date(today() + "T12:00:00Z").getTime(),
    end = new Date(due + "T12:00:00Z").getTime(),
    step = Math.max(0, end - start) / 4;
  return {
    version: 1,
    inviteCode,
    course,
    project,
    description:
      typeof b.description === "string" && b.description.trim()
        ? b.description.trim().slice(0, 4000)
        : "Agree on the plan, split up the work and keep each other posted.",
    due,
    checkpoints: ["Plan", "Build", "Review", "Final"].map((title, i) => ({
      id: crypto.randomUUID(),
      title,
      due: new Date(start + step * (i + 1)).toISOString().slice(0, 10),
    })),
    users: [{ ...creator, owner: true }],
    // A student's workspace is their group, so its one team exists from the start.
    teams:
      creator.role === "student"
        ? [newTeam(b.team?.trim() ? text(b.team, 120) : project, [creator.id])]
        : [],
    tasks: [],
    entries: [],
    events: [],
  };
}
function dateOnly(v: unknown) {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    throw Error("Choose a due date");
  return v;
}
export function attention(s: State, teamId: string) {
  const t = s.teams.find((x) => x.id === teamId)!;
  const tasks = s.tasks.filter((x) => x.teamId === teamId);
  const reasons = [];
  const n = tasks.filter((x) => x.blocker && x.status !== "done").length;
  const overdue = tasks.filter(
    (x) => x.status !== "done" && x.due < today(),
  ).length;
  if (n) reasons.push(`${n} blocked task${n > 1 ? "s" : ""}`);
  if (overdue) reasons.push(`${overdue} overdue task${overdue > 1 ? "s" : ""}`);
  if (t.accepted.length < t.memberIds.length)
    reasons.push(`${t.memberIds.length - t.accepted.length} agreement pending`);
  return reasons;
}
export function apply(original: State, actorId: string, c: Command): State {
  const s = structuredClone(original);
  const u = s.users.find((x) => x.id === actorId);
  if (!u || u.active === false) throw Error("Access denied");
  const instructor = () => {
    if (u.role !== "instructor") throw Error("Instructor access required");
  };
  // The brief and checkpoints: the instructor, or the student who set the workspace up.
  const organizer = () => {
    if (u.role !== "instructor" && !u.owner)
      throw Error("Only the workspace organizer can change this");
  };
  const teamOf = (id: string) => s.teams.find((t) => t.memberIds.includes(id));
  const removeMember = (t: State["teams"][number], id: string, why: string) => {
    if (
      s.tasks.some(
        (x) => x.teamId === t.id && x.ownerId === id && x.status !== "done",
      )
    )
      throw Error(why);
    t.memberIds = t.memberIds.filter((m) => m !== id);
    t.accepted = t.accepted.filter((m) => m !== id);
  };
  const access = (id: unknown) => {
    const t = s.teams.find((x) => x.id === id);
    if (!t || (u.role !== "instructor" && !t.memberIds.includes(actorId)))
      throw Error("Access denied");
    return t;
  };
  const event = (teamId: string, body: string, entityId?: string) =>
    s.events.unshift({
      id: crypto.randomUUID(),
      teamId,
      entityId,
      actorId,
      body,
      at: new Date().toISOString(),
    });
  if (c.type === "task.update") {
    const t = s.tasks.find((x) => x.id === c.id);
    if (!t) throw Error("Access denied");
    const team = access(t.teamId);
    if (t.version !== c.version)
      throw Error("This task changed. Reload and try again.");
    if (c.status !== undefined) {
      if (!["todo", "in_progress", "done"].includes(String(c.status)))
        throw Error("Invalid status");
      t.status = c.status as Task["status"];
    }
    if (c.ownerId !== undefined) {
      if (!team.memberIds.includes(String(c.ownerId)))
        throw Error("Owner must belong to this team");
      t.ownerId = String(c.ownerId);
    }
    if (c.blocker !== undefined) {
      if (typeof c.blocker !== "string" || c.blocker.length > 4000)
        throw Error("Invalid blocker");
      t.blocker = c.blocker.trim();
    }
    if (c.title !== undefined) t.title = text(c.title, 120);
    if (c.description !== undefined) t.description = text(c.description);
    if (c.due !== undefined) {
      if (
        typeof c.due !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(c.due) ||
        !Number.isFinite(Date.parse(c.due))
      )
        throw Error("Choose a due date");
      t.due = c.due;
    }
    t.version++;
    event(
      t.teamId,
      `${t.status === "done" ? "Completed" : "Updated"} “${t.title}”`,
      t.id,
    );
  } else if (c.type === "task.create") {
    const team = access(c.teamId);
    if (!team.memberIds.includes(String(c.ownerId)))
      throw Error("Owner must belong to this team");
    if (
      typeof c.due !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(c.due) ||
      !Number.isFinite(Date.parse(c.due))
    )
      throw Error("Choose a due date");
    const t: Task = {
      id: crypto.randomUUID(),
      teamId: team.id,
      title: text(c.title, 120),
      description:
        typeof c.description === "string" ? c.description.slice(0, 4000) : "",
      ownerId: String(c.ownerId),
      status: "todo",
      due: c.due,
      checkpoint: String(c.checkpoint || "Discover"),
      blocker: "",
      version: 1,
    };
    s.tasks.push(t);
    event(team.id, `Created “${t.title}”`, t.id);
  } else if (c.type === "contribution.add" || c.type === "comment.add") {
    const t = s.tasks.find((x) => x.id === c.taskId);
    if (!t) throw Error("Access denied");
    access(t.teamId);
    const url = typeof c.url === "string" ? c.url.trim() : "";
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          throw Error();
      } catch {
        throw Error("Evidence links must use HTTPS");
      }
    }
    s.entries.unshift({
      id: crypto.randomUUID(),
      taskId: t.id,
      actorId,
      body: text(c.body),
      url,
      at: new Date().toISOString(),
      kind: c.type === "comment.add" ? "comment" : "contribution",
    });
    event(
      t.teamId,
      `${c.type === "comment.add" ? "Commented on" : "Added evidence to"} “${t.title}”`,
      t.id,
    );
  } else if (c.type === "contribution.update") {
    const entry = s.entries.find((e) => e.id === c.id);
    if (!entry || entry.actorId !== actorId)
      throw Error("Only the author can correct an update");
    const task = s.tasks.find((t) => t.id === entry.taskId);
    if (!task) throw Error("Access denied");
    access(task.teamId);
    if ((entry.version || 1) !== c.version)
      throw Error("This update changed. Reload and try again.");
    const previous = entry.body;
    entry.body = text(c.body);
    entry.version = (entry.version || 1) + 1;
    event(
      task.teamId,
      `Corrected update on “${task.title}”. Previous text: ${previous}`,
      task.id,
    );
  } else if (c.type === "agreement.accept") {
    const t = access(c.teamId);
    if (!t.memberIds.includes(actorId))
      throw Error("Only team members can accept");
    if (t.agreementVersion !== c.version)
      throw Error("Agreement changed. Read the current version.");
    if (!t.accepted.includes(actorId)) {
      t.accepted.push(actorId);
      event(t.id, `Accepted team agreement version ${t.agreementVersion}`);
    }
  } else if (c.type === "agreement.publish") {
    const t = access(c.teamId);
    if (t.agreementVersion !== c.version)
      throw Error("This agreement changed. Reload before publishing.");
    t.agreementHistory ??= [];
    t.agreementHistory.push({
      version: t.agreementVersion,
      body: t.agreement,
      accepted: [...t.accepted],
    });
    t.agreement = text(c.body, 12000);
    t.agreementVersion++;
    t.accepted = [];
    event(t.id, `Published team agreement version ${t.agreementVersion}`);
  } else if (c.type === "task.delete") {
    const t = s.tasks.find((x) => x.id === c.id);
    if (!t) throw Error("Access denied");
    access(t.teamId);
    if (t.version !== c.version)
      throw Error("This task changed. Reload and try again.");
    s.tasks = s.tasks.filter((x) => x.id !== t.id);
    s.entries = s.entries.filter((e) => e.taskId !== t.id);
    event(t.teamId, `Deleted “${t.title}”`);
  } else if (c.type === "team.create" && u.role === "student") {
    // Students form their own team and become its first member.
    if (teamOf(actorId)) throw Error("You’re already on a team");
    if (isGroup(s) && s.teams.length)
      throw Error("This workspace has one team. Join it instead.");
    const t = newTeam(text(c.name, 120), [actorId]);
    s.teams.push(t);
    event(t.id, `Started team “${t.name}”`);
  } else if (c.type === "team.join") {
    if (u.role !== "student") throw Error("Only students join teams");
    if (teamOf(actorId)) throw Error("You’re already on a team");
    const t = s.teams.find((x) => x.id === c.teamId);
    if (!t) throw Error("That team no longer exists");
    t.memberIds.push(actorId);
    event(t.id, `Joined the team`);
  } else if (c.type === "team.leave") {
    const t = access(c.teamId);
    if (!t.memberIds.includes(actorId)) throw Error("You’re not on this team");
    removeMember(
      t,
      actorId,
      "Hand off your open tasks before leaving the team",
    );
    event(t.id, `Left the team`);
  } else if (c.type === "team.update") {
    const t = access(c.teamId);
    if (c.name !== undefined) {
      t.name = text(c.name, 120);
      event(t.id, `Renamed the team “${t.name}”`);
    }
    if (c.add !== undefined || c.remove !== undefined) instructor();
    if (Array.isArray(c.add))
      for (const id of new Set(c.add.map(String))) {
        const m = s.users.find(
          (x) => x.id === id && x.role === "student" && x.active !== false,
        );
        if (!m || teamOf(id))
          throw Error("Choose unassigned enrolled students");
        t.memberIds.push(id);
        event(t.id, `Added ${m.name} to the team`);
      }
    if (typeof c.remove === "string") {
      const m = s.users.find((x) => x.id === c.remove);
      if (!m || !t.memberIds.includes(m.id))
        throw Error("They’re not on this team");
      removeMember(t, m.id, `Reassign ${m.name}’s open tasks first`);
      event(t.id, `Removed ${m.name} from the team`);
    }
  } else if (c.type === "team.create") {
    instructor();
    const memberIds = Array.isArray(c.memberIds)
      ? [...new Set(c.memberIds.map(String))]
      : [];
    if (
      memberIds.some(
        (id) =>
          !s.users.some(
            (x) => x.id === id && x.role === "student" && x.active !== false,
          ) || s.teams.some((t) => t.memberIds.includes(id)),
      )
    )
      throw Error("Choose unassigned enrolled students");
    const t = {
      id: crypto.randomUUID(),
      name: text(c.name, 120),
      memberIds,
      agreement:
        "Agree on meeting times, task ownership and how your team raises blockers.",
      agreementVersion: 1,
      accepted: [],
    };
    s.teams.push(t);
    event(t.id, `Created team “${t.name}”`);
  } else if (c.type === "checkpoint.create") {
    organizer();
    const title = text(c.title, 120);
    if (s.checkpoints?.some((x) => x.title === title))
      throw Error("Checkpoint already exists");
    if (
      typeof c.due !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(c.due) ||
      !Number.isFinite(Date.parse(c.due))
    )
      throw Error("Choose a due date");
    s.checkpoints ??= [];
    s.checkpoints.push({ id: crypto.randomUUID(), title, due: c.due });
    event(s.teams[0]?.id || "", `Created checkpoint “${title}”`);
  } else if (c.type === "checkpoint.update") {
    organizer();
    const cp = s.checkpoints?.find((x) => x.id === c.id);
    if (!cp) throw Error("That checkpoint no longer exists");
    const title = text(c.title, 120);
    if (s.checkpoints!.some((x) => x.id !== cp.id && x.title === title))
      throw Error("Checkpoint already exists");
    // Tasks name their checkpoint, so a rename carries over to them.
    for (const t of s.tasks)
      if (t.checkpoint === cp.title) t.checkpoint = title;
    cp.title = title;
    cp.due = dateOnly(c.due);
    event(s.teams[0]?.id || "", `Updated checkpoint “${title}”`);
  } else if (c.type === "checkpoint.delete") {
    organizer();
    const cp = s.checkpoints?.find((x) => x.id === c.id);
    if (!cp) throw Error("That checkpoint no longer exists");
    if (s.checkpoints!.length === 1)
      throw Error("Keep at least one checkpoint");
    // Tasks keep their label; it just no longer appears on the track.
    s.checkpoints = s.checkpoints!.filter((x) => x.id !== cp.id);
    event(s.teams[0]?.id || "", `Removed checkpoint “${cp.title}”`);
  } else if (c.type === "project.update") {
    organizer();
    s.project = text(c.title, 120);
    s.description = text(c.description);
    if (c.course !== undefined) s.course = text(c.course, 120);
    if (c.due !== undefined) s.due = dateOnly(c.due);
    event(s.teams[0]?.id || "", `Updated project brief`);
  } else throw Error("Unknown action");
  s.version++;
  return s;
}
