import { today } from "./dates";
import { State, Command, Task } from "./types";
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
    users: s.users.filter(
      (x) =>
        x.id === userId ||
        teams.some((t) => t.memberIds.includes(x.id)) ||
        x.role === "instructor",
    ),
  };
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
  const access = (id: unknown) => {
    const t = s.teams.find((x) => x.id === id);
    if (!t || (u.role !== "instructor" && !t.memberIds.includes(actorId)))
      throw Error("Access denied");
    return t;
  };
  const event = (teamId: string, body: string) =>
    s.events.unshift({
      id: crypto.randomUUID(),
      teamId,
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
    event(team.id, `Created “${t.title}”`);
  } else if (c.type === "contribution.add" || c.type === "comment.add") {
    const t = s.tasks.find((x) => x.id === c.taskId);
    if (!t) throw Error("Access denied");
    access(t.teamId);
    const url = typeof c.url === "string" ? c.url.trim() : "";
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") throw Error();
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
    t.agreement = text(c.body, 12000);
    t.agreementVersion++;
    t.accepted = [];
    event(t.id, `Published team agreement version ${t.agreementVersion}`);
  } else if (c.type === "team.create") {
    instructor();
    const memberIds = Array.isArray(c.memberIds)
      ? [...new Set(c.memberIds.map(String))]
      : [];
    if (
      !memberIds.length ||
      memberIds.some(
        (id) =>
          !s.users.some((x) => x.id === id && x.role === "student") ||
          s.teams.some((t) => t.memberIds.includes(id)),
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
  } else if (c.type === "project.update") {
    instructor();
    s.project = text(c.title, 120);
    s.description = text(c.description);
    event(s.teams[0]?.id || "", `Updated project brief`);
  } else throw Error("Unknown action");
  s.version++;
  return s;
}
