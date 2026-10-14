"use client";
import { today } from "@/lib/dates";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
const CompanionModel = dynamic(() => import("@/components/companion-model"), {
  ssr: false,
});
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  ListTodo,
  Users,
  FileCheck2,
  Activity,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  MessageSquare,
  Link2,
  X,
  RefreshCw,
  GraduationCap,
  LogOut,
  Layers,
  MoreHorizontal,
  ExternalLink,
  Compass,
  CalendarDays,
  AlertCircle,
  PanelLeftClose,
} from "lucide-react";
import type { State, Task, User, Command } from "@/lib/types";
import { attention } from "@/lib/domain";
type View = "overview" | "tasks" | "team" | "agreement" | "activity";
const labels = { todo: "To do", in_progress: "In progress", done: "Done" };
const demoUsers = [
  { id: "p1", name: "Dr. Morgan Lee", role: "Professor", initials: "ML" },
  { id: "s1", name: "Alex Chen", role: "Student · Wayfinders", initials: "AC" },
  {
    id: "s2",
    name: "Jordan Miller",
    role: "Student · Wayfinders",
    initials: "JM",
  },
  {
    id: "s5",
    name: "Sam Rivera",
    role: "Student · Open Campus",
    initials: "SR",
  },
];
function date(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function Avatar({ user, small = false }: { user?: User; small?: boolean }) {
  return (
    <span className={`avatar ${user?.color || "blue"} ${small ? "small" : ""}`}>
      {user?.initials || "?"}
    </span>
  );
}
export default function Page() {
  const [s, setS] = useState<State | null>(null),
    [userId, setUserId] = useState(""),
    [csrf, setCsrf] = useState(""),
    [namespace, setNamespace] = useState("demo"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [view, setView] = useState<View>("overview"),
    [teamId, setTeamId] = useState("t1"),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [board, setBoard] = useState(false),
    [newTask, setNewTask] = useState(false),
    [newTeam, setNewTeam] = useState(false),
    [editProject, setEditProject] = useState(false),
    [companion, setCompanion] = useState(false),
    [dismissed, setDismissed] = useState(false);
  async function refresh() {
    try {
      const r = await fetch("/api/workspace");
      if (r.ok) {
        const d = await r.json();
        setS(d.state);
        setUserId(d.userId);
        setCsrf(d.csrf);
        setNamespace(d.namespace || "demo");
        setTeamId((t) =>
          d.state.teams.some((x: { id: string }) => x.id === t)
            ? t
            : d.state.teams[0]?.id || "",
        );
      } else setS(null);
    } catch {
      setError("Cannot connect. Please retry.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetch("/api/workspace")
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          setS(d.state);
          setUserId(d.userId);
          setCsrf(d.csrf);
          setNamespace(d.namespace || "demo");
          setTeamId(d.state.teams[0]?.id || "");
        }
        document.documentElement.classList.toggle(
          "embedded",
          window.self !== window.top,
        );
        setDismissed(store("get") === "yes");
      })
      .catch(() => setError("Cannot connect. Please retry."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function login(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      if (!r.ok) throw Error("Could not open demo. Please retry.");
      await refresh();
      setView("overview");
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function command(c: Command, message = "Changes saved") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(c),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setS(d.state);
      setToast(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="loading">
        <div className="brand">
          <Layers />
          TeamTrack
        </div>
        <span className="spinner" />
        Opening your workspace…
      </main>
    );
  if (!s)
    return (
      <main className="welcome">
        <section className="welcome-story">
          <div className="brand">
            <Layers />
            TeamTrack
          </div>
          <div>
            <span className="eyebrow">A little clarity. A better team.</span>
            <h1>
              Great work
              <br />
              happens
              <br />
              <em>together.</em>
            </h1>
            <p>
              A shared space to find your next step, make your work visible, and
              keep your team moving.
            </p>
            <div className="welcome-art">
              <CompanionModel hero />
              <span className="art-label">
                Meet Pip. A little help, always nearby.
              </span>
            </div>
          </div>
          <span className="welcome-foot">
            Built for student teams. Designed around people.
          </span>
        </section>
        <section className="welcome-login">
          <div className="demo-badge">
            <span />
            Interactive class demo
          </div>
          <h2>Find your place.</h2>
          <p>
            Choose a synthetic profile to explore TeamTrack.
            <br />
            Your changes are saved and shared across sessions.
          </p>
          <div className="profiles">
            {demoUsers.map((u) => (
              <button disabled={busy} key={u.id} onClick={() => login(u.id)}>
                <span className="avatar blue">{u.initials}</span>
                <span>
                  <strong>{u.name}</strong>
                  <small>{u.role}</small>
                </span>
                <ArrowRight size={19} />
              </button>
            ))}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="canvas-note">
            <GraduationCap size={22} />
            <p>
              <strong>Made to live inside Canvas</strong>
              <br />
              This entry uses demo profiles. Real Canvas launch is a separate
              integration.
            </p>
          </div>
        </section>
      </main>
    );
  const me = s.users.find((u) => u.id === userId)!,
    prof = me.role === "instructor",
    team = s.teams.find((t) => t.id === teamId) || s.teams[0],
    tasks = s.tasks.filter((t) => t.teamId === team?.id),
    all = prof ? s.tasks : tasks,
    done = all.filter((t) => t.status === "done").length,
    blocked = all.filter((t) => t.blocker && t.status !== "done").length,
    task = s.tasks.find((t) => t.id === selected),
    members = s.users.filter((u) => team?.memberIds.includes(u.id)),
    filtered = tasks.filter(
      (t) =>
        (filter === "all" ||
          (filter === "mine" && t.ownerId === userId) ||
          filter === t.status) &&
        t.title.toLowerCase().includes(query.toLowerCase()),
    );
  const nav = [
    {
      id: "overview",
      name: prof ? "Course overview" : "Overview",
      icon: LayoutDashboard,
    },
    { id: "tasks", name: "Tasks", icon: ListTodo },
    { id: "team", name: prof ? "Teams & people" : "My team", icon: Users },
    { id: "agreement", name: "Team agreement", icon: FileCheck2 },
    { id: "activity", name: "Activity", icon: Activity },
  ] as const;
  const open = all.filter((t) => t.status !== "done"),
    guide: {
      label: string;
      done: boolean;
      view: (typeof nav)[number]["id"];
      filter?: string;
    }[] = prof
      ? [
          {
            label: blocked
              ? `${blocked} blocked task${blocked === 1 ? "" : "s"} could use a hand`
              : "No blocked tasks right now",
            done: !blocked,
            view: "overview",
          },
          {
            label: s.teams.every((t) =>
              t.memberIds.every((m) => t.accepted.includes(m)),
            )
              ? "Every team agreement is accepted"
              : "Some members haven’t accepted their agreement",
            done: s.teams.every((t) =>
              t.memberIds.every((m) => t.accepted.includes(m)),
            ),
            view: "team",
          },
          {
            label: s.users.some(
              (u) =>
                u.role === "student" &&
                !s.teams.some((t) => t.memberIds.includes(u.id)),
            )
              ? "Some students still need a team"
              : "Every student has a team",
            done: !s.users.some(
              (u) =>
                u.role === "student" &&
                !s.teams.some((t) => t.memberIds.includes(u.id)),
            ),
            view: "team",
          },
        ]
      : [
          {
            label: "Accept your team agreement",
            done: !!team && team.accepted.includes(userId),
            view: "agreement",
          },
          {
            label: open.some((t) => t.ownerId === userId)
              ? `Move your ${open.filter((t) => t.ownerId === userId).length} open task${open.filter((t) => t.ownerId === userId).length === 1 ? "" : "s"} forward`
              : "Pick up a task",
            done: false,
            view: "tasks",
            filter: "mine",
          },
          {
            label: blocked
              ? "Help clear a team blocker"
              : "No blockers on your team",
            done: !blocked,
            view: "tasks",
          },
        ];
  function taskRow(t: Task) {
    const owner = s!.users.find((u) => u.id === t.ownerId);
    return (
      <button className="task-row" key={t.id} onClick={() => setSelected(t.id)}>
        <span className={`task-check ${t.status}`}>
          <Check size={13} />
        </span>
        <span className="task-name">
          <strong>{t.title}</strong>
          <small>
            {t.checkpoint}
            {t.blocker && t.status !== "done" && (
              <span className="blocker">
                <Flag size={11} />
                Blocked
              </span>
            )}
          </small>
        </span>
        <span className={`status ${t.status}`}>
          <span />
          {labels[t.status]}
        </span>
        <span className="task-owner">
          <Avatar user={owner} small />
          {owner?.name.split(" ")[0]}
        </span>
        <span
          className={`task-date ${t.status !== "done" && t.due < today() ? "overdue" : ""}`}
        >
          {date(t.due)}
        </span>
        <ChevronRight size={16} />
      </button>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="TeamTrack home">
          <Layers size={27} />
          TeamTrack
        </Link>
        <div className="course-switch">
          <GraduationCap size={20} />
          <div>
            <strong>
              {namespace === "demo" ? "Product development" : s.course}
            </strong>
            <small>
              {namespace === "demo" ? "Fall 2026 · CSS 474" : "Canvas course"}
            </small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">Your workspace</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              title={n.name}
              className={view === n.id ? "active" : ""}
              onClick={() => {
                setView(n.id);
                setQuery("");
              }}
            >
              <n.icon size={19} />
              {n.name}
              {n.id === "tasks" && (
                <span className="nav-count">
                  {tasks.filter((t) => t.status !== "done").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="mini-orb">
              <Compass size={23} />
            </span>
            <strong>
              Small steps.
              <br />
              Shared progress.
            </strong>
            <p>
              Your contribution is more
              <br />
              than a task count.
            </p>
          </div>
          <div className="profile">
            <Avatar user={me} />
            <div>
              <strong>{me.name}</strong>
              <small>{prof ? "Instructor" : "Student"}</small>
            </div>
            <button
              title="Switch demo profile"
              aria-label="Switch demo profile"
              onClick={() => {
                setS(null);
                setError("");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{s.course}</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.name}</strong>
          </div>
          <div className="top-actions">
            <span className="demo-badge">
              <span />
              {namespace === "demo" ? "Synthetic demo" : "Canvas connected"}
            </span>
            <button
              className="icon-button"
              onClick={() => {
                void refresh();
                setToast("Workspace refreshed");
              }}
              aria-label="Refresh workspace"
            >
              <RefreshCw size={17} />
            </button>
            <Avatar user={me} small />
          </div>
        </header>
        <main className="main">
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                {prof
                  ? "A clearer view of teamwork"
                  : "Your team, moving forward"}
              </div>
              <h1>
                {view === "overview"
                  ? prof
                    ? "Every team. One clear view."
                    : `Good ${new Date().getHours() < 12 ? "morning" : "evening"}, ${me.name.split(" ")[0]}.`
                  : view === "tasks"
                    ? "Make room for good work."
                    : view === "team"
                      ? prof
                        ? "The people behind the project."
                        : "Better, together."
                      : view === "agreement"
                        ? "Start on the same page."
                        : "The story of your work."}
              </h1>
              <p>
                {view === "overview"
                  ? prof
                    ? "See where things stand, and where a little support can help."
                    : "Here’s what’s happening with your project. Let’s take the next step."
                  : view === "tasks"
                    ? "Clear ownership. Shared context. One step at a time."
                    : view === "team"
                      ? "Different strengths, one shared goal."
                      : view === "agreement"
                        ? "A shared understanding of how your team works together."
                        : "Meaningful changes, recorded with the people behind them."}
              </p>
            </div>
            {view === "tasks" || view === "overview" ? (
              <button
                className="primary"
                disabled={!team}
                onClick={() => setNewTask(true)}
              >
                <Plus size={17} />
                New task
              </button>
            ) : view === "team" && prof ? (
              <button className="primary" onClick={() => setNewTeam(true)}>
                <Plus size={17} />
                Create team
              </button>
            ) : null}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {prof && namespace !== "demo" && (
            <div className="roster-status">
              <span>
                {s.integration?.error ||
                  (s.integration?.lastSync
                    ? `Roster synced ${new Date(s.integration.lastSync).toLocaleString()}`
                    : "Roster has not synced yet")}
              </span>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  command({ type: "roster.sync" }, "Canvas roster synchronized")
                }
              >
                <RefreshCw size={14} />
                Sync Canvas roster
              </button>
            </div>
          )}
          <div className="project-strip">
            <div>
              <span className="project-mark">
                <Compass size={20} />
              </span>
              <div>
                <strong>{s.project}</strong>
                <span>
                  Team project <span className="dot">·</span> Due {date(s.due)}
                </span>
              </div>
            </div>
            <div className="project-right">
              <div className="avatar-stack">
                {members.map((u) => (
                  <Avatar key={u.id} user={u} small />
                ))}
              </div>
              <select
                aria-label="Current team"
                value={team?.id || ""}
                onChange={(e) => setTeamId(e.target.value)}
              >
                {s.teams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {prof && (
                <button
                  className="icon-button"
                  aria-label="Edit project brief"
                  onClick={() => setEditProject(true)}
                >
                  <MoreHorizontal size={20} />
                </button>
              )}
            </div>
          </div>
          {view === "overview" && (
            <>
              <div className="stats">
                <div className="hero-stat">
                  <span>Work completed</span>
                  <strong>
                    {done}
                    <small> / {all.length}</small>
                  </strong>
                  <div className="progress">
                    <i
                      style={{
                        width: `${all.length ? (done / all.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <small>
                    {all.length ? Math.round((done / all.length) * 100) : 0}% of
                    recorded tasks
                  </small>
                </div>
                <div>
                  <span>
                    Moving forward <Clock3 size={16} />
                  </span>
                  <strong>
                    {all.filter((t) => t.status === "in_progress").length}
                  </strong>
                  <small>Tasks currently in progress</small>
                </div>
                <div>
                  <span>
                    Needs a hand <Flag size={16} />
                  </span>
                  <strong>
                    {blocked}
                    <span className="stat-note">
                      {blocked ? "Let’s unblock it" : "All clear"}
                    </span>
                  </strong>
                  <small>
                    Open blockers across {prof ? "your course" : "your team"}
                  </small>
                </div>
                <div className="cream-stat">
                  <span>
                    {prof ? "Teams connected" : "Team agreement"}
                    <Users size={16} />
                  </span>
                  <strong>
                    {prof ? s.teams.length : team?.accepted.length}
                    <small>{prof ? "" : ` / ${team?.memberIds.length}`}</small>
                  </strong>
                  <small>
                    {prof
                      ? "Working toward a shared goal"
                      : "Members have accepted this version"}
                  </small>
                </div>
              </div>
              <div className="overview-grid">
                <section className="panel main-panel">
                  <div className="panel-title">
                    <div>
                      <h2>{prof ? "Teams at a glance" : "Your next steps"}</h2>
                      <p>
                        {prof
                          ? "A little context makes all the difference."
                          : "The work that brings your project closer."}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView(prof ? "team" : "tasks")}
                    >
                      View all
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {prof ? (
                    <div className="team-overview">
                      {s.teams.map((t) => {
                        const ts = s.tasks.filter((k) => k.teamId === t.id),
                          d = ts.filter((k) => k.status === "done").length,
                          reasons = attention(s, t.id);
                        return (
                          <button
                            key={t.id}
                            className="team-summary"
                            onClick={() => {
                              setTeamId(t.id);
                              setView("tasks");
                            }}
                          >
                            <span className="team-emblem">
                              <Compass size={23} />
                            </span>
                            <div>
                              <strong>{t.name}</strong>
                              <span>
                                {t.memberIds.length} members{" "}
                                <span className="dot">·</span> {d} of{" "}
                                {ts.length} tasks done
                              </span>
                              <div className="progress">
                                <i
                                  style={{
                                    width: `${ts.length ? (d / ts.length) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span
                              className={
                                reasons.length ? "attention-tag" : "clear-tag"
                              }
                            >
                              {reasons.length ? reasons[0] : "On track"}
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      {tasks
                        .filter((t) => t.status !== "done")
                        .slice(0, 3)
                        .map(taskRow)}
                      {!tasks.some((t) => t.status !== "done") && (
                        <div className="empty">
                          <CheckCircle2 />
                          You’re all caught up. Nice work.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="panel-foot">
                    <span className="tiny-dot" />
                    Progress shows recorded tasks, not effort or quality.
                  </div>
                </section>
                <section className="focus-card">
                  <span className="focus-label">
                    <Compass size={16} />
                    Team focus
                  </span>
                  <h2>
                    Find the friction.
                    <br />
                    Make the path clearer.
                  </h2>
                  <p>{s.description}</p>
                  <div className="checkpoint-track">
                    <span className="finished">
                      <Check size={12} />
                    </span>
                    <i />
                    <span className="current" />
                    <i />
                    <span />
                    <i />
                    <span />
                  </div>
                  <div className="checkpoint-labels">
                    <span>Discover</span>
                    <span>Define</span>
                    <span>Prototype</span>
                    <span>Share</span>
                  </div>
                  <button onClick={() => setView("tasks")}>
                    Keep the project moving
                    <ArrowRight size={17} />
                  </button>
                </section>
              </div>
              <div className="overview-grid lower">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Recent contributions</h2>
                      <p>Good work deserves context.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("activity")}
                    >
                      Activity
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {s.entries
                    .filter((e) => e.kind === "contribution")
                    .slice(0, 3)
                    .map((e) => {
                      const u = s.users.find((x) => x.id === e.actorId),
                        t = s.tasks.find((x) => x.id === e.taskId);
                      return (
                        <button
                          className="contribution-preview"
                          key={e.id}
                          onClick={() => setSelected(e.taskId)}
                        >
                          <Avatar user={u} />
                          <div>
                            <strong>
                              {u?.name}
                              <span> shared an update</span>
                            </strong>
                            <p>{e.body}</p>
                            <small>{t?.title}</small>
                          </div>
                          <ArrowUpRight size={15} />
                        </button>
                      );
                    })}
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Coming up</h2>
                      <p>A little planning goes a long way.</p>
                    </div>
                    <CalendarDays size={19} />
                  </div>
                  {all
                    .filter((t) => t.status !== "done")
                    .sort((a, b) => a.due.localeCompare(b.due))
                    .slice(0, 3)
                    .map((t) => (
                      <button
                        className="deadline"
                        key={t.id}
                        onClick={() => {
                          setTeamId(t.teamId);
                          setSelected(t.id);
                        }}
                      >
                        <span className="date-tile">
                          <small>{date(t.due).split(" ")[0]}</small>
                          {date(t.due).split(" ")[1]}
                        </span>
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {s.users.find((u) => u.id === t.ownerId)?.name}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                </section>
              </div>
            </>
          )}
          {view === "tasks" && (
            <section className="panel tasks-panel">
              <div className="task-toolbar">
                <div className="tabs">
                  {[
                    ["all", "All tasks"],
                    ["mine", "Assigned to me"],
                    ["done", "Completed"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? "selected" : ""}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="task-tools">
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search tasks"
                      placeholder="Find a task…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() => setBoard(!board)}
                  >
                    {board ? "List view" : "Board view"}
                  </button>
                </div>
              </div>
              {board ? (
                <div className="board">
                  {(["todo", "in_progress", "done"] as const).map((status) => (
                    <div key={status} className="board-column">
                      <h3>
                        <span className={`status ${status}`}>
                          <span />
                          {labels[status]}
                        </span>
                        <small>
                          {filtered.filter((t) => t.status === status).length}
                        </small>
                      </h3>
                      {filtered
                        .filter((t) => t.status === status)
                        .map((t) => (
                          <button
                            className="board-card"
                            key={t.id}
                            onClick={() => setSelected(t.id)}
                          >
                            <small>{t.checkpoint}</small>
                            <strong>{t.title}</strong>
                            {t.blocker && (
                              <span className="blocker">
                                <Flag size={12} />
                                Blocked
                              </span>
                            )}
                            <div>
                              <Avatar
                                user={s.users.find((u) => u.id === t.ownerId)}
                                small
                              />
                              <span>{date(t.due)}</span>
                            </div>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="table-head">
                    <span>Task</span>
                    <span>Status</span>
                    <span>Owner</span>
                    <span>Due date</span>
                  </div>
                  {filtered.map(taskRow)}
                </>
              )}
              {!filtered.length && (
                <div className="empty">
                  <ListTodo />
                  No tasks here yet.
                  <button
                    className="text-button"
                    onClick={() => setNewTask(true)}
                  >
                    Create a task
                  </button>
                </div>
              )}
            </section>
          )}
          {view === "team" && (
            <div className="team-grid">
              {(prof ? s.teams : [team]).filter(Boolean).map((t) => (
                <section className="panel" key={t.id}>
                  <div className="panel-title">
                    <div>
                      <h2>{t.name}</h2>
                      <p>{t.memberIds.length} people, one shared project.</p>
                    </div>
                    <span className="team-emblem">
                      <Compass size={24} />
                    </span>
                  </div>
                  {s.users
                    .filter((u) => t.memberIds.includes(u.id))
                    .map((u) => {
                      const ut = s.tasks.filter(
                          (k) => k.ownerId === u.id && k.teamId === t.id,
                        ),
                        updates = s.entries.filter(
                          (e) =>
                            e.actorId === u.id && e.kind === "contribution",
                        );
                      return (
                        <div className="member-row" key={u.id}>
                          <Avatar user={u} />
                          <div>
                            <strong>
                              {u.name}
                              {u.id === userId && (
                                <small className="you">You</small>
                              )}
                            </strong>
                            <span>
                              {ut.filter((k) => k.status === "done").length} /{" "}
                              {ut.length} assigned tasks completed
                            </span>
                          </div>
                          <span className="member-updates">
                            {updates.length} update
                            {updates.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}
                  <div className="panel-foot">
                    Counts describe recorded activity. Review the work for
                    context.
                  </div>
                  <button
                    className="panel-action"
                    onClick={() => {
                      setTeamId(t.id);
                      setView("tasks");
                    }}
                  >
                    Open team workspace
                    <ArrowRight size={16} />
                  </button>
                </section>
              ))}
            </div>
          )}
          {view === "agreement" && team && (
            <div className="agreement-grid">
              <section className="panel agreement-body">
                <div className="panel-title">
                  <div>
                    <span className="version">
                      Version {team.agreementVersion}
                    </span>
                    <h2>How we work together</h2>
                    <p>Our shared expectations for {team.name}.</p>
                  </div>
                  <FileCheck2 size={28} />
                </div>
                <div className="agreement-text">
                  {team.agreement.split("\n").map((line, i) => (
                    <p key={i}>
                      <CheckCircle2 size={19} />
                      {line}
                    </p>
                  ))}
                </div>
                {team.memberIds.includes(userId) &&
                  (team.accepted.includes(userId) ? (
                    <div className="accepted">
                      <CheckCircle2 size={20} />
                      You’ve accepted this agreement.
                    </div>
                  ) : (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        command(
                          {
                            type: "agreement.accept",
                            teamId: team.id,
                            version: team.agreementVersion,
                          },
                          "Agreement accepted",
                        )
                      }
                    >
                      <Check size={17} />
                      Accept this agreement
                    </button>
                  ))}
                {team.agreementHistory?.length ? (
                  <details className="agreement-edit">
                    <summary>Previous versions</summary>
                    {team.agreementHistory.map((h) => (
                      <div key={h.version}>
                        <h3>Version {h.version}</h3>
                        <p style={{ whiteSpace: "pre-wrap" }}>{h.body}</p>
                        <p>
                          Accepted by:{" "}
                          {h.accepted
                            .map(
                              (id) =>
                                s.users.find((u) => u.id === id)?.name ||
                                "Former member",
                            )
                            .join(", ") || "No acceptances recorded"}
                        </p>
                      </div>
                    ))}
                  </details>
                ) : null}
                <details className="agreement-edit">
                  <summary>Update our agreement</summary>
                  <p>
                    Publishing a new version asks every member to accept again.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      if (
                        confirm(
                          "Publish a new agreement version? Everyone will need to accept again.",
                        )
                      )
                        await command(
                          {
                            type: "agreement.publish",
                            version: team.agreementVersion,
                            teamId: team.id,
                            body: f.get("body"),
                          },
                          "New agreement published",
                        );
                    }}
                  >
                    <textarea
                      name="body"
                      aria-label="Agreement text"
                      defaultValue={team.agreement}
                      required
                      maxLength={12000}
                    />
                    <button className="secondary" disabled={busy}>
                      Publish new version
                    </button>
                  </form>
                </details>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>On the same page</h2>
                    <p>
                      {team.accepted.length} of {members.length} members
                      accepted
                    </p>
                  </div>
                </div>
                {members.map((u) => (
                  <div className="member-row" key={u.id}>
                    <Avatar user={u} />
                    <div>
                      <strong>{u.name}</strong>
                      <span>
                        {team.accepted.includes(u.id)
                          ? "Accepted current version"
                          : "Awaiting acceptance"}
                      </span>
                    </div>
                    {team.accepted.includes(u.id) ? (
                      <CheckCircle2 className="green-icon" size={19} />
                    ) : (
                      <Clock3 size={18} />
                    )}
                  </div>
                ))}
              </section>
            </div>
          )}
          {view === "activity" && (
            <section className="panel activity-panel">
              <div className="panel-title">
                <div>
                  <h2>Every step has a story</h2>
                  <p>Changes and contributions in {team?.name}.</p>
                </div>
                <Activity size={21} />
              </div>
              {s.events
                .filter((e) => e.teamId === team?.id)
                .map((e) => (
                  <div className="event-row" key={e.id}>
                    <Avatar
                      user={s.users.find((u) => u.id === e.actorId)}
                      small
                    />
                    <div>
                      <strong>
                        {s.users.find((u) => u.id === e.actorId)?.name}
                      </strong>
                      <p>{e.body}</p>
                    </div>
                    <time>
                      {new Date(e.at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
              {!s.events.length && (
                <div className="empty">
                  Your team’s activity will appear here.
                </div>
              )}
            </section>
          )}
          <footer className="workspace-footer">
            <span>
              <Layers size={14} />
              Made for better teamwork.
            </span>
            <span>
              {dismissed && (
                <button
                  className="text-button"
                  onClick={() => {
                    setDismissed(false);
                    store("remove");
                  }}
                >
                  Bring back Pip
                </button>
              )}
              TeamTrack <span className="dot">·</span>{" "}
              {namespace === "demo" ? "Class demo" : "Canvas course"}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {!dismissed && (
        <div
          className="companion-wrap"
          onKeyDown={(e) => {
            if (e.key === "Escape") setCompanion(false);
          }}
        >
          {companion && (
            <div
              className="companion-pop"
              role="dialog"
              aria-label="Pip, your TeamTrack guide"
            >
              <button
                className="close"
                aria-label="Hide Pip"
                title="Hide Pip (you can bring Pip back from the footer)"
                onClick={() => {
                  setDismissed(true);
                  setCompanion(false);
                  store("set");
                }}
              >
                <X size={14} />
              </button>
              <strong>Hey, I’m Pip.</strong>
              <p>
                {prof
                  ? "Here’s where a little support could help right now."
                  : "A few small steps to keep your team moving."}
              </p>
              <ul className="pip-list">
                {guide.map((g) => (
                  <li key={g.label} className={g.done ? "done" : ""}>
                    <button
                      onClick={() => {
                        setView(g.view);
                        if (g.filter) setFilter(g.filter);
                        setCompanion(false);
                      }}
                    >
                      <span className="pip-check" aria-hidden="true">
                        {g.done && <Check size={11} />}
                      </span>
                      <span>
                        {g.label}
                        <span className="sr-only">
                          {g.done ? " (done)" : " (to do)"}
                        </span>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <small className="pip-foot">
                Pip only reads what your team records. Nothing here is graded.
              </small>
            </div>
          )}
          <button
            className={`companion ${companion ? "open" : ""}`}
            onClick={() => setCompanion(!companion)}
            aria-label={
              companion ? "Close Pip" : "Open Pip, your TeamTrack guide"
            }
            aria-expanded={companion}
          >
            <CompanionModel active={companion} />
            {!companion && guide.some((g) => !g.done) && (
              <span className="pip-badge" aria-hidden="true">
                {guide.filter((g) => !g.done).length}
              </span>
            )}
          </button>
        </div>
      )}
      {task && (
        <TaskDrawer
          key={task.id}
          error={error}
          task={task}
          s={s}
          userId={userId}
          busy={busy}
          onClose={() => setSelected(null)}
          command={command}
        />
      )}
      {newTask && (
        <Modal
          error={error}
          title="A new step forward"
          subtitle="Give the work a clear owner and a little context."
          onClose={() => setNewTask(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await command(
                  {
                    type: "task.create",
                    teamId: team?.id,
                    title: f.get("title"),
                    description: f.get("description"),
                    ownerId: f.get("owner"),
                    due: f.get("due"),
                    checkpoint: f.get("checkpoint"),
                  },
                  "Task created",
                )
              )
                setNewTask(false);
            }}
          >
            <label>
              Task name
              <input
                name="title"
                placeholder="What needs to happen?"
                required
                maxLength={120}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                placeholder="Help your team understand the work."
                maxLength={4000}
              />
            </label>
            <div className="form-grid">
              <label>
                Owner
                <select name="owner">
                  {members.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input name="due" type="date" required defaultValue={today()} />
              </label>
            </div>
            <label>
              Checkpoint
              <select name="checkpoint">
                {(
                  s.checkpoints?.map((c) => c.title) || [
                    "Discover",
                    "Define",
                    "Prototype",
                    "Share",
                  ]
                ).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setNewTask(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Create task
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {newTeam && (
        <Modal
          error={error}
          title="Bring a team together"
          subtitle="Choose students who aren’t already assigned."
          onClose={() => setNewTeam(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await command(
                  {
                    type: "team.create",
                    name: f.get("name"),
                    memberIds: f.getAll("members"),
                  },
                  "Team created",
                )
              )
                setNewTeam(false);
            }}
          >
            <label>
              Team name
              <input name="name" required maxLength={120} />
            </label>
            {s.users
              .filter(
                (u) =>
                  u.role === "student" &&
                  !s.teams.some((t) => t.memberIds.includes(u.id)),
              )
              .map((u) => (
                <label className="checkbox-label" key={u.id}>
                  <input type="checkbox" name="members" value={u.id} />
                  {u.name}
                </label>
              ))}
            {!s.users.some(
              (u) =>
                u.role === "student" &&
                !s.teams.some((t) => t.memberIds.includes(u.id)),
            ) && <p>All enrolled students are already in a team.</p>}
            <button
              className="primary"
              disabled={
                busy ||
                !s.users.some(
                  (u) =>
                    u.role === "student" &&
                    !s.teams.some((t) => t.memberIds.includes(u.id)),
                )
              }
            >
              Create team
            </button>
          </form>
        </Modal>
      )}
      {editProject && (
        <Modal
          error={error}
          title="Project brief"
          subtitle="Keep everyone focused on the shared goal."
          onClose={() => setEditProject(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await command({
                  type: "project.update",
                  title: f.get("title"),
                  description: f.get("description"),
                })
              )
                setEditProject(false);
            }}
          >
            <label>
              Project title
              <input
                name="title"
                defaultValue={s.project}
                required
                maxLength={120}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={s.description}
                required
                maxLength={4000}
              />
            </label>
            <button className="primary" disabled={busy}>
              Save project
            </button>
          </form>
          <div className="checkpoint-editor">
            <h3>Project checkpoints</h3>
            {s.checkpoints?.map((cp) => (
              <p key={cp.id}>
                {cp.title}
                <span>{date(cp.due)}</span>
              </p>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (
                  await command(
                    {
                      type: "checkpoint.create",
                      title: f.get("checkpointTitle"),
                      due: f.get("checkpointDue"),
                    },
                    "Checkpoint created",
                  )
                )
                  form.reset();
              }}
            >
              <div className="form-grid">
                <label>
                  New checkpoint
                  <input
                    name="checkpointTitle"
                    required
                    maxLength={120}
                    placeholder="Pilot review"
                  />
                </label>
                <label>
                  Due date
                  <input name="checkpointDue" type="date" required />
                </label>
              </div>
              <button className="secondary" disabled={busy}>
                Add checkpoint
              </button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Modal({
  error,
  title,
  subtitle,
  onClose,
  children,
}: {
  error?: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} aria-label={title}>
      <button className="close" onClick={onClose} aria-label="Close dialog">
        <X size={20} />
      </button>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}
function TaskDrawer({
  error,
  task,
  s,
  userId,
  busy,
  onClose,
  command,
}: {
  error?: string;
  task: Task;
  s: State;
  userId: string;
  busy: boolean;
  onClose: () => void;
  command: (c: Command, m?: string) => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [body, setBody] = useState(""),
    [url, setUrl] = useState(""),
    [kind, setKind] = useState("contribution"),
    [blocker, setBlocker] = useState(task.blocker);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="drawer"
      ref={ref}
      onCancel={onClose}
      aria-label={task.title}
    >
      <div className="drawer-top">
        <span>
          {task.checkpoint}
          <ChevronRight size={14} />
          Task details
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close task"
        >
          <X size={21} />
        </button>
      </div>
      <div className="drawer-content">
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <h2>{task.title}</h2>
        <p className="description">{task.description}</p>
        <details className="task-history">
          <summary>Edit task details</summary>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              await command({
                type: "task.update",
                id: task.id,
                version: task.version,
                title: f.get("title"),
                description: f.get("description"),
                due: f.get("due"),
              });
            }}
          >
            <label>
              Task title
              <input
                name="title"
                defaultValue={task.title}
                required
                maxLength={120}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={task.description}
                required
                maxLength={4000}
              />
            </label>
            <label>
              Due date
              <input name="due" type="date" defaultValue={task.due} required />
            </label>
            <button className="secondary" disabled={busy}>
              Save task details
            </button>
          </form>
        </details>
        <div className="task-properties">
          <label>
            Status
            <select
              disabled={busy}
              value={task.status}
              onChange={(e) =>
                command(
                  {
                    type: "task.update",
                    id: task.id,
                    version: task.version,
                    status: e.target.value,
                  },
                  "Task status updated",
                )
              }
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Owner
            <select
              disabled={busy}
              value={task.ownerId}
              onChange={(e) =>
                command({
                  type: "task.update",
                  id: task.id,
                  version: task.version,
                  ownerId: e.target.value,
                })
              }
            >
              {s.users
                .filter((u) =>
                  s.teams
                    .find((t) => t.id === task.teamId)
                    ?.memberIds.includes(u.id),
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <div>
            <span>Due date</span>
            <strong>
              <CalendarDays size={16} />
              {date(task.due)}
            </strong>
          </div>
        </div>
        <div className="blocker-box">
          <h3>
            <Flag size={16} />
            Anything in the way?
          </h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command(
                {
                  type: "task.update",
                  id: task.id,
                  version: task.version,
                  blocker,
                },
                blocker ? "Blocker recorded" : "Blocker cleared",
              );
            }}
          >
            <input
              aria-label="Blocker explanation"
              placeholder="Raise a blocker, or leave blank if all clear."
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              maxLength={4000}
            />
            <button className="secondary" disabled={busy}>
              Save
            </button>
          </form>
        </div>
        <div className="evidence-heading">
          <h3>Work, with context</h3>
          <span>
            <Link2 size={14} />
            Visible to your team & instructor
          </span>
        </div>
        <form
          className="update-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await command(
                {
                  type:
                    kind === "contribution"
                      ? "contribution.add"
                      : "comment.add",
                  taskId: task.id,
                  body,
                  url,
                },
                kind === "contribution"
                  ? "Contribution recorded"
                  : "Comment added",
              )
            ) {
              setBody("");
              setUrl("");
            }
          }}
        >
          <div className="tabs">
            <button
              type="button"
              className={kind === "contribution" ? "selected" : ""}
              onClick={() => setKind("contribution")}
            >
              Contribution
            </button>
            <button
              type="button"
              className={kind === "comment" ? "selected" : ""}
              onClick={() => setKind("comment")}
            >
              Comment
            </button>
          </div>
          <textarea
            aria-label="Contribution or comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              kind === "contribution"
                ? "What did you work on? What did you learn?"
                : "Share a thought or help your teammate."
            }
            required
            maxLength={4000}
          />
          {kind === "contribution" && (
            <label className="evidence-url">
              <Link2 size={16} />
              <input
                aria-label="Evidence link"
                type="url"
                placeholder="Evidence link (optional, https://…)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          )}
          <div className="update-bottom">
            <small>
              Attributed to {s.users.find((u) => u.id === userId)?.name}
            </small>
            <button className="primary" disabled={busy || !body.trim()}>
              Share update
              <ArrowUpRight size={15} />
            </button>
          </div>
        </form>
        <div className="entries">
          {s.entries
            .filter((e) => e.taskId === task.id)
            .map((e) => (
              <article key={e.id} className="entry">
                <Avatar user={s.users.find((u) => u.id === e.actorId)} small />
                <div>
                  <header>
                    <strong>
                      {s.users.find((u) => u.id === e.actorId)?.name}
                    </strong>
                    <span>
                      {e.kind === "contribution" ? "Contribution" : "Comment"}
                    </span>
                  </header>
                  <p>{e.body}</p>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                      <Link2 size={14} />
                      View supporting work
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <time>{new Date(e.at).toLocaleString()}</time>
                  {e.actorId === userId && (
                    <details className="task-history">
                      <summary>Correct this update</summary>
                      <form
                        onSubmit={async (ev) => {
                          ev.preventDefault();
                          const f = new FormData(ev.currentTarget);
                          await command(
                            {
                              type: "contribution.update",
                              id: e.id,
                              version: e.version || 1,
                              body: f.get("body"),
                            },
                            "Correction saved with history",
                          );
                        }}
                      >
                        <textarea
                          name="body"
                          aria-label="Corrected update"
                          defaultValue={e.body}
                          required
                          maxLength={4000}
                        />
                        <button className="secondary" disabled={busy}>
                          Save correction
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              </article>
            ))}
        </div>
        <details className="task-history">
          <summary>Task history</summary>
          {s.events
            .filter((e) => e.entityId === task.id)
            .map((e) => (
              <p key={e.id}>
                {s.users.find((u) => u.id === e.actorId)?.name}: {e.body}
              </p>
            ))}
        </details>
      </div>
    </dialog>
  );
}

// Storage can be blocked in third-party iframes (e.g. inside Canvas).
function store(op: "get" | "set" | "remove") {
  try {
    const key = "tt-companion-dismissed";
    if (op === "get") return localStorage.getItem(key);
    if (op === "set") localStorage.setItem(key, "yes");
    else localStorage.removeItem(key);
  } catch {}
  return null;
}
