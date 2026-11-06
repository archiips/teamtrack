"use client";
import { useEffect, useState } from "react";
import { Check, ChevronDown, GraduationCap, RotateCcw } from "lucide-react";
import type { State } from "@/lib/types";

export type PracticeGo =
  | { view: "overview" | "tasks" | "team" | "agreement" | "activity" }
  | { view: "tasks"; filter?: string; teamId?: string }
  | { view: "brief" };
type Step = { label: string; hint: string; done: boolean; go: PracticeGo };

/** Practice steps, checked off from what the person has actually done. */
function steps(s: State, me: string, seen: Set<string>): Step[] {
  const mine = (actor: string) => actor === me;
  if (s.users.find((u) => u.id === me)?.role === "instructor")
    return [
      {
        label: "Open Team Nova from the Team progress chart",
        hint: "Overview → click the Team Nova row.",
        done: seen.has("tasks:pt2"),
        go: { view: "overview" },
      },
      {
        label: "Comment on Team Nova’s blocked task",
        hint: "Open “Set up the repo”, choose Comment, and send a note.",
        done: s.entries.some((e) => mine(e.actorId) && e.kind === "comment"),
        go: { view: "tasks", teamId: "pt2" },
      },
      {
        label: "Put Gus and Hal into a new team",
        hint: "Teams & people → Create team, tick both names.",
        done: s.teams.length > 2,
        go: { view: "team" },
      },
      {
        label: "Rename a checkpoint to match your syllabus",
        hint: "In the project brief, edit a checkpoint and Save.",
        done: s.events.some(
          (e) => mine(e.actorId) && e.body.startsWith("Updated checkpoint"),
        ),
        go: { view: "brief" },
      },
      {
        label: "Read a team’s Activity log",
        hint: "Every change is recorded with who made it.",
        done: seen.has("activity"),
        go: { view: "activity" },
      },
    ];
  const team = s.teams[0];
  return [
    {
      label: "Move one of your tasks to In progress",
      hint: "Tasks → Assigned to me → open a task → Status.",
      done: s.tasks.some((t) => t.ownerId === me && t.status !== "todo"),
      go: { view: "tasks", filter: "mine" },
    },
    {
      label: "Share an update with a link",
      hint: "In a task, write what you did and paste any https link.",
      done: s.entries.some(
        (e) => mine(e.actorId) && e.kind === "contribution" && !!e.url,
      ),
      go: { view: "tasks", filter: "mine" },
    },
    {
      label: "Raise a blocker on a task",
      hint: "“Anything in the way?” in a task. Clear it after if you like.",
      done: s.tasks.some((t) => t.id !== "pk4" && !!t.blocker),
      go: { view: "tasks", filter: "mine" },
    },
    {
      label: "Give a teammate a new task",
      hint: "New task → pick Leo or Sam as owner.",
      done: s.tasks.some((t) => !t.id.startsWith("pk") && t.ownerId !== me),
      go: { view: "tasks" },
    },
    {
      label: "Vote on Maya’s proposed agreement",
      hint: "Team agreement → Approve or Decline.",
      done:
        !!team &&
        (team.agreementVersion > 1 ||
          !team.proposal ||
          team.proposal.approvals.includes(me)),
      go: { view: "agreement" },
    },
    {
      label: "See everyone’s contribution on My team",
      hint: "Tasks done and updates per person, side by side.",
      done: seen.has("team"),
      go: { view: "team" },
    },
  ];
}

const key = (ns: string) => `tt-practice-${ns}`;
function stored(ns: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key(ns)) || "[]");
  } catch {
    return [];
  }
}

/** The practice checklist shown at the top of a practice workspace. */
export function PracticeGuide({
  s,
  userId,
  namespace,
  seen,
  busy,
  onGo,
  onRestart,
  onExit,
}: {
  s: State;
  userId: string;
  namespace: string;
  seen: Set<string>;
  busy: boolean;
  onGo: (go: PracticeGo) => void;
  onRestart: (role: "student" | "instructor") => void;
  onExit: () => void;
}) {
  const [open, setOpen] = useState(true);
  const list = steps(s, userId, seen);
  // A step stays ticked once done, even if they undo it (e.g. clear the blocker).
  const kept = stored(namespace);
  const done = list.map((x) => x.done || kept.includes(x.label));
  const doneKey = list
    .filter((_, i) => done[i])
    .map((x) => x.label)
    .join("|");
  useEffect(() => {
    try {
      localStorage.setItem(key(namespace), JSON.stringify(doneKey.split("|")));
    } catch {}
  }, [namespace, doneKey]);
  const count = done.filter(Boolean).length;
  const prof = s.users.find((u) => u.id === userId)?.role === "instructor";
  const next = list.findIndex((_, i) => !done[i]);
  return (
    <section className={`practice-guide ${open ? "" : "closed"}`}>
      <button
        className="practice-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="practice-badge">
          <GraduationCap size={15} />
          Practice {prof ? "as an instructor" : "as a student"}
        </span>
        <strong>
          {count === list.length
            ? "You’ve tried everything. You’re ready."
            : `${count} of ${list.length} tried · nothing here is shared`}
        </strong>
        <span
          className="practice-meter"
          aria-hidden="true"
          style={{ ["--p" as string]: `${(count / list.length) * 100}%` }}
        />
        <ChevronDown size={16} />
      </button>
      {open && (
        <>
          <ol className="practice-steps">
            {list.map((x, i) => (
              <li
                key={x.label}
                className={done[i] ? "done" : i === next ? "next" : ""}
              >
                <span className="practice-check" aria-hidden="true">
                  {done[i] ? <Check size={12} /> : i + 1}
                </span>
                <span>
                  <strong>{x.label}</strong>
                  <small>{x.hint}</small>
                </span>
                {!done[i] && (
                  <button className="secondary" onClick={() => onGo(x.go)}>
                    Show me
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="practice-foot">
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                try {
                  localStorage.removeItem(key(namespace));
                } catch {}
                onRestart(prof ? "instructor" : "student");
              }}
            >
              <RotateCcw size={13} />
              Start over
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => onRestart(prof ? "student" : "instructor")}
            >
              Try it as {prof ? "a student" : "an instructor"}
            </button>
            <button className="primary" disabled={busy} onClick={onExit}>
              {count === list.length ? "Finish practice" : "Leave practice"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
