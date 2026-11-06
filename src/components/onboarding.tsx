"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  KeyRound,
  LogOut,
  Plus,
  Users,
} from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { today } from "@/lib/dates";

export type Account = { id: string; name: string; email: string };
export type WorkspaceSummary = {
  namespace: string;
  course: string;
  project: string;
  role: "instructor" | "student";
  practice?: boolean;
};

async function post(url: string, body: unknown, csrf?: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || "Something went wrong. Please retry.");
  return d;
}

/** Sign in or create an account. Calls onDone once the session cookie is set. */
export function AuthPanel({
  invite,
  onDone,
}: {
  invite: string;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(
    invite ? "signup" : "signin",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        name: f.get("name"),
        email: f.get("email"),
        password: f.get("password"),
      });
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {invite ? (
        <div className="demo-badge invite-badge">
          <span />
          You’ve been invited to a workspace
        </div>
      ) : (
        <div className="demo-badge">
          <span />
          For student teams and their instructors
        </div>
      )}
      <h2>{mode === "signin" ? "Welcome back." : "Create your account."}</h2>
      <p>
        {invite
          ? "Create an account (or sign in) and you’ll join right away."
          : mode === "signin"
            ? "Sign in to pick up where your team left off."
            : "Free, takes a minute. Then start a workspace or join one with a code."}
      </p>
      <div className="auth-tabs" role="tablist">
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            className={mode === id ? "selected" : ""}
            onClick={() => {
              setMode(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form className="signin" onSubmit={submit} key={mode}>
        {mode === "signup" && (
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              placeholder="Jamie Rivera"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete={mode === "signin" ? "username" : "email"}
            placeholder="you@school.edu"
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            minLength={mode === "signup" ? 8 : undefined}
            placeholder={mode === "signup" ? "At least 8 characters" : ""}
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
          <ArrowRight size={18} />
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <a className="canvas-note" href="/lms" target="_blank" rel="noreferrer">
        <GraduationCap size={22} />
        <p>
          <strong>Looking for the CSS 474 class demo?</strong>
          <br />
          Sign in with a demo account above, or open the demo course page to see
          TeamTrack launched from an LMS.
        </p>
        <ArrowUpRight size={18} />
      </a>
    </>
  );
}

/** Signed in, choosing a workspace: join with a code, create one, or open an existing one. */
export function Onboarding({
  account,
  workspaces,
  csrf,
  invite,
  onDone,
  onBack,
  onSignOut,
}: {
  account: Account;
  workspaces: WorkspaceSummary[];
  csrf: string;
  invite: string;
  onDone: () => Promise<void>;
  onBack?: () => void;
  onSignOut: () => void;
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [role, setRole] = useState<"student" | "instructor">("student");
  async function act(kind: string, body: Record<string, unknown>) {
    setBusy(kind);
    setError("");
    try {
      await post("/api/workspaces", body, csrf);
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  }
  const due = new Date(Date.parse(today() + "T12:00:00Z") + 70 * 86400000)
    .toISOString()
    .slice(0, 10);
  return (
    <main className="onboard">
      <header className="onboard-top">
        <div className="brand">
          <Logo size={28} />
          TeamTrack
        </div>
        <div className="onboard-actions">
          {onBack && (
            <button className="secondary" onClick={onBack}>
              <ArrowLeft size={15} />
              Back to my workspace
            </button>
          )}
          <ThemeToggle />
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={onSignOut}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div className="onboard-body">
        <span className="page-kicker">Signed in as {account.email}</span>
        <h1>
          {workspaces.length ? "Where to next, " : "Let’s get you set up, "}
          <em className="accent">{account.name.split(" ")[0]}</em>.
        </h1>
        <p className="onboard-lede">
          A workspace holds one class project: its teams, tasks and agreements.
          Joining a classmate’s? Use their invite code. Starting fresh? Create
          one and share the code.
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="onboard-grid">
          <section className="panel onboard-card">
            <span className="onboard-icon">
              <KeyRound size={20} />
            </span>
            <h2>Join with an invite code</h2>
            <p>Your instructor or teammate can find it under “Invite”.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act("join", { action: "join", code: f.get("code") });
              }}
            >
              <label>
                Invite code
                <input
                  name="code"
                  className="code-input"
                  placeholder="ABCD-2345"
                  defaultValue={invite}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                  maxLength={12}
                />
              </label>
              <button className="primary" disabled={!!busy}>
                {busy === "join" ? "Joining…" : "Join workspace"}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
          <section className="panel onboard-card">
            <span className="onboard-icon">
              <Plus size={20} />
            </span>
            <h2>Create a workspace</h2>
            <p>For your class or your group. You can change all of it later.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act("create", {
                  action: "create",
                  role,
                  team: f.get("team") ?? "",
                  course: f.get("course"),
                  project: f.get("project"),
                  description: f.get("description"),
                  due: f.get("due"),
                });
              }}
            >
              <div
                className="role-pick"
                role="radiogroup"
                aria-label="Your role"
              >
                {(
                  [
                    ["student", "I’m a student", "One workspace for my team"],
                    [
                      "instructor",
                      "I’m the instructor",
                      "Several teams, I see all",
                    ],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button
                    type="button"
                    key={id}
                    role="radio"
                    aria-checked={role === id}
                    className={role === id ? "selected" : ""}
                    onClick={() => setRole(id)}
                  >
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
              <label>
                Class
                <input
                  name="course"
                  placeholder="CSS 360 · Software engineering"
                  required
                  maxLength={120}
                />
              </label>
              <div className="form-grid">
                <label>
                  Project name
                  <input
                    name="project"
                    placeholder="Group project"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Final due date
                  <input
                    name="due"
                    type="date"
                    min={today()}
                    defaultValue={due}
                    required
                  />
                </label>
              </div>
              {role === "student" && (
                <label>
                  <span>
                    Team name <small>(optional, defaults to the project)</small>
                  </span>
                  <input name="team" placeholder="Byte Club" maxLength={120} />
                </label>
              )}
              <label>
                <span>
                  What’s the project about? <small>(optional)</small>
                </span>
                <textarea
                  name="description"
                  maxLength={4000}
                  placeholder="One or two sentences your team can rally around."
                />
              </label>
              <button className="primary" disabled={!!busy}>
                {busy === "create" ? "Creating…" : "Create workspace"}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
        {!workspaces.some((w) => w.practice) && (
          <section className="onboard-practice">
            <span className="onboard-icon small">
              <GraduationCap size={16} />
            </span>
            <span>
              <strong>New here? Practice first.</strong>
              <small>
                A 3-minute hands-on tour with sample teammates. Nothing is
                shared, and you can leave any time.
              </small>
            </span>
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() =>
                act("practice", { action: "practice", role: "student" })
              }
            >
              {busy === "practice" ? "Opening…" : "As a student"}
            </button>
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() =>
                act("practice", { action: "practice", role: "instructor" })
              }
            >
              As an instructor
            </button>
          </section>
        )}
        {workspaces.length > 0 && (
          <section className="onboard-list">
            <h2>Your workspaces</h2>
            {workspaces.map((w) => (
              <button
                key={w.namespace}
                className="workspace-row"
                disabled={!!busy}
                onClick={() =>
                  act("switch", { action: "switch", namespace: w.namespace })
                }
              >
                <span className="onboard-icon small">
                  <Users size={16} />
                </span>
                <span>
                  <strong>{w.project}</strong>
                  <small>
                    {w.practice
                      ? "Practice workspace"
                      : `${w.course} · ${w.role === "instructor" ? "Instructor" : "Student"}`}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
