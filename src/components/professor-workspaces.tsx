"use client";
import { useState } from "react";
import type { WorkspaceSummary } from "./onboarding";
export type ClassSummary = { id: string; name: string };
export function ProfessorWorkspaces({
  classes,
  workspaces,
  csrf,
  onRefresh,
}: {
  classes: ClassSummary[];
  workspaces: WorkspaceSummary[];
  csrf: string;
  onRefresh: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(body: unknown) {
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
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel onboard-card">
      <h2>Your classes</h2>
      <p>
        Keep separate team workspaces under a class. Each workspace keeps its
        own invitations and permissions.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save({ action: "class.create", name: f.get("name") });
          e.currentTarget.reset();
        }}
      >
        <label>
          New class name
          <input
            name="name"
            required
            maxLength={120}
            placeholder="CSS 474 · Fall 2026"
          />
        </label>
        <button className="secondary" disabled={busy}>
          Create class
        </button>
      </form>
      {classes.map((c) => (
        <div key={c.id} style={{ marginTop: 16 }}>
          <strong>{c.name}</strong>
          <small style={{ display: "block" }}>
            {workspaces.filter((w) => w.classId === c.id).length} workspaces
          </small>
        </div>
      ))}
      {classes.length > 0 &&
        workspaces.some((w) => w.role === "instructor" && !w.practice) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                action: "class.attach",
                namespace: f.get("namespace"),
                classId: f.get("classId"),
              });
            }}
          >
            <label>
              Workspace
              <select name="namespace">
                {workspaces
                  .filter((w) => w.role === "instructor" && !w.practice)
                  .map((w) => (
                    <option key={w.namespace} value={w.namespace}>
                      {w.project}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Class
              <select name="classId">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary" disabled={busy}>
              Move into class
            </button>
          </form>
        )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
