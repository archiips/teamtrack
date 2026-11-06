import { today } from "./dates";
import type { State, User } from "./types";

/*
 * A private practice workspace: sample teammates, tasks and a pending agreement vote,
 * so someone can try every feature without touching real work. The sample people
 * have no accounts; only the person practising can sign in to it.
 */
const day = (n: number) => {
  const d = new Date(today() + "T12:00:00Z");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const sample = (id: string, name: string, color: string): User => ({
  id,
  name,
  role: "student",
  initials: name
    .split(" ")
    .map((x) => x[0])
    .join(""),
  color,
  active: true,
});
const AGREEMENT =
  "We meet every Tuesday at 4pm.\nEvery task has one owner and a due date.\nIf something is in the way, we raise a blocker early.";

export function practiceState(me: User, role: User["role"]): State {
  const base = {
    version: 1,
    practice: true,
    course: "Practice class",
    project: "Campus food app",
    description:
      "A sample project to try TeamTrack. Click anything: nothing here is shared or graded.",
    due: day(45),
    checkpoints: ["Plan", "Build", "Review", "Final"].map((title, i) => ({
      id: "pc" + i,
      title,
      due: day(i * 12 + 4),
    })),
    entries: [],
    events: [],
  };
  if (role === "student") {
    const people = [
      sample("p_maya", "Maya Chen", "purple"),
      sample("p_leo", "Leo Park", "green"),
      sample("p_sam", "Sam Ortiz", "orange"),
    ];
    const team = {
      id: "pt1",
      name: "Practice Team",
      memberIds: ["p_maya", me.id, "p_leo", "p_sam"],
      leaderId: "p_maya",
      agreement: AGREEMENT,
      agreementVersion: 1,
      accepted: ["p_maya", "p_leo", "p_sam"],
      // Everyone else already approved, so your vote decides it.
      proposal: {
        body: AGREEMENT + "\nWe reply in the group chat within a day.",
        by: "p_maya",
        at: ago(5),
        approvals: ["p_maya", "p_leo", "p_sam"],
      },
    };
    const task = (
      id: string,
      title: string,
      ownerId: string,
      status: "todo" | "in_progress" | "done",
      due: number,
      checkpoint: string,
      blocker = "",
    ) => ({
      id,
      teamId: "pt1",
      title,
      description: "A sample task. Open it, update it, share progress.",
      ownerId,
      status,
      due: day(due),
      checkpoint,
      blocker,
      version: 1,
    });
    return {
      ...base,
      users: [{ ...me, owner: false }, ...people],
      teams: [team],
      tasks: [
        task("pk1", "Draft the survey questions", me.id, "todo", 3, "Plan"),
        task("pk2", "Book a room for interviews", me.id, "todo", 6, "Plan"),
        task("pk3", "Sketch the menu screen", "p_maya", "done", -2, "Plan"),
        task(
          "pk4",
          "Set up the project repo",
          "p_leo",
          "in_progress",
          2,
          "Build",
          "Waiting for the instructor to approve the org",
        ),
        task("pk5", "Collect dining hall hours", "p_sam", "todo", -1, "Plan"),
      ],
      entries: [
        {
          id: "pe1",
          taskId: "pk3",
          actorId: "p_maya",
          body: "Finished three menu sketches; the list layout tested best.",
          url: "https://example.com/menu-sketches",
          at: ago(20),
          kind: "contribution",
        },
      ],
      events: [
        {
          id: "pv1",
          teamId: "pt1",
          entityId: "pk3",
          actorId: "p_maya",
          body: "Completed “Sketch the menu screen”",
          at: ago(20),
        },
        {
          id: "pv2",
          teamId: "pt1",
          actorId: "p_maya",
          body: "Proposed a new team agreement for a vote",
          at: ago(5),
        },
      ],
    };
  }
  const students = [
    sample("p_ana", "Ana Ruiz", "blue"),
    sample("p_ben", "Ben Okafor", "green"),
    sample("p_cy", "Cy Tran", "purple"),
    sample("p_dee", "Dee Shah", "orange"),
    sample("p_eli", "Eli Brooks", "blue"),
    sample("p_fay", "Fay Kim", "green"),
    sample("p_gus", "Gus Lee", "purple"),
    sample("p_hal", "Hal Diaz", "orange"),
  ];
  const team = (id: string, name: string, memberIds: string[]) => ({
    id,
    name,
    memberIds,
    leaderId: memberIds[0],
    agreement: AGREEMENT,
    agreementVersion: 1,
    accepted: memberIds.slice(0, 2),
  });
  const t = (
    id: string,
    teamId: string,
    title: string,
    ownerId: string,
    status: "todo" | "in_progress" | "done",
    due: number,
    blocker = "",
  ) => ({
    id,
    teamId,
    title,
    description: "A sample task.",
    ownerId,
    status,
    due: day(due),
    checkpoint: "Plan",
    blocker,
    version: 1,
  });
  return {
    ...base,
    users: [{ ...me, owner: true }, ...students],
    teams: [
      team("pt1", "Team Atlas", ["p_ana", "p_ben", "p_cy"]),
      team("pt2", "Team Nova", ["p_dee", "p_eli", "p_fay"]),
    ],
    tasks: [
      t("pk1", "pt1", "User interviews", "p_ana", "done", -3),
      t("pk2", "pt1", "Survey draft", "p_ben", "done", -1),
      t("pk3", "pt1", "Wireframes", "p_cy", "in_progress", 4),
      t("pk4", "pt2", "Pick a dataset", "p_dee", "todo", -2),
      t(
        "pk5",
        "pt2",
        "Set up the repo",
        "p_eli",
        "in_progress",
        1,
        "Nobody has admin access to the class org",
      ),
      t("pk6", "pt2", "Project pitch slides", "p_fay", "todo", 5),
    ],
  };
}
