import { describe, expect, it } from "vitest";
import { seed } from "../src/lib/seed";
import { reminders } from "../src/lib/notifications";
describe("actionable reminders", () => {
  it("only includes a student's team and own unfinished due tasks", () => {
    const s = seed();
    s.teams[0].accepted = [];
    s.tasks[0].ownerId = "s1";
    s.tasks[0].due = "2026-01-01";
    s.tasks[0].status = "todo";
    const n = reminders(s, "s1", "2026-01-02");
    expect(
      n.some(
        (x) =>
          x.id === `agreement:${s.teams[0].id}:${s.teams[0].agreementVersion}`,
      ),
    ).toBe(true);
    expect(n.some((x) => x.taskId === s.tasks[0].id)).toBe(true);
    expect(
      n.every((x) =>
        s.teams.find((t) => t.id === x.teamId)?.memberIds.includes("s1"),
      ),
    ).toBe(true);
    const ids = n.map((x) => x.id);
    s.version++;
    expect(reminders(s, "s1", "2026-01-02").map((x) => x.id)).toEqual(ids);
    s.tasks[0].status = "done";
    expect(
      reminders(s, "s1", "2026-01-02").some((x) => x.taskId === s.tasks[0].id),
    ).toBe(false);
  });
  it("resolves votes and acceptance, and scopes blocked task alerts to instructors", () => {
    const s = seed(),
      t = s.teams[0];
    t.proposal = {
      body: "New",
      by: "s2",
      at: "2026-01-01T12:00:00Z",
      approvals: [],
    };
    expect(reminders(s, "s1").some((x) => x.id.startsWith("proposal:"))).toBe(
      true,
    );
    t.proposal.approvals.push("s1");
    t.accepted.push("s1");
    expect(reminders(s, "s1").some((x) => x.target === "agreement")).toBe(
      false,
    );
    s.tasks[0].blocker = "Need access";
    s.tasks[0].status = "todo";
    const instructor = s.users.find((x) => x.role === "instructor")!;
    expect(
      reminders(s, instructor.id).some((x) => x.id.startsWith("blocked:")),
    ).toBe(true);
    expect(() => reminders(s, "outsider")).toThrow("Access denied");
  });
});
