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
import { ProfessorWorkspaces, type ClassSummary } from "./professor-workspaces";
import { today } from "@/lib/dates";

export type Account = { id: string; name: string; email: string };
export type WorkspaceSummary = {
  namespace: string;
  course: string;
  project: string;
  role: "instructor" | "student";
  practice?: boolean;
  monitor?: boolean;
  classId?: string;
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
  professorInvite = false,
  onDone,
}: {
  invite: string;
  professorInvite?: boolean;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(
    invite ? "signup" : "signin",
  );
  const [entry, setEntry] = useState<"student" | "instructor">(
    professorInvite ? "instructor" : "student",
  );
  const [forgot, setForgot] = useState(false),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        portal: entry,
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
      <div className="auth-tabs" aria-label="Sign in role">
        <button
          type="button"
          className={entry === "student" ? "selected" : ""}
          onClick={() => setEntry("student")}
        >
          Student login
        </button>
        <button
          type="button"
          className={entry === "instructor" ? "selected" : ""}
          onClick={() => setEntry("instructor")}
        >
          Professor login
        </button>
      </div>
      {entry === "instructor" && (
        <p>
          Create classes and team workspaces, or accept a team’s monitoring
          invitation. Your workspace permissions determine access.
        </p>
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
      {mode === "signin" && (
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setForgot(!forgot);
            setNotice("");
          }}
        >
          Forgot password?
        </button>
      )}
      {forgot && (
        <form
          className="signin"
          onSubmit={async (e) => {
            e.preventDefault();
            const email = new FormData(e.currentTarget).get("recoveryEmail");
            setBusy(true);
            setNotice("");
            try {
              await post("/api/auth/forgot-password", { email });
              setNotice(
                "If an account uses that email, a password-reset link will arrive shortly. Check your spam folder too.",
              );
            } catch (e) {
              setNotice((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Account email
            <input
              name="recoveryEmail"
              type="email"
              required
              autoComplete="email"
            />
          </label>
          <button className="secondary" disabled={busy}>
            Send reset link
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
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
  portal,
  account,
  workspaces,
  classes,
  monitorToken,
  onRefresh,
  csrf,
  invite,
  onDone,
  onBack,
  onSignOut,
}: {
  portal: "student" | "instructor";
  account: Account;
  workspaces: WorkspaceSummary[];
  classes: ClassSummary[];
  monitorToken: string;
  onRefresh: () => Promise<void>;
  csrf: string;
  invite: string;
  onDone: () => Promise<void>;
  onBack?: () => void;
  onSignOut: () => void;
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const role = portal;
  async function act(kind: string, body: Record<string, unknown>) {
    setBusy(kind);
    setError("");
    try {
      await post("/api/workspaces", body, csrf);
      if (kind === "portal") await onRefresh();
      else await onDone();
      setBusy("");
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
          <button
            className="secondary"
            disabled={!!busy}
            onClick={() =>
              act("portal", {
                action: "portal",
                portal: portal === "student" ? "instructor" : "student",
              })
            }
          >
            Switch to {portal === "student" ? "professor" : "student"} portal
          </button>
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
        <span className="page-kicker">
          {portal === "student" ? "Student" : "Professor"} portal ·{" "}
          {account.email}
        </span>
        <h1>
          {role === "instructor" ? (
            "Classes & team workspaces"
          ) : (
            <>
              Where to next,{" "}
              <em className="accent">{account.name.split(" ")[0]}</em>.
            </>
          )}
        </h1>
        <p className="onboard-lede">
          {role === "instructor"
            ? "Monitor your student teams and keep their existing workspaces organized by class."
            : "Join your team with an invite code, or create a new workspace and invite your teammates."}
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {monitorToken && role === "student" && (
          <section className="panel onboard-card">
            <h2>Professor monitoring invitation</h2>
            <p>
              This grants read-only access to this workspace. It does not give
              access to other teams’ workspaces.
            </p>
            <button
              className="primary"
              disabled={!!busy}
              onClick={() =>
                act("portal", { action: "portal", portal: "instructor" })
              }
            >
              Switch to professor portal to accept
            </button>
          </section>
        )}
        {role === "instructor" && (
          <ProfessorWorkspaces
            classes={classes}
            workspaces={workspaces}
            csrf={csrf}
            onRefresh={onRefresh}
            onDone={onDone}
            monitorToken={monitorToken}
            studentInvite={invite}
          />
        )}
        <div className="onboard-grid">
          {role === "student" ? (
            <section className="panel onboard-card">
              <span className="onboard-icon">
                <KeyRound size={20} />
              </span>
              <h2>Join with a student invite code</h2>
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
          ) : null}
          <details
            className="workspace-create-options"
            open={role === "student" || undefined}
          >
            <summary>
              {role === "instructor"
                ? "Create a new team workspace instead"
                : "Create a workspace"}
            </summary>
            <section className="panel onboard-card">
              <span className="onboard-icon">
                <Plus size={20} />
              </span>
              <h2>Create a workspace</h2>
              <p>
                For your class or your group. You can change all of it later.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act("create", {
                    action: "create",
                    role,
                    classId: f.get("classId") || undefined,
                    team: f.get("team") ?? "",
                    course: f.get("course"),
                    project: f.get("project"),
                    description: f.get("description"),
                    due: f.get("due"),
                  });
                }}
              >
                {role === "instructor" && classes.length > 0 && (
                  <label>
                    Place this workspace in a class
                    <select name="classId">
                      <option value="">Separate workspace</option>
                      {classes.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Class name
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
                      Team name{" "}
                      <small>(optional, defaults to the project)</small>
                    </span>
                    <input
                      name="team"
                      placeholder="Byte Club"
                      maxLength={120}
                    />
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
          </details>
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
              onClick={() => act("practice", { action: "practice", role })}
            >
              {busy === "practice"
                ? "Opening…"
                : role === "student"
                  ? "As a student"
                  : "As an instructor"}
            </button>
          </section>
        )}
        {workspaces.some((w) => role === "student" || w.practice) && (
          <section className="onboard-list">
            <h2>
              {role === "instructor" ? "Private practice" : "Your workspaces"}
            </h2>
            {workspaces
              .filter((w) => role === "student" || w.practice)
              .map((w) => (
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
                      {w.classId
                        ? `${classes.find((c) => c.id === w.classId)?.name || "Class"} · `
                        : ""}
                      {w.practice
                        ? "Your private practice · Sample data"
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
