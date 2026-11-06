import { describe, it, expect } from "vitest";
import { seed } from "../src/lib/seed";
import {
  apply,
  blankState,
  isGroup,
  leaderOf,
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
    // A student's workspace is their group: one team, named after the project.
    expect(s.teams.map((t) => [t.name, t.memberIds])).toEqual([
      ["Group app", ["u_a"]],
    ]);
    expect(s.checkpoints?.map((c) => c.title)).toEqual([
      "Plan",
      "Build",
      "Review",
      "Final",
    ]);
    expect(s.checkpoints?.at(-1)?.due).toBe("2030-01-15");
  });
  it("names the team when given, and leaves instructor workspaces teamless", () => {
    const b = { course: "C", project: "P", description: "", due: "2030-01-15" };
    expect(
      blankState({ ...b, team: "Debuggers" }, creator, "X").teams[0].name,
    ).toBe("Debuggers");
    const prof = person("u_p", "Dr. Lee", "lee@school.edu", "instructor");
    expect(blankState(b, prof, "X").teams).toEqual([]);
  });
  it("lets a classmate join the one team but not start a second", () => {
    let s = fresh();
    expect(isGroup(s)).toBe(true);
    expect(openTeams(s, "u_b")).toEqual([
      { id: s.teams[0].id, name: "Group app", size: 1 },
    ]);
    expect(() =>
      apply(s, "u_b", { type: "team.create", name: "Second" }),
    ).toThrow("one team");
    s = apply(s, "u_b", { type: "team.join", teamId: s.teams[0].id });
    expect(s.teams[0].memberIds).toEqual(["u_a", "u_b"]);
    expect(openTeams(s, "u_b")).toEqual([]);
  });
  it("keeps a member with open tasks from leaving", () => {
    let s = fresh();
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
    const s = fresh();
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
    let s = fresh();
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
describe("group workspaces created before teams were automatic", () => {
  it("let the first student name the team, then no second one", () => {
    let s = fresh();
    s.teams = [];
    s = apply(s, "u_a", { type: "team.create", name: "Late team" });
    expect(() =>
      apply(s, "u_b", { type: "team.create", name: "Other" }),
    ).toThrow("one team");
  });
});
describe("team leader and agreement votes", () => {
  const withTeam = () => {
    let s = fresh();
    for (const id of ["u_b", "u_c"])
      s = apply(s, id, { type: "team.join", teamId: s.teams[0].id });
    return s;
  };
  const propose = (s: ReturnType<typeof fresh>, by = "u_a") =>
    apply(s, by, {
      type: "agreement.propose",
      teamId: s.teams[0].id,
      version: s.teams[0].agreementVersion,
      body: "New rules",
    });
  const vote = (s: ReturnType<typeof fresh>, id: string, approve: boolean) =>
    apply(s, id, {
      type: "agreement.vote",
      teamId: s.teams[0].id,
      proposedAt: s.teams[0].proposal!.at,
      approve,
    });
  it("makes the workspace creator the leader", () => {
    const s = withTeam();
    expect(leaderOf(s, s.teams[0])).toBe("u_a");
    expect(() => propose(s, "u_b")).toThrow("team leader");
  });
  it("keeps the current agreement until everyone approves", () => {
    let s = propose(withTeam());
    expect(s.teams[0].proposal?.approvals).toEqual(["u_a"]);
    s = vote(s, "u_b", true);
    expect(s.teams[0].agreementVersion).toBe(1);
    s = vote(s, "u_c", true);
    expect(s.teams[0]).toMatchObject({
      agreement: "New rules",
      agreementVersion: 2,
    });
  });
  it("drops the proposal when anyone declines, and the leader can withdraw", () => {
    let s = vote(propose(withTeam()), "u_b", false);
    expect(s.teams[0].proposal).toBeUndefined();
    expect(s.teams[0].agreementVersion).toBe(1);
    s = apply(propose(s), "u_a", {
      type: "agreement.withdraw",
      teamId: s.teams[0].id,
    });
    expect(s.teams[0].proposal).toBeUndefined();
  });
  it("refuses a vote on a proposal that was replaced", () => {
    const s = propose(withTeam());
    const at = s.teams[0].proposal!.at;
    const replaced = structuredClone(s);
    replaced.teams[0].proposal!.at = "2000-01-01T00:00:00.000Z";
    expect(() =>
      apply(replaced, "u_b", {
        type: "agreement.vote",
        teamId: s.teams[0].id,
        proposedAt: at,
        approve: true,
      }),
    ).toThrow("changed");
  });
  it("adopts a single-member team's proposal at once", () => {
    const s = propose(fresh());
    expect(s.teams[0].agreementVersion).toBe(2);
  });
  it("adopts once the last holdout leaves", () => {
    let s = vote(propose(withTeam()), "u_b", true);
    s = apply(s, "u_c", { type: "team.leave", teamId: s.teams[0].id });
    expect(s.teams[0].agreementVersion).toBe(2);
  });
  it("transfers leadership, and with it the organizer role in a student workspace", () => {
    let s = withTeam();
    expect(() =>
      apply(s, "u_a", { type: "team.leave", teamId: s.teams[0].id }),
    ).toThrow("team leader before leaving");
    expect(() =>
      apply(s, "u_b", {
        type: "team.lead",
        teamId: s.teams[0].id,
        userId: "u_b",
      }),
    ).toThrow("team leader");
    s = apply(s, "u_a", {
      type: "team.lead",
      teamId: s.teams[0].id,
      userId: "u_b",
    });
    expect(leaderOf(s, s.teams[0])).toBe("u_b");
    expect(s.users.find((u) => u.id === "u_b")?.owner).toBe(true);
    expect(s.users.find((u) => u.id === "u_a")?.owner).toBe(false);
    expect(() =>
      apply(s, "u_a", { type: "project.update", title: "x", description: "y" }),
    ).toThrow("organizer");
    s = apply(s, "u_a", { type: "team.leave", teamId: s.teams[0].id });
    expect(s.teams[0].memberIds).toEqual(["u_b", "u_c"]);
  });
  it("lets only the leader rename the team", () => {
    const s = withTeam();
    expect(() =>
      apply(s, "u_b", {
        type: "team.update",
        teamId: s.teams[0].id,
        name: "X",
      }),
    ).toThrow("team leader");
    expect(
      apply(s, "u_a", { type: "team.update", teamId: s.teams[0].id, name: "X" })
        .teams[0].name,
    ).toBe("X");
  });
});
