import { today } from "./dates";
import { State } from "./types";
export function seed(): State {
  const date = (n: number) => {
    const d = new Date(today() + "T12:00:00Z");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return {
    checkpoints: ["Discover", "Define", "Prototype", "Share"].map(
      (title, i) => ({ id: "cp" + i, title, due: date(i * 3 + 2) }),
    ),
    version: 1,
    course: "CSS 474 · Product development lab",
    project: "Campus, without barriers",
    description:
      "Understanding how students navigate campus — and designing a more accessible experience together.",
    due: date(12),
    users: [
      {
        id: "s9",
        name: "Devon Kim",
        role: "student",
        initials: "DK",
        color: "green",
      },
      {
        id: "s10",
        name: "Avery Patel",
        role: "student",
        initials: "AP",
        color: "purple",
      },
      {
        id: "p1",
        name: "Dr. Morgan Lee",
        role: "instructor",
        initials: "ML",
        color: "blue",
      },
      {
        id: "s1",
        name: "Alex Chen",
        role: "student",
        initials: "AC",
        color: "blue",
      },
      {
        id: "s2",
        name: "Jordan Miller",
        role: "student",
        initials: "JM",
        color: "purple",
      },
      {
        id: "s3",
        name: "Taylor Brooks",
        role: "student",
        initials: "TB",
        color: "green",
      },
      {
        id: "s4",
        name: "Priya Shah",
        role: "student",
        initials: "PS",
        color: "orange",
      },
      {
        id: "s5",
        name: "Sam Rivera",
        role: "student",
        initials: "SR",
        color: "green",
      },
      {
        id: "s6",
        name: "Jamie Park",
        role: "student",
        initials: "JP",
        color: "blue",
      },
      {
        id: "s7",
        name: "Casey Nguyen",
        role: "student",
        initials: "CN",
        color: "purple",
      },
      {
        id: "s8",
        name: "Riley Jones",
        role: "student",
        initials: "RJ",
        color: "orange",
      },
    ],
    teams: [
      {
        id: "t1",
        name: "Wayfinders",
        memberIds: ["s1", "s2", "s3", "s4"],
        agreement:
          "We meet on Tuesdays at 3 pm.\nEach task has one accountable owner.\nWe share evidence of our work before each checkpoint.\nWe raise blockers early and help each other move forward.",
        agreementVersion: 1,
        accepted: ["s2", "s3", "s4"],
      },
      {
        id: "t2",
        name: "Open Campus",
        memberIds: ["s5", "s6", "s7", "s8"],
        agreement:
          "We meet every Wednesday. We document decisions and share responsibility for the final outcome.",
        agreementVersion: 1,
        accepted: ["s5", "s6", "s7", "s8"],
      },
    ],
    tasks: [
      {
        id: "k1",
        teamId: "t1",
        title: "Interview students about campus access",
        description:
          "Speak with three students about their daily routes. Capture obstacles, workarounds and opportunities.",
        ownerId: "s1",
        status: "in_progress",
        due: date(1),
        checkpoint: "Discover",
        blocker: "",
        version: 1,
      },
      {
        id: "k2",
        teamId: "t1",
        title: "Map the north campus accessibility route",
        description: "Walk the route and document ramps, signs and entrances.",
        ownerId: "s2",
        status: "in_progress",
        due: date(-1),
        checkpoint: "Discover",
        blocker: "Waiting for access to the facilities floor plans.",
        version: 1,
      },
      {
        id: "k3",
        teamId: "t1",
        title: "Synthesize our research findings",
        description:
          "Group observations into themes and identify the most important student needs.",
        ownerId: "s3",
        status: "todo",
        due: date(4),
        checkpoint: "Define",
        blocker: "",
        version: 1,
      },
      {
        id: "k4",
        teamId: "t1",
        title: "Review existing campus wayfinding tools",
        description: "Compare current signage and digital campus maps.",
        ownerId: "s4",
        status: "done",
        due: date(-2),
        checkpoint: "Discover",
        blocker: "",
        version: 1,
      },
      {
        id: "k5",
        teamId: "t2",
        title: "Build the first route prototype",
        description:
          "Create a simple paper prototype for the accessible-route experience.",
        ownerId: "s5",
        status: "in_progress",
        due: date(3),
        checkpoint: "Prototype",
        blocker: "",
        version: 1,
      },
      {
        id: "k6",
        teamId: "t2",
        title: "Collect student survey responses",
        description: "Gather and summarize initial survey responses.",
        ownerId: "s6",
        status: "done",
        due: date(-1),
        checkpoint: "Discover",
        blocker: "",
        version: 1,
      },
    ],
    entries: [
      {
        id: "e1",
        taskId: "k1",
        actorId: "s1",
        body: "Completed two interviews. Both students mentioned unclear signage near the library. Third interview scheduled for tomorrow.",
        url: "https://www.washington.edu/accessibility/",
        at: new Date(Date.now() - 3600000).toISOString(),
        kind: "contribution",
      },
      {
        id: "e2",
        taskId: "k4",
        actorId: "s4",
        body: "Reviewed the campus map and documented four gaps in step-free route information.",
        url: "",
        at: new Date(Date.now() - 86400000).toISOString(),
        kind: "contribution",
      },
    ],
    events: [
      {
        id: "v1",
        teamId: "t1",
        actorId: "s2",
        body: "Raised a blocker on “Map the north campus accessibility route”",
        at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "v2",
        teamId: "t1",
        actorId: "s4",
        body: "Completed “Review existing campus wayfinding tools”",
        at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  };
}
