"use client";
import { today } from "@/lib/dates";
import { Fragment, useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MemberBreakdown,
  mixLabel,
  StatusBar,
  TeamMenu,
  TeamProgressChart,
} from "@/components/insights";
import { courseProgress, memberBreakdown, teamHealth } from "@/lib/insights";
import { Doodles } from "@/components/doodles";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Folder } from "@/components/folder";
import {
  AuthPanel,
  Onboarding,
  type Account,
  type WorkspaceSummary,
} from "@/components/onboarding";
import {
  CountUp,
  Ring,
  useMotionGate,
  useSpotlight,
} from "@/components/motion";
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
  MoreHorizontal,
  ExternalLink,
  Compass,
  CalendarDays,
  AlertCircle,
  PanelLeftClose,
  UserPlus,
  Copy,
  Trash2,
  Settings2,
  ChevronsUpDown,
  KeyRound,
} from "lucide-react";
import type { State, Task, User, Command } from "@/lib/types";
import { attention, isGroup, leaderOf } from "@/lib/domain";
type View = "overview" | "tasks" | "team" | "agreement" | "activity";
type OpenTeam = { id: string; name: string; size: number };
const labels = { todo: "To do", in_progress: "In progress", done: "Done" };
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
    [cheer, setCheer] = useState(0),
    [dismissed, setDismissed] = useState(false),
    [account, setAccount] = useState<Account | null>(null),
    [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]),
    [openTeams, setOpenTeams] = useState<OpenTeam[]>([]),
    [adding, setAdding] = useState(false),
    [invite, setInvite] = useState(""),
    [inviteOpen, setInviteOpen] = useState(false),
    [manage, setManage] = useState<string | null>(null),
    [passwordOpen, setPasswordOpen] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [menu, setMenu] = useState(false);
  // One place that takes a /api/workspace payload apart.
  function load(d: {
    state: State | null;
    userId?: string;
    csrf: string;
    namespace?: string;
    account?: Account;
    workspaces?: WorkspaceSummary[];
    openTeams?: OpenTeam[];
  }) {
    setS(d.state);
    setCsrf(d.csrf);
    setAccount(d.account || null);
    setWorkspaces(d.workspaces || []);
    setOpenTeams(d.openTeams || []);
    if (d.userId) setUserId(d.userId);
    setNamespace(d.namespace || "");
    if (d.state)
      setTeamId((t) =>
        d.state!.teams.some((x) => x.id === t)
          ? t
          : d.state!.teams[0]?.id || "",
      );
  }
  async function refresh() {
    try {
      const r = await fetch("/api/workspace");
      if (r.ok) load(await r.json());
      else {
        setS(null);
        setAccount(null);
      }
    } catch {
      setError("Cannot connect. Please retry.");
    } finally {
      setLoading(false);
    }
  }
  // After signing in: an invite link joins that workspace straight away.
  async function afterAuth() {
    const code = invite;
    if (code) {
      const me = await (await fetch("/api/workspace")).json();
      const r = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": me.csrf,
        },
        body: JSON.stringify({ action: "join", code }),
      });
      if (r.ok) {
        setInvite("");
        history.replaceState(null, "", "/");
      } else
        setError(
          (await r.json().catch(() => ({}))).error ||
            "Could not join that workspace.",
        );
    }
    setAdding(false);
    setView("overview");
    setSelected(null);
    await refresh();
  }
  async function switchTo(ns: string) {
    setSwitcher(false);
    setMenu(false);
    if (ns === namespace) return;
    const r = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ action: "switch", namespace: ns }),
    });
    if (!r.ok) return setError("Could not open that workspace.");
    setView("overview");
    setSelected(null);
    await refresh();
  }
  function signOut() {
    void fetch("/api/auth/logout", { method: "POST" });
    setS(null);
    setAccount(null);
    setAdding(false);
    setError("");
  }
  useSpotlight();
  useMotionGate();
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("join");
    fetch("/api/workspace")
      .then(async (r) => {
        if (code) setInvite(code.toUpperCase());
        if (r.ok) {
          const d = await r.json();
          load(d);
          // Signed in already and opened someone's invite link: offer to join.
          if (code && d.account && d.state) setAdding(true);
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
  // Menus close on a click elsewhere or Escape.
  useEffect(() => {
    if (!menu && !switcher) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !(e.target as Element).closest(".account-wrap, .course-switch-wrap")
      ) {
        setMenu(false);
        setSwitcher(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu, switcher]);
  // Teammates' changes show up without a reload.
  useEffect(() => {
    if (!s) return;
    const id = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !document.querySelector("dialog[open]")
      )
        void refresh();
    }, 30000);
    return () => clearInterval(id);
  }, [!!s]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
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
      if (d.openTeams) setOpenTeams(d.openTeams);
      setToast(message);
      setCheer((n) => n + 1);
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
          <Logo size={30} />
          TeamTrack
        </div>
        <span className="spinner" />
        Opening your workspace…
      </main>
    );
  if (account && (!s || adding))
    return (
      <Onboarding
        account={account}
        workspaces={workspaces}
        csrf={csrf}
        invite={invite}
        onDone={afterAuth}
        onBack={s ? () => setAdding(false) : undefined}
        onSignOut={signOut}
      />
    );
  if (!s)
    return (
      <main className="welcome">
        <section className="welcome-story">
          <Doodles variant="welcome" />
          <div className="brand">
            <Logo size={30} />
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
          <div className="welcome-theme">
            <ThemeToggle />
          </div>
          <AuthPanel invite={invite} onDone={afterAuth} />
        </section>
      </main>
    );
  const me = s.users.find((u) => u.id === userId)!,
    prof = me.role === "instructor",
    organizer = prof || !!me.owner,
    group = isGroup(s),
    noTeam = !prof && !s.teams.some((t) => t.memberIds.includes(userId)),
    unassigned = s.users.filter(
      (u) =>
        u.role === "student" &&
        u.active !== false &&
        !s.teams.some((t) => t.memberIds.includes(u.id)),
    ),
    team = s.teams.find((t) => t.id === teamId) || s.teams[0],
    tasks = s.tasks.filter((t) => t.teamId === team?.id),
    all = prof ? s.tasks : tasks,
    done = all.filter((t) => t.status === "done").length,
    blocked = all.filter((t) => t.blocker && t.status !== "done").length,
    task = s.tasks.find((t) => t.id === selected),
    members = s.users.filter((u) => team?.memberIds.includes(u.id)),
    leadId = team ? leaderOf(s, team) : undefined,
    leadName = s.users.find((u) => u.id === leadId)?.name || "your team leader",
    proposal = team?.proposal,
    mustVote =
      !!proposal &&
      !!team?.memberIds.includes(userId) &&
      !proposal.approvals.includes(userId),
    filtered = tasks.filter(
      (t) =>
        (filter === "all" ||
          (filter === "mine" && t.ownerId === userId) ||
          filter === t.status) &&
        t.title.toLowerCase().includes(query.toLowerCase()),
    );
  // Open tasks peeking out of a team's folder.
  const openSheets = (id: string) =>
    s.tasks
      .filter((t) => t.teamId === id && t.status !== "done")
      .slice(0, 3)
      .map((t) => ({
        title: t.title,
        meta: s.users.find((u) => u.id === t.ownerId)?.name.split(" ")[0],
      }));
  const nav = [
    {
      id: "overview",
      name: prof ? "Course overview" : "Overview",
      short: "Home",
      icon: LayoutDashboard,
    },
    { id: "tasks", name: "Tasks", short: "Tasks", icon: ListTodo },
    {
      id: "team",
      name: prof ? "Teams & people" : "My team",
      short: prof ? "Teams" : "Team",
      icon: Users,
    },
    {
      id: "agreement",
      name: "Team agreement",
      short: "Agreement",
      icon: FileCheck2,
    },
    { id: "activity", name: "Activity", short: "Activity", icon: Activity },
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
      : noTeam
        ? [
            {
              label: "Join or start a team",
              done: false,
              view: "team",
            },
          ]
        : [
            ...(mustVote
              ? [
                  {
                    label: "Vote on the proposed agreement",
                    done: false,
                    view: "agreement" as const,
                  },
                ]
              : []),
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
  const todoCount = guide.filter((g) => !g.done).length;
  const pipPanel = (
    <>
      <button
        className="close"
        aria-label="Close Pip's panel"
        onClick={() => setCompanion(false)}
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
      <button
        className="text-button pip-hide"
        onClick={() => {
          setDismissed(true);
          setCompanion(false);
          store("set");
        }}
      >
        Hide Pip (bring it back from the footer)
      </button>
    </>
  );
  const title: [string, string, string] =
    view === "overview"
      ? prof
        ? ["Every team. One ", "clear", " view."]
        : [
            `Good ${new Date().getHours() < 12 ? "morning" : "evening"}, `,
            me.name.split(" ")[0],
            ".",
          ]
      : view === "tasks"
        ? ["Make room for ", "good work", "."]
        : view === "team"
          ? prof
            ? ["The people behind ", "the project", "."]
            : ["Better, ", "together", "."]
          : view === "agreement"
            ? ["Start on the ", "same page", "."]
            : ["The story of ", "your work", "."];
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
          <Logo size={30} />
          TeamTrack
        </Link>
        <div className="course-switch-wrap">
          <button
            className="course-switch"
            disabled={!account}
            aria-expanded={account ? switcher : undefined}
            onClick={() => setSwitcher(!switcher)}
          >
            <GraduationCap size={20} />
            <div>
              <strong>
                {namespace === "demo" ? "Product development" : s.project}
              </strong>
              <small>
                {namespace === "demo" ? "Fall 2026 · CSS 474" : s.course}
              </small>
            </div>
            {account && <ChevronsUpDown size={15} />}
          </button>
          {switcher && account && (
            <div className="switcher" role="menu">
              {workspaces.map((w) => (
                <button
                  key={w.namespace}
                  role="menuitem"
                  className={w.namespace === namespace ? "current" : ""}
                  onClick={() => switchTo(w.namespace)}
                >
                  <strong>{w.project}</strong>
                  <small>{w.course}</small>
                  {w.namespace === namespace && <Check size={14} />}
                </button>
              ))}
              <button
                role="menuitem"
                className="switcher-add"
                onClick={() => {
                  setSwitcher(false);
                  setAdding(true);
                }}
              >
                <Plus size={14} />
                Create or join another
              </button>
            </div>
          )}
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
                setCompanion(false);
                setQuery("");
              }}
            >
              <n.icon size={19} />
              {n.name}
              <span className="nav-short" aria-hidden="true">
                {n.short}
              </span>
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
              <small>
                {prof ? "Instructor" : me.owner ? "Organizer" : "Student"}
              </small>
            </div>
            {account && (
              <button
                title="Change password"
                aria-label="Change password"
                onClick={() => setPasswordOpen(true)}
              >
                <KeyRound size={16} />
              </button>
            )}
            <button title="Sign out" aria-label="Sign out" onClick={signOut}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <Doodles variant="band" />
        <header className="topbar">
          <div className="breadcrumb">
            <span>{s.course}</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.name}</strong>
          </div>
          <div className="top-actions">
            {s.inviteCode ? (
              <button
                className="secondary invite-button"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus size={15} />
                Invite
              </button>
            ) : (
              <span className="demo-badge">
                <span />
                {s.integration ? "LMS connected" : "Class demo"}
              </span>
            )}
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
            <ThemeToggle />
            <div className="account-wrap">
              <button
                className="account-button"
                aria-label="Account and workspaces"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <Avatar user={me} small />
              </button>
              {menu && (
                <div className="account-menu" role="menu">
                  <div className="account-head">
                    <Avatar user={me} />
                    <div>
                      <strong>{me.name}</strong>
                      <small>
                        {account?.email || (prof ? "Instructor" : "Student")}
                      </small>
                    </div>
                  </div>
                  {account && (
                    <>
                      <span className="menu-label">Workspaces</span>
                      {workspaces.map((w) => (
                        <button
                          key={w.namespace}
                          role="menuitem"
                          className={w.namespace === namespace ? "current" : ""}
                          onClick={() => switchTo(w.namespace)}
                        >
                          <GraduationCap size={15} />
                          <span>
                            {w.project}
                            <small>{w.course}</small>
                          </span>
                          {w.namespace === namespace && <Check size={14} />}
                        </button>
                      ))}
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenu(false);
                          setAdding(true);
                        }}
                      >
                        <Plus size={15} />
                        <span>Create or join another</span>
                      </button>
                      <hr />
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenu(false);
                          setPasswordOpen(true);
                        }}
                      >
                        <KeyRound size={15} />
                        <span>Change password</span>
                      </button>
                    </>
                  )}
                  <button role="menuitem" onClick={signOut}>
                    <LogOut size={15} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
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
                {title[0]}
                <em className="accent">{title[1]}</em>
                {title[2]}
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
            {view === "overview" && !dismissed && (
              <div
                className="hero-pip"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCompanion(false);
                }}
              >
                <button
                  className="pip-bubble"
                  aria-expanded={companion}
                  onClick={() => setCompanion(!companion)}
                >
                  {todoCount
                    ? `${todoCount} thing${todoCount === 1 ? "" : "s"} worth a look`
                    : "You’re all caught up"}
                  <ChevronRight size={15} />
                </button>
                <button
                  className="hero-pip-model"
                  aria-label={
                    companion ? "Close Pip" : "Open Pip, your TeamTrack guide"
                  }
                  aria-expanded={companion}
                  onClick={() => setCompanion(!companion)}
                >
                  <CompanionModel
                    hero
                    active={companion}
                    cheer={cheer}
                    attention={todoCount > 0}
                  />
                </button>
                {companion && (
                  <div
                    className="companion-pop in-band"
                    role="dialog"
                    aria-label="Pip, your TeamTrack guide"
                  >
                    {pipPanel}
                  </div>
                )}
              </div>
            )}
            {prof && !s.teams.length && view !== "team" ? (
              <button className="primary" onClick={() => setNewTeam(true)}>
                <Plus size={17} />
                Create team
              </button>
            ) : noTeam && view !== "team" ? (
              <button className="primary" onClick={() => setView("team")}>
                <Users size={17} />
                Find your team
              </button>
            ) : view === "tasks" || view === "overview" ? (
              <button
                className="primary"
                disabled={!team || !team.memberIds.length}
                title={
                  team && !team.memberIds.length
                    ? "Add members to this team first"
                    : undefined
                }
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
          {prof && s.integration && (
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
                  command({ type: "roster.sync" }, "Course roster synchronized")
                }
              >
                <RefreshCw size={14} />
                Sync course roster
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
                  Project <span className="dot">·</span> Due {date(s.due)}
                </span>
              </div>
            </div>
            <div className="project-right">
              <div
                className="avatar-stack"
                hidden={prof && (view === "overview" || view === "team")}
              >
                {members.map((u) => (
                  <Avatar key={u.id} user={u} small />
                ))}
              </div>
              {prof && (view === "overview" || view === "team") ? (
                <span className="team-label">
                  All teams <span className="dot">·</span> {s.teams.length}
                </span>
              ) : prof && s.teams.length > 1 ? (
                <TeamMenu
                  teams={s.teams}
                  value={team?.id || ""}
                  onChange={setTeamId}
                />
              ) : team ? (
                <span className="team-label">{team.name}</span>
              ) : null}
              {organizer && (
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
          <div className="view-enter" key={view}>
            {view === "overview" && (
              <>
                <div className="stats">
                  <div className="hero-stat">
                    <Ring pct={all.length ? (done / all.length) * 100 : 0} />
                    <div>
                      <span>Work completed</span>
                      <strong>
                        <CountUp value={done} />
                        <small> / {all.length}</small>
                      </strong>
                      <small>
                        {all.length ? Math.round((done / all.length) * 100) : 0}
                        % of recorded tasks
                      </small>
                    </div>
                  </div>
                  <div>
                    <span>
                      Moving forward
                      <i className="stat-icon blue">
                        <Clock3 size={17} />
                      </i>
                    </span>
                    <strong>
                      <CountUp
                        value={
                          all.filter((t) => t.status === "in_progress").length
                        }
                      />
                    </strong>
                    <small>Tasks currently in progress</small>
                  </div>
                  <div className={blocked ? "alert-stat" : ""}>
                    <span>
                      Needs a hand
                      <i className="stat-icon amber">
                        <Flag size={17} />
                      </i>
                    </span>
                    <strong>
                      <CountUp value={blocked} />
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
                      <i className="stat-icon cream">
                        <Users size={17} />
                      </i>
                    </span>
                    <strong>
                      <CountUp
                        value={
                          (prof ? s.teams.length : team?.accepted.length) || 0
                        }
                      />
                      <small>
                        {prof || !team ? "" : ` / ${team.memberIds.length}`}
                      </small>
                    </strong>
                    <small>
                      {prof
                        ? "Working toward a shared goal"
                        : team
                          ? "Members have accepted this version"
                          : "Join a team to see its agreement"}
                    </small>
                  </div>
                </div>
                {prof && s.teams.length > 0 && (
                  <TeamProgressChart
                    rows={courseProgress(s, today())}
                    onOpen={(id) => {
                      setTeamId(id);
                      setView("tasks");
                    }}
                  />
                )}
                <div className="overview-grid">
                  <section className="panel main-panel">
                    <div className="panel-title">
                      <div>
                        <h2>
                          {prof ? "Teams at a glance" : "Your next steps"}
                        </h2>
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
                    {prof && !s.teams.length ? (
                      <div className="empty">
                        <Users />
                        {s.users.some((u) => u.role === "student")
                          ? "Students have joined. Put them into teams."
                          : "No students yet. Share your invite code to bring them in."}
                        <span className="empty-actions">
                          {s.inviteCode && (
                            <button
                              className="secondary"
                              onClick={() => setInviteOpen(true)}
                            >
                              <UserPlus size={15} />
                              Invite students
                            </button>
                          )}
                          <button
                            className="primary"
                            onClick={() => setNewTeam(true)}
                          >
                            <Plus size={15} />
                            Create a team
                          </button>
                        </span>
                      </div>
                    ) : noTeam ? (
                      <div className="empty">
                        <Users />
                        You’re not on a team yet. Join yours or start one.
                        <button
                          className="primary"
                          onClick={() => setView("team")}
                        >
                          Find your team
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    ) : prof ? (
                      <div className="team-overview team-folders">
                        {s.teams.map((t) => {
                          const h = teamHealth(s, t, today()),
                            reasons = [
                              h.blocked && `${h.blocked} blocked`,
                              h.overdue && `${h.overdue} overdue`,
                              h.pendingAgreement &&
                                `${h.pendingAgreement} agreement pending`,
                            ].filter(Boolean) as string[];
                          return (
                            <button
                              key={t.id}
                              className="folder-tile"
                              onClick={() => {
                                setTeamId(t.id);
                                setView("tasks");
                              }}
                            >
                              <Folder inline sheets={openSheets(t.id)}>
                                <span className="folder-head">
                                  <strong>{t.name}</strong>
                                  <span className="avatar-stack">
                                    {s.users
                                      .filter((u) => t.memberIds.includes(u.id))
                                      .slice(0, 4)
                                      .map((u) => (
                                        <Avatar key={u.id} user={u} small />
                                      ))}
                                  </span>
                                </span>
                                <span className="folder-count">
                                  <b>{h.done}</b> / {h.total} tasks done
                                  <span className="dot">·</span>
                                  {t.memberIds.length} members
                                </span>
                                <StatusBar mix={h} label={mixLabel(h)} />
                                <span className="reason-chips">
                                  {reasons.length ? (
                                    reasons.map((r) => (
                                      <span key={r} className="attention-tag">
                                        {r}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="clear-tag">On track</span>
                                  )}
                                </span>
                              </Folder>
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
                        {!tasks.length ? (
                          <div className="empty">
                            <ListTodo />
                            No tasks yet. Break the project into a few first
                            steps.
                            <button
                              className="primary"
                              onClick={() => setNewTask(true)}
                            >
                              <Plus size={15} />
                              Add the first task
                            </button>
                          </div>
                        ) : (
                          !tasks.some((t) => t.status !== "done") && (
                            <div className="empty">
                              <CheckCircle2 />
                              You’re all caught up. Nice work.
                            </div>
                          )
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
                    {namespace === "demo" ? (
                      <h2>
                        Find the friction.
                        <br />
                        Make the path clearer.
                      </h2>
                    ) : (
                      <h2>{s.project}</h2>
                    )}
                    <p>{s.description}</p>
                    <CheckpointTrack checkpoints={s.checkpoints || []} />
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
                    {(["todo", "in_progress", "done"] as const).map(
                      (status) => (
                        <div key={status} className="board-column">
                          <h3>
                            <span className={`status ${status}`}>
                              <span />
                              {labels[status]}
                            </span>
                            <small>
                              {
                                filtered.filter((t) => t.status === status)
                                  .length
                              }
                            </small>
                          </h3>
                          {filtered
                            .filter((t) => t.status === status)
                            .map((t) => (
                              <button
                                className={`board-card ${t.status}`}
                                key={t.id}
                                onClick={() => setSelected(t.id)}
                              >
                                <small>{t.checkpoint}</small>
                                <strong>{t.title}</strong>
                                {t.blocker && t.status !== "done" && (
                                  <span className="blocker">
                                    <Flag size={12} />
                                    Blocked
                                  </span>
                                )}
                                <div>
                                  <Avatar
                                    user={s.users.find(
                                      (u) => u.id === t.ownerId,
                                    )}
                                    small
                                  />
                                  <span
                                    className={`due-chip ${t.status !== "done" && t.due < today() ? "overdue" : ""}`}
                                  >
                                    {date(t.due)}
                                  </span>
                                </div>
                              </button>
                            ))}
                        </div>
                      ),
                    )}
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
            {view === "team" && noTeam && (
              <div className={`join-team ${group ? "single" : ""}`}>
                {/* A group workspace has one team: join it, or name it if nobody has yet. */}
                {(!group || openTeams.length > 0) && (
                  <section className="panel">
                    <div className="panel-title">
                      <div>
                        <h2>Join your team</h2>
                        <p>
                          {group
                            ? "This workspace is for one team. Join it to see its tasks and agreement."
                            : openTeams.length
                              ? "Pick the team you’re working with."
                              : "No teams yet. Start one and your teammates can join it."}
                        </p>
                      </div>
                      <Users size={21} />
                    </div>
                    {openTeams.map((t) => (
                      <div className="member-row" key={t.id}>
                        <span className="team-emblem small">
                          <Compass size={16} />
                        </span>
                        <div>
                          <strong>{t.name}</strong>
                          <span>
                            {t.size} member{t.size === 1 ? "" : "s"}
                          </span>
                        </div>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              await command(
                                { type: "team.join", teamId: t.id },
                                `Welcome to ${t.name}`,
                              )
                            ) {
                              await refresh();
                              setView("overview");
                            }
                          }}
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </section>
                )}
                {(!group || !openTeams.length) && (
                  <section className="panel">
                    <div className="panel-title">
                      <div>
                        <h2>{group ? "Name your team" : "Start a new team"}</h2>
                        <p>
                          {group
                            ? "Everyone you invite joins this team automatically."
                            : "You’ll be its first member. Share the invite code so others can join."}
                        </p>
                      </div>
                      <Plus size={21} />
                    </div>
                    <form
                      className="inline-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        if (
                          await command(
                            { type: "team.create", name: f.get("name") },
                            "Team started",
                          )
                        ) {
                          await refresh();
                          setView("overview");
                        }
                      }}
                    >
                      <label>
                        Team name
                        <input
                          name="name"
                          required
                          maxLength={120}
                          placeholder="The Debuggers"
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        Start team
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  </section>
                )}
              </div>
            )}
            {view === "team" && prof && !s.teams.length && (
              <section className="panel">
                <div className="empty">
                  <Users />
                  No teams yet.{" "}
                  {unassigned.length
                    ? `${unassigned.length} student${unassigned.length === 1 ? " is" : "s are"} waiting for one.`
                    : "Invite students, then group them, or let them start their own."}
                  <span className="empty-actions">
                    {s.inviteCode && (
                      <button
                        className="secondary"
                        onClick={() => setInviteOpen(true)}
                      >
                        <UserPlus size={15} />
                        Invite students
                      </button>
                    )}
                    <button
                      className="primary"
                      onClick={() => setNewTeam(true)}
                    >
                      <Plus size={15} />
                      Create a team
                    </button>
                  </span>
                </div>
              </section>
            )}
            {view === "team" && prof && unassigned.length > 0 && (
              <section className="panel unassigned">
                <div className="panel-title">
                  <div>
                    <h2>Not on a team yet</h2>
                    <p>
                      They can join a team themselves, or you can add them from
                      a team’s “Manage”.
                    </p>
                  </div>
                </div>
                <div className="chip-list">
                  {unassigned.map((u) => (
                    <span className="person-chip" key={u.id}>
                      <Avatar user={u} small />
                      {u.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {view === "team" && (
              <div className="team-grid">
                {(prof ? s.teams : [team]).filter(Boolean).map((t) => (
                  <Folder
                    key={t.id}
                    className="team-folder"
                    sheets={openSheets(t.id)}
                  >
                    <section className="panel">
                      <div className="panel-title">
                        <div>
                          <h2>{t.name}</h2>
                          <p>
                            {t.memberIds.length === 1
                              ? "1 person"
                              : `${t.memberIds.length} people`}
                            {leaderOf(s, t)
                              ? ` · led by ${s.users.find((u) => u.id === leaderOf(s, t))?.name.split(" ")[0]}`
                              : ""}
                            .
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setManage(t.id)}
                        >
                          <Settings2 size={15} />
                          Manage
                        </button>
                      </div>
                      <MemberBreakdown
                        rows={memberBreakdown(s, t)}
                        userId={userId}
                        avatar={(r) => <Avatar user={r.user} />}
                      />
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
                  </Folder>
                ))}
              </div>
            )}
            {view === "agreement" && !team && (
              <section className="panel">
                <div className="empty">
                  <FileCheck2 />
                  {prof
                    ? "Each team writes its own agreement. Create a team first."
                    : "Your team agreement appears once you’re on a team."}
                  <button
                    className="primary"
                    onClick={() => (prof ? setNewTeam(true) : setView("team"))}
                  >
                    {prof ? "Create a team" : "Find your team"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            )}
            {view === "agreement" && team && (
              <div className="agreement-grid">
                <Folder
                  className="agreement-folder"
                  sheets={(team.agreementHistory || [])
                    .filter((v) => v.version !== team.agreementVersion)
                    .slice(-3)
                    .reverse()
                    .map((v) => ({
                      title: `Version ${v.version}`,
                      meta: `${v.accepted.length} accepted`,
                    }))}
                >
                  <section className="panel agreement-body">
                    <div className="panel-title">
                      <div>
                        <span className="version">
                          Version {team.agreementVersion}
                        </span>
                        <h2>How we work together</h2>
                        <p>
                          Our shared expectations for {team.name}. Team leader:{" "}
                          {leadName}.
                        </p>
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
                    {proposal && (
                      <div className="proposal-box">
                        <span className="version">
                          Proposed change · {proposal.approvals.length} of{" "}
                          {team.memberIds.length} approved
                        </span>
                        <h3>
                          {s.users.find((u) => u.id === proposal.by)?.name ||
                            "The team leader"}{" "}
                          proposed a new version
                        </h3>
                        <p className="form-note">
                          The agreement above stays in place until everyone
                          approves. One decline sends it back to the leader.
                        </p>
                        <div className="agreement-text proposed">
                          {proposal.body.split("\n").map((line, i) => (
                            <p key={i}>
                              <CheckCircle2 size={19} />
                              {line}
                            </p>
                          ))}
                        </div>
                        <div className="vote-chips">
                          {members.map((u) => (
                            <span
                              key={u.id}
                              className={`person-chip ${proposal.approvals.includes(u.id) ? "approved" : ""}`}
                            >
                              <Avatar user={u} small />
                              {u.name.split(" ")[0]}
                              {proposal.approvals.includes(u.id) ? (
                                <Check size={13} />
                              ) : (
                                <Clock3 size={13} />
                              )}
                            </span>
                          ))}
                        </div>
                        <div className="proposal-actions">
                          {mustVote && (
                            <>
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() =>
                                  command(
                                    {
                                      type: "agreement.vote",
                                      teamId: team.id,
                                      proposedAt: proposal.at,
                                      approve: true,
                                    },
                                    "Vote recorded",
                                  )
                                }
                              >
                                <Check size={16} />
                                Approve
                              </button>
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  confirm(
                                    "Decline this proposal? It won’t be adopted, and the leader can revise it.",
                                  ) &&
                                  command(
                                    {
                                      type: "agreement.vote",
                                      teamId: team.id,
                                      proposedAt: proposal.at,
                                      approve: false,
                                    },
                                    "Proposal declined",
                                  )
                                }
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {!mustVote && team.memberIds.includes(userId) && (
                            <span className="accepted">
                              <CheckCircle2 size={18} />
                              You approved. Waiting for the others.
                            </span>
                          )}
                          {leadId === userId && (
                            <button
                              className="text-button danger"
                              disabled={busy}
                              onClick={() =>
                                command(
                                  {
                                    type: "agreement.withdraw",
                                    teamId: team.id,
                                  },
                                  "Proposal withdrawn",
                                )
                              }
                            >
                              Withdraw proposal
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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
                    {leadId === userId ? (
                      <details className="agreement-edit">
                        <summary>
                          {proposal
                            ? "Revise the proposal"
                            : "Propose a change"}
                        </summary>
                        <p>
                          Your team votes on it. It replaces the current
                          agreement once everyone approves.
                        </p>
                        <form
                          key={proposal?.at || "new"}
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const details = e.currentTarget.closest("details");
                            const f = new FormData(e.currentTarget);
                            const ok = await command(
                              {
                                type: "agreement.propose",
                                version: team.agreementVersion,
                                teamId: team.id,
                                body: f.get("body"),
                              },
                              team.memberIds.length > 1
                                ? "Proposal sent for a vote"
                                : "Agreement updated",
                            );
                            if (ok && details) details.open = false;
                          }}
                        >
                          <textarea
                            name="body"
                            aria-label="Agreement text"
                            defaultValue={proposal?.body ?? team.agreement}
                            required
                            maxLength={12000}
                          />
                          <button className="secondary" disabled={busy}>
                            {team.memberIds.length > 1
                              ? proposal
                                ? "Replace the proposal"
                                : "Propose for a vote"
                              : "Save new version"}
                          </button>
                        </form>
                      </details>
                    ) : (
                      <p className="agreement-note">
                        Only the team leader, {leadName}, can propose changes.
                        You’ll get a vote on any change.
                      </p>
                    )}
                  </section>
                </Folder>
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>On the same page</h2>
                      <p>
                        {team.accepted.length} of {members.length} members
                        accepted the current version
                      </p>
                    </div>
                  </div>
                  {members.map((u) => (
                    <div className="member-row" key={u.id}>
                      <Avatar user={u} />
                      <div>
                        <strong>
                          {u.name}
                          {u.id === leadId && (
                            <span className="you">Leader</span>
                          )}
                        </strong>
                        <span>
                          {team.accepted.includes(u.id)
                            ? "Accepted current version"
                            : "Awaiting acceptance"}
                          {proposal &&
                            (proposal.approvals.includes(u.id)
                              ? " · approved the proposal"
                              : " · hasn’t voted yet")}
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
          </div>
          <footer className="workspace-footer">
            <span>
              <Logo size={16} />
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
              {namespace === "demo"
                ? "Class demo"
                : s.inviteCode
                  ? s.course
                  : "Canvas course"}
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
          className={`companion-wrap ${view === "overview" ? "on-overview" : ""}`}
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
              {pipPanel}
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
            <CompanionModel
              active={companion}
              cheer={cheer}
              attention={todoCount > 0}
            />
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
          subtitle="Name it, and add students who aren’t on a team yet. You can add more later."
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
            ) && (
              <p className="form-note">
                No unassigned students right now. Create the team empty and
                students can join it themselves.
              </p>
            )}
            <button className="primary" disabled={busy}>
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
                  due: f.get("due"),
                  ...(f.has("course") ? { course: f.get("course") } : {}),
                })
              )
                setEditProject(false);
            }}
          >
            {s.inviteCode && (
              <label>
                Class
                <input
                  name="course"
                  defaultValue={s.course}
                  required
                  maxLength={120}
                />
              </label>
            )}
            <div className="form-grid">
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
                Final due date
                <input name="due" type="date" defaultValue={s.due} required />
              </label>
            </div>
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
            <p className="form-note">
              Set these to your class’s real milestones. Renaming one updates
              the tasks filed under it.
            </p>
            {[...(s.checkpoints || [])]
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((cp) => (
                <form
                  key={`${cp.id}-${cp.title}-${cp.due}`}
                  className="checkpoint-row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await command(
                      {
                        type: "checkpoint.update",
                        id: cp.id,
                        title: f.get("title"),
                        due: f.get("due"),
                      },
                      "Checkpoint updated",
                    );
                  }}
                >
                  <input
                    name="title"
                    aria-label="Checkpoint name"
                    defaultValue={cp.title}
                    required
                    maxLength={120}
                  />
                  <input
                    name="due"
                    type="date"
                    aria-label={`${cp.title} date`}
                    defaultValue={cp.due}
                    required
                  />
                  <button className="secondary" disabled={busy}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${cp.title}`}
                    title="Delete checkpoint"
                    disabled={busy || (s.checkpoints?.length ?? 0) < 2}
                    onClick={() =>
                      confirm(`Delete the “${cp.title}” checkpoint?`) &&
                      command(
                        { type: "checkpoint.delete", id: cp.id },
                        "Checkpoint deleted",
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </form>
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
      {inviteOpen && s.inviteCode && (
        <InviteModal
          code={s.inviteCode}
          canRotate={organizer}
          group={group}
          busy={busy}
          onRotate={() =>
            command({ type: "invite.rotate" }, "New invite code ready")
          }
          onClose={() => setInviteOpen(false)}
        />
      )}
      {passwordOpen && (
        <PasswordModal csrf={csrf} onClose={() => setPasswordOpen(false)} />
      )}
      {manage &&
        (() => {
          const t = s.teams.find((x) => x.id === manage);
          if (!t) return null;
          const people = s.users.filter((u) => t.memberIds.includes(u.id)),
            lead = leaderOf(s, t),
            canLead = prof || lead === userId;
          return (
            <Modal
              error={error}
              title={`Manage ${t.name}`}
              subtitle={
                prof
                  ? "Rename the team, change who’s on it, or choose its leader."
                  : lead === userId
                    ? "You lead this team. Rename it or hand leadership to a teammate."
                    : `${s.users.find((u) => u.id === lead)?.name || "Your leader"} leads this team.`
              }
              onClose={() => setManage(null)}
            >
              {canLead && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await command(
                      {
                        type: "team.update",
                        teamId: t.id,
                        name: f.get("name"),
                      },
                      "Team renamed",
                    );
                  }}
                >
                  <label>
                    Team name
                    <input
                      name="name"
                      defaultValue={t.name}
                      required
                      maxLength={120}
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    Save name
                  </button>
                </form>
              )}
              <h3 className="modal-section">Members</h3>
              {people.map((u) => (
                <div className="manage-row" key={u.id}>
                  <Avatar user={u} small />
                  <span>
                    {u.name}
                    {u.id === lead && <span className="you">Leader</span>}
                  </span>
                  {canLead && u.id !== lead && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        confirm(
                          group && lead === userId
                            ? `Make ${u.name} team leader? They’ll also become the workspace organizer, and you’ll no longer be able to change the agreement or the project brief.`
                            : `Make ${u.name} team leader?`,
                        ) &&
                        command(
                          { type: "team.lead", teamId: t.id, userId: u.id },
                          `${u.name} now leads ${t.name}`,
                        )
                      }
                    >
                      Make leader
                    </button>
                  )}
                  {prof && (
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={() =>
                        confirm(`Remove ${u.name} from ${t.name}?`) &&
                        command(
                          { type: "team.update", teamId: t.id, remove: u.id },
                          `${u.name} removed`,
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {!people.length && <p className="form-note">No members yet.</p>}
              {prof && unassigned.length > 0 && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const add = new FormData(form).getAll("add");
                    if (!add.length) return;
                    if (
                      await command(
                        { type: "team.update", teamId: t.id, add },
                        "Members added",
                      )
                    )
                      form.reset();
                  }}
                >
                  <h3 className="modal-section">Add students</h3>
                  {unassigned.map((u) => (
                    <label className="checkbox-label" key={u.id}>
                      <input type="checkbox" name="add" value={u.id} />
                      {u.name}
                    </label>
                  ))}
                  <button className="secondary" disabled={busy}>
                    Add to team
                  </button>
                </form>
              )}
              {!prof && t.memberIds.includes(userId) && (
                <div className="modal-actions">
                  {lead === userId && people.length > 1 && (
                    <span className="form-note">
                      Make someone else leader before leaving.
                    </span>
                  )}
                  <button
                    className="secondary danger"
                    disabled={busy || (lead === userId && people.length > 1)}
                    onClick={async () => {
                      if (!confirm(`Leave ${t.name}?`)) return;
                      if (
                        await command(
                          { type: "team.leave", teamId: t.id },
                          "You left the team",
                        )
                      ) {
                        setManage(null);
                        await refresh();
                        setView("team");
                      }
                    }}
                  >
                    Leave team
                  </button>
                </div>
              )}
            </Modal>
          );
        })()}
    </div>
  );
}
function CheckpointTrack({
  checkpoints,
}: {
  checkpoints: NonNullable<State["checkpoints"]>;
}) {
  const sorted = [...checkpoints].sort((a, b) => a.due.localeCompare(b.due)),
    cur = sorted.findIndex((c) => c.due >= today()),
    at = cur === -1 ? sorted.length : cur,
    start = Math.max(0, Math.min(at - 1, sorted.length - 5)),
    shown = sorted.slice(start, start + 5);
  if (!shown.length) return null;
  return (
    <>
      <div className="checkpoint-track">
        {shown.map((c, i) => {
          const n = start + i;
          return (
            <Fragment key={c.id}>
              {i > 0 && <i />}
              <span
                className={n < at ? "finished" : n === at ? "current" : ""}
                title={`${c.title} · ${date(c.due)}`}
              >
                {n < at && <Check size={12} />}
              </span>
            </Fragment>
          );
        })}
      </div>
      <div className="checkpoint-labels">
        {shown.map((c) => (
          <span key={c.id}>{c.title}</span>
        ))}
      </div>
    </>
  );
}
function InviteModal({
  code,
  group,
  canRotate,
  busy,
  onRotate,
  onClose,
}: {
  code: string;
  group: boolean;
  canRotate: boolean;
  busy: boolean;
  onRotate: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState("");
  const pretty = code.slice(0, 4) + "-" + code.slice(4);
  const link = `${location.origin}/?join=${code}`;
  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setCopied("");
    }
  };
  return (
    <Modal
      title="Invite people"
      subtitle={
        group
          ? "Anyone with this code or link joins your team straight away."
          : "Anyone with this code or link joins as a student, then picks or starts their team."
      }
      onClose={onClose}
    >
      <div className="invite-code" aria-label="Invite code">
        {pretty}
      </div>
      <div className="invite-actions">
        <button className="primary" onClick={() => copy("link", link)}>
          <Link2 size={15} />
          {copied === "link" ? "Link copied" : "Copy invite link"}
        </button>
        <button className="secondary" onClick={() => copy("code", pretty)}>
          <Copy size={15} />
          {copied === "code" ? "Code copied" : "Copy code"}
        </button>
      </div>
      <p className="form-note">{link}</p>
      {canRotate && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            confirm(
              "Make a new code? The current code and link stop working; people already in stay in.",
            ) && onRotate()
          }
        >
          <RefreshCw size={13} />
          Replace with a new code
        </button>
      )}
    </Modal>
  );
}
function PasswordModal({
  csrf,
  onClose,
}: {
  csrf: string;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      error={error}
      title="Change password"
      subtitle="Use at least 8 characters."
      onClose={onClose}
    >
      {done ? (
        <div className="accepted">
          <CheckCircle2 size={20} />
          Password changed.
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/auth/password", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-csrf-token": csrf,
                },
                body: JSON.stringify({
                  current: f.get("current"),
                  next: f.get("next"),
                }),
              });
              if (!r.ok)
                throw Error(
                  (await r.json().catch(() => ({}))).error ||
                    "Could not change the password.",
                );
              setDone(true);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Current password
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              name="next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            Change password
          </button>
        </form>
      )}
    </Modal>
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
            <div className="modal-actions split">
              <button
                type="button"
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    confirm(
                      `Delete “${task.title}” and its updates? This can’t be undone.`,
                    ) &&
                    (await command(
                      {
                        type: "task.delete",
                        id: task.id,
                        version: task.version,
                      },
                      "Task deleted",
                    ))
                  )
                    onClose();
                }}
              >
                <Trash2 size={14} />
                Delete task
              </button>
              <button className="secondary" disabled={busy}>
                Save task details
              </button>
            </div>
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
    // v2: the old key was also set by the panel's X, which hid Pip by mistake.
    const key = "tt-pip-hidden-v2";
    localStorage.removeItem("tt-companion-dismissed");
    if (op === "get") return localStorage.getItem(key);
    if (op === "set") localStorage.setItem(key, "yes");
    else localStorage.removeItem(key);
  } catch {}
  return null;
}
