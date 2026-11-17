import { describe, it, expect } from "vitest";
import { blankState, isGroup, person, apply, visible } from "../src/lib/domain";
describe("professor monitoring", () => {
  it("keeps a student workspace a group after a monitor joins", () => {
    const s = blankState(
      {
        course: "Class one",
        project: "Project",
        description: "",
        due: "2030-12-01",
      },
      person("s", "Student One", "s@example.edu", "student"),
      "ABCDEFGH",
    );
    s.users.push({
      ...person("p", "Professor One", "p@example.edu", "instructor"),
      monitor: true,
    });
    expect(isGroup(s)).toBe(true);
  });
  it("allows reading but refuses monitor mutations", () => {
    const s = blankState(
      {
        course: "Class one",
        project: "Project",
        description: "",
        due: "2030-12-01",
      },
      person("s", "Student One", "s@example.edu", "student"),
      "ABCDEFGH",
    );
    s.users.push({
      ...person("p", "Professor One", "p@example.edu", "instructor"),
      monitor: true,
    });
    expect(visible(s, "p").teams).toHaveLength(1);
    expect(() =>
      apply(s, "p", { type: "team.create", name: "Unwanted team" }),
    ).toThrow("read-only");
  });
});
