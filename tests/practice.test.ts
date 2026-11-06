import { describe, it, expect } from "vitest";
import { apply, leaderOf, person, visible } from "../src/lib/domain";
import { practiceState } from "../src/lib/practice";
describe("practice workspace", () => {
  it("lets a student do every practice step", () => {
    const me = person("u_me", "Pat Lee", "pat@school.edu", "student");
    let s = practiceState(me, "student");
    expect(visible(s, "u_me").teams).toHaveLength(1);
    expect(leaderOf(s, s.teams[0])).toBe("p_maya");
    s = apply(s, "u_me", {
      type: "task.update",
      id: "pk1",
      version: 1,
      status: "in_progress",
    });
    s = apply(s, "u_me", {
      type: "contribution.add",
      taskId: "pk1",
      body: "Drafted 8 questions",
      url: "https://example.com/q",
    });
    s = apply(s, "u_me", {
      type: "task.update",
      id: "pk2",
      version: 1,
      blocker: "Rooms are booked",
    });
    s = apply(s, "u_me", {
      type: "task.create",
      teamId: "pt1",
      title: "Order snacks",
      ownerId: "p_leo",
      due: "2030-01-01",
    });
    // Everyone else already approved, so this vote adopts the new agreement.
    s = apply(s, "u_me", {
      type: "agreement.vote",
      teamId: "pt1",
      proposedAt: s.teams[0].proposal!.at,
      approve: true,
    });
    expect(s.teams[0].agreementVersion).toBe(2);
    expect(s.practice).toBe(true);
    expect(s.inviteCode).toBeUndefined();
  });
  it("lets an instructor do every practice step", () => {
    const me = person("u_me", "Dr. Lee", "lee@school.edu", "instructor");
    let s = practiceState(me, "instructor");
    s = apply(s, "u_me", {
      type: "comment.add",
      taskId: "pk5",
      body: "I'll add you to the org",
    });
    s = apply(s, "u_me", {
      type: "team.create",
      name: "Team Orbit",
      memberIds: ["p_gus", "p_hal"],
    });
    s = apply(s, "u_me", {
      type: "checkpoint.update",
      id: "pc0",
      title: "Proposal",
      due: "2030-01-05",
    });
    expect(s.teams).toHaveLength(3);
    expect(s.events[0].body).toContain("Updated checkpoint");
  });
});
