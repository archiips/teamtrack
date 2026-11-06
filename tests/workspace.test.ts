import { describe, it, expect } from "vitest";
import { seed } from "../src/lib/seed";
import {
  apply,
  blankState,
  openTeams,
  person,
  visible,
} from "../src/lib/domain";
const creator = person("u_a", "Jamie Rivera", "jamie@school.edu", "student");
const fresh = () => {
  const s = blankState(
    {
      course: "CSS 360",
      project: "Group app",
      description: "",
      due: "2030-01-15",
    },
    creator,
    "ABCD2345",
  );
  s.users.push(
    person("u_b", "Kai Lee", "kai@school.edu", "student"),
    person("u_c", "Ana Ruiz", "ana@school.edu", "student"),
  );
  return s;
};
describe("own workspaces", () => {
  it("starts empty with its creator as organizer and four checkpoints", () => {
    const s = fresh();
    expect(s.users[0]).toMatchObject({
      id: "u_a",
      owner: true,
      initials: "JR",
    });
    expect(s.teams).toEqual([]);
    expect(s.checkpoints?.map((c) => c.title)).toEqual([
      "Plan",
      "Build",
      "Review",
      "Final",
    ]);
    expect(s.checkpoints?.at(-1)?.due).toBe("2030-01-15");
  });
  it("lets a student start a team and a classmate join it", () => {
    let s = apply(fresh(), "u_a", { type: "team.create", name: "Debuggers" });
    expect(s.teams[0].memberIds).toEqual(["u_a"]);
    expect(openTeams(s, "u_b")).toEqual([
      { id: s.teams[0].id, name: "Debuggers", size: 1 },
    ]);
    s = apply(s, "u_b", { type: "team.join", teamId: s.teams[0].id });
    expect(s.teams[0].memberIds).toEqual(["u_a", "u_b"]);
    expect(openTeams(s, "u_b")).toEqual([]);
    expect(() =>
      apply(s, "u_b", { type: "team.create", name: "Second" }),
    ).toThrow("already on a team");
  });
  it("keeps a member with open tasks from leaving", () => {
    let s = apply(fresh(), "u_a", { type: "team.create", name: "Debuggers" });
    const teamId = s.teams[0].id;
    s = apply(s, "u_a", {
      type: "task.create",
      teamId,
      title: "Wireframes",
      ownerId: "u_a",
      due: "2030-01-01",
    });
    expect(() => apply(s, "u_a", { type: "team.leave", teamId })).toThrow(
      "Hand off",
    );
    const t = s.tasks[0];
    s = apply(s, "u_a", { type: "task.delete", id: t.id, version: t.version });
    s = apply(s, "u_a", { type: "team.leave", teamId });
    expect(s.teams[0].memberIds).toEqual([]);
  });
  it("lets the student organizer edit the brief but not a plain student", () => {
    const s = apply(fresh(), "u_a", {
      type: "project.update",
      title: "New",
      description: "Desc",
      due: "2030-02-01",
    });
    expect(s).toMatchObject({ project: "New", due: "2030-02-01" });
    expect(() =>
      apply(s, "u_b", { type: "project.update", title: "x", description: "y" }),
    ).toThrow("organizer");
  });
  it("hides classmates' emails from students", () => {
    const s = apply(fresh(), "u_a", { type: "team.create", name: "Debuggers" });
    const t = apply(s, "u_b", { type: "team.join", teamId: s.teams[0].id });
    const v = visible(t, "u_b");
    expect(v.users.find((u) => u.id === "u_a")?.email).toBeUndefined();
    expect(v.users.find((u) => u.id === "u_b")?.email).toBe("kai@school.edu");
  });
});
describe("instructor team management", () => {
  it("creates an empty team and adds and removes students", () => {
    let s = seed();
    s = apply(s, "p1", {
      type: "team.create",
      name: "Late joiners",
      memberIds: [],
    });
    const id = s.teams.at(-1)!.id;
    s = apply(s, "p1", { type: "team.update", teamId: id, add: ["s9", "s10"] });
    expect(s.teams.at(-1)!.memberIds).toEqual(["s9", "s10"]);
    s = apply(s, "p1", { type: "team.update", teamId: id, remove: "s9" });
    expect(s.teams.at(-1)!.memberIds).toEqual(["s10"]);
    expect(() =>
      apply(s, "s1", { type: "team.update", teamId: "t1", remove: "s2" }),
    ).toThrow("Instructor");
  });
  it("only lets a team member delete its tasks", () => {
    expect(() =>
      apply(seed(), "s5", { type: "task.delete", id: "k1", version: 1 }),
    ).toThrow("Access denied");
    const s = apply(seed(), "s1", {
      type: "task.delete",
      id: "k1",
      version: 1,
    });
    expect(s.tasks.some((t) => t.id === "k1")).toBe(false);
    expect(s.entries.some((e) => e.taskId === "k1")).toBe(false);
  });
});
describe("checkpoints", () => {
  it("lets the organizer rename, re-date and delete checkpoints", () => {
    let s = apply(fresh(), "u_a", { type: "team.create", name: "Debuggers" });
    const [plan, build] = s.checkpoints!;
    s = apply(s, "u_a", {
      type: "task.create",
      teamId: s.teams[0].id,
      title: "Outline",
      ownerId: "u_a",
      due: "2030-01-01",
      checkpoint: "Plan",
    });
    s = apply(s, "u_a", {
      type: "checkpoint.update",
      id: plan.id,
      title: "Proposal",
      due: "2029-12-01",
    });
    expect(s.checkpoints![0]).toMatchObject({
      title: "Proposal",
      due: "2029-12-01",
    });
    expect(s.tasks[0].checkpoint).toBe("Proposal");
    expect(() =>
      apply(s, "u_a", {
        type: "checkpoint.update",
        id: plan.id,
        title: "Build",
        due: "2029-12-01",
      }),
    ).toThrow("already exists");
    expect(() =>
      apply(s, "u_b", { type: "checkpoint.delete", id: build.id }),
    ).toThrow("organizer");
    s = apply(s, "u_a", { type: "checkpoint.delete", id: build.id });
    expect(s.checkpoints!.map((c) => c.title)).toEqual([
      "Proposal",
      "Review",
      "Final",
    ]);
  });
  it("keeps at least one checkpoint", () => {
    let s = fresh();
    for (const c of s.checkpoints!.slice(1))
      s = apply(s, "u_a", { type: "checkpoint.delete", id: c.id });
    expect(() =>
      apply(s, "u_a", { type: "checkpoint.delete", id: s.checkpoints![0].id }),
    ).toThrow("at least one");
  });
});
