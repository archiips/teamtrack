"use client";
import "./professor-workspaces.css";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Link2,
  Plus,
} from "lucide-react";
import type { WorkspaceSummary } from "./onboarding";
export type ClassSummary = { id: string; name: string };
export function ProfessorWorkspaces({
  classes,
  workspaces,
  csrf,
  onRefresh,
  onDone,
  monitorToken = "",
  studentInvite = "",
}: {
  classes: ClassSummary[];
  workspaces: WorkspaceSummary[];
  csrf: string;
  onRefresh: () => Promise<void>;
  onDone: () => Promise<void>;
  monitorToken?: string;
  studentInvite?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [newClass, setNewClass] = useState(false),
    [choice, setChoice] = useState(
      classes.length === 1 ? classes[0].id : "new",
    ),
    [invitation, setInvitation] = useState(
      monitorToken ? `/?monitor=${monitorToken}` : "",
    );
  async function save(body: unknown, open = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (open) await onDone();
      else await onRefresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const teams = workspaces.filter(
      (w) => w.role === "instructor" && !w.practice,
    ),
    unassigned = teams.filter((w) => !w.classId);
  const row = (w: WorkspaceSummary) => (
    <div className="prof-team-row" key={w.namespace}>
      <button
        className="prof-team-open"
        disabled={busy}
        onClick={() => save({ action: "switch", namespace: w.namespace }, true)}
      >
        <span className="prof-team-icon">
          <GraduationCap size={19} />
        </span>
        <span>
          <strong>{w.project}</strong>
          <small>
            {w.monitor ? "Read-only monitoring" : "Instructor access"}
          </small>
        </span>
        <ArrowRight size={17} />
      </button>
      {classes.length > 0 && (
        <select
          aria-label={`Class for ${w.project}`}
          value={w.classId || ""}
          disabled={busy}
          onChange={(e) =>
            save({
              action: "class.attach",
              classId: e.target.value,
              namespace: w.namespace,
            })
          }
        >
          <option value="" disabled>
            Choose a class
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
  return (
    <div className="prof-hub">
      <section className="prof-invite-panel">
        <div className="prof-panel-heading">
          <Link2 size={21} />
          <div>
            <h2>Add a team to your class</h2>
            <p>
              Use the professor invitation shared by a team member. Their
              project, tasks and agreement stay in the same workspace.
            </p>
          </div>
        </div>
        {studentInvite && !monitorToken && (
          <p className="prof-invite-notice" role="status">
            You opened a teammate invitation. Ask a team member to choose{" "}
            <strong>Invite → Professor</strong> and send that link. It gives you
            monitoring access, rather than enrolling you as a student.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              let token = invitation.trim();
              if (!/^[a-f0-9]{64}$/.test(token)) {
                const u = new URL(token, location.origin);
                token = u.searchParams.get("monitor") || "";
              }
              if (!/^[a-f0-9]{64}$/.test(token))
                throw Error(
                  "Use a professor invitation link, not a teammate invite code.",
                );
              void save(
                {
                  action: "monitor.join",
                  token,
                  ...(choice === "new"
                    ? { className: f.get("className") }
                    : { classId: choice }),
                },
                true,
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {monitorToken && invitation === `/?monitor=${monitorToken}` ? (
            <div className="prof-invitation-ready" role="status">
              <CheckCircle2 size={18} />
              <span>Professor invitation received</span>
              <button
                type="button"
                className="text-button"
                onClick={() => setInvitation("")}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <label>
                Professor invitation link
                <input
                  aria-label="Professor invitation link"
                  value={invitation}
                  onChange={(e) => setInvitation(e.target.value)}
                  placeholder="Paste the link your team shared"
                  required
                  disabled={busy}
                />
              </label>
            </>
          )}
          <div className="prof-placement">
            <label>
              Add to class
              <select
                aria-label="Add to class"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                disabled={busy}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="new">Create a new class…</option>
              </select>
            </label>
            {choice === "new" && (
              <label>
                New class name
                <input
                  name="className"
                  aria-label="Class name for this team"
                  placeholder="BBUS 444 · Fall 2026"
                  required
                  maxLength={120}
                  disabled={busy}
                />
              </label>
            )}
          </div>
          <div className="prof-form-footer">
            <small>
              No need to recreate the team or enter its project name.
            </small>
            <button className="primary" disabled={busy}>
              {busy ? "Adding…" : "Add team to class"}
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </section>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <section className="prof-class-list">
        <header>
          <div>
            <h2>Your classes</h2>
            <p>
              Open a team to review its progress. Moving it between your classes
              does not change its project.
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setNewClass(!newClass)}
          >
            <Plus size={15} />
            New class
          </button>
        </header>
        {newClass && (
          <form
            className="prof-new-class"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (await save({ action: "class.create", name: f.get("name") }))
                setNewClass(false);
            }}
          >
            <label>
              New class name
              <input
                name="name"
                placeholder="BBUS 444 · Fall 2026"
                required
                maxLength={120}
              />
            </label>
            <button className="secondary" disabled={busy}>
              Create class
            </button>
          </form>
        )}
        {!classes.length && !teams.length && (
          <div className="prof-empty">
            <GraduationCap size={27} />
            <strong>Your teams will appear here</strong>
            <p>
              Add your first team using its professor invitation above. You can
              create the class in the same step.
            </p>
          </div>
        )}
        {classes.map((c) => (
          <section className="prof-class" key={c.id}>
            <header>
              <h3>{c.name}</h3>
              <span>
                {teams.filter((w) => w.classId === c.id).length} teams
              </span>
            </header>
            {teams.filter((w) => w.classId === c.id).map(row)}
            {!teams.some((w) => w.classId === c.id) && (
              <p className="prof-class-empty">
                No teams yet. Choose this class when you accept a team’s
                professor invitation.
              </p>
            )}
          </section>
        ))}
        {unassigned.length > 0 && (
          <section className="prof-class">
            <header>
              <h3>Teams not in a class</h3>
              <span>{unassigned.length}</span>
            </header>
            {unassigned.map(row)}
          </section>
        )}
      </section>
    </div>
  );
}
