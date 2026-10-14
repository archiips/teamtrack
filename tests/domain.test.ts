import { describe, it, expect } from "vitest";
import { seed } from "../src/lib/seed";
import { apply, visible, attention } from "../src/lib/domain";
describe("team access and work history", () => {
  it("hides other teams from students", () => {
    expect(visible(seed(), "s1").teams.map((t) => t.id)).toEqual(["t1"]);
  });
  it("rejects another team task mutation", () => {
    expect(() =>
      apply(seed(), "s1", {
        type: "task.update",
        id: "k5",
        version: 1,
        status: "done",
      }),
    ).toThrow("Access denied");
  });
  it("rejects stale updates", () => {
    expect(() =>
      apply(seed(), "s1", {
        type: "task.update",
        id: "k1",
        version: 0,
        status: "done",
      }),
    ).toThrow("changed");
  });
  it("records actual task completion and its actor", () => {
    const s = apply(seed(), "s1", {
      type: "task.update",
      id: "k1",
      version: 1,
      status: "done",
    });
    expect(s.tasks.find((t) => t.id === "k1")?.status).toBe("done");
    expect(s.events[0].actorId).toBe("s1");
  });
  it("renews agreement acceptance after publication", () => {
    let s = apply(seed(), "s1", {
      type: "agreement.accept",
      teamId: "t1",
      version: 1,
    });
    s = apply(s, "s1", {
      type: "agreement.publish",
      teamId: "t1",
      body: "Meet every Tuesday and record work.",
    });
    expect(s.teams[0].accepted).toEqual([]);
    expect(s.teams[0].agreementVersion).toBe(2);
  });
  it("reports specific attention reasons", () => {
    expect(attention(seed(), "t1").some((x) => x.includes("blocked"))).toBe(
      true,
    );
  });
  it("rejects javascript evidence links", () => {
    expect(() =>
      apply(seed(), "s1", {
        type: "contribution.add",
        taskId: "k1",
        body: "Research",
        url: "javascript:alert(1)",
      }),
    ).toThrow("HTTPS");
  });
  it("prevents student team management", () => {
    expect(() =>
      apply(seed(), "s1", {
        type: "team.create",
        name: "New team",
        memberIds: ["s1"],
      }),
    ).toThrow("Instructor");
  });
});
it("updates task details and records history", () => {
  const s = apply(seed(), "s1", {
    type: "task.update",
    id: "k1",
    version: 1,
    title: "Interview four students",
    description: "Include commuters",
    due: "2026-10-20",
  });
  expect(s.tasks.find((t) => t.id === "k1")?.title).toBe(
    "Interview four students",
  );
});
it("preserves a correction record and rejects another author", () => {
  expect(() =>
    apply(seed(), "s2", {
      type: "contribution.update",
      id: "e1",
      body: "Changed",
      version: 1,
    }),
  ).toThrow("author");
  const s = apply(seed(), "s1", {
    type: "contribution.update",
    id: "e1",
    body: "Corrected interview notes",
    version: 1,
  });
  expect(s.entries.find((e) => e.id === "e1")?.body).toBe(
    "Corrected interview notes",
  );
  expect(s.events[0].body).toContain("Completed two interviews");
});
