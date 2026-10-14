import { describe, expect, it } from "vitest";
import { memberBreakdown, teamHealth } from "../src/lib/insights";
import type { State } from "../src/lib/types";

const base: State = {
  version: 1,
  course: "C",
  project: "P",
  description: "",
  due: "2026-10-30",
  users: [
    { id: "a", name: "Ana", role: "student", initials: "A", color: "" },
    { id: "b", name: "Ben", role: "student", initials: "B", color: "" },
    { id: "c", name: "Cy", role: "student", initials: "C", color: "" },
  ],
  teams: [
    {
      id: "t1",
      name: "One",
      memberIds: ["a", "b"],
      agreement: "",
      agreementVersion: 1,
      accepted: ["a"],
    },
    {
      id: "t2",
      name: "Two",
      memberIds: ["c"],
      agreement: "",
      agreementVersion: 1,
      accepted: ["c"],
    },
  ],
  tasks: [
    task("k1", "t1", "a", "done", "2026-10-01"),
    task("k2", "t1", "a", "in_progress", "2026-10-20", "Waiting on data"),
    task("k3", "t1", "b", "todo", "2026-10-05"),
    task("k4", "t2", "a", "done", "2026-10-01"),
    task("k5", "t1", "a", "done", "2026-10-02", "old blocker"),
  ],
  entries: [
    entry("e1", "k1", "a", "contribution"),
    entry("e2", "k2", "a", "comment"),
    entry("e3", "k4", "a", "contribution"),
  ],
  events: [],
};

function task(
  id: string,
  teamId: string,
  ownerId: string,
  status: "todo" | "in_progress" | "done",
  due: string,
  blocker = "",
) {
  return {
    id,
    teamId,
    ownerId,
    status,
    due,
    blocker,
    title: id,
    description: "",
    checkpoint: "Discover",
    version: 1,
  };
}
function entry(
  id: string,
  taskId: string,
  actorId: string,
  kind: "contribution" | "comment",
) {
  return { id, taskId, actorId, kind, body: "", url: "", at: "2026-10-10" };
}

describe("memberBreakdown", () => {
  it("counts each member's own tasks in that team by status, in roster order", () => {
    const rows = memberBreakdown(base, base.teams[0]);
    expect(rows.map((r) => r.user.id)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({
      done: 2,
      inProgress: 1,
      todo: 0,
      total: 3,
      blocked: 1,
      accepted: true,
    });
    expect(rows[1]).toMatchObject({
      done: 0,
      todo: 1,
      total: 1,
      accepted: false,
    });
  });

  it("counts only contribution updates on this team's tasks", () => {
    const [a] = memberBreakdown(base, base.teams[0]);
    expect(a.updates).toBe(1);
  });
});

describe("teamHealth", () => {
  it("summarises status mix and concrete attention reasons", () => {
    expect(teamHealth(base, base.teams[0], "2026-10-13")).toEqual({
      done: 2,
      inProgress: 1,
      todo: 1,
      total: 4,
      blocked: 1,
      overdue: 1,
      pendingAgreement: 1,
    });
  });

  it("reports a quiet team with nothing to flag", () => {
    expect(teamHealth(base, base.teams[1], "2026-10-13")).toMatchObject({
      blocked: 0,
      overdue: 0,
      pendingAgreement: 0,
    });
  });
});
