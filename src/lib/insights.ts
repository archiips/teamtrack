import type { State, Task, Team, User } from "./types";

/** Recorded facts only: counts per status, never a score or ranking. */
function mix(tasks: Task[]) {
  return {
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    todo: tasks.filter((t) => t.status === "todo").length,
    total: tasks.length,
    blocked: tasks.filter((t) => t.blocker && t.status !== "done").length,
  };
}

export type MemberRow = ReturnType<typeof mix> & {
  user: User;
  updates: number;
  accepted: boolean;
};

/** One row per member, in roster order, scoped to this team's tasks. */
export function memberBreakdown(s: State, team: Team): MemberRow[] {
  const teamTasks = s.tasks.filter((t) => t.teamId === team.id),
    taskIds = new Set(teamTasks.map((t) => t.id));
  return s.users
    .filter((u) => team.memberIds.includes(u.id))
    .map((user) => ({
      user,
      ...mix(teamTasks.filter((t) => t.ownerId === user.id)),
      updates: s.entries.filter(
        (e) =>
          e.actorId === user.id &&
          e.kind === "contribution" &&
          taskIds.has(e.taskId),
      ).length,
      accepted: team.accepted.includes(user.id),
    }));
}

export function teamHealth(s: State, team: Team, today: string) {
  const tasks = s.tasks.filter((t) => t.teamId === team.id);
  return {
    ...mix(tasks),
    overdue: tasks.filter((t) => t.status !== "done" && t.due < today).length,
    pendingAgreement: team.memberIds.filter((m) => !team.accepted.includes(m))
      .length,
  };
}

/** Every team's status mix for the professor's chart, in course order (no ranking). */
export function courseProgress(s: State, today: string) {
  return s.teams.map((team) => ({ team, health: teamHealth(s, team, today) }));
}
