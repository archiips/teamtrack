"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag, Users } from "lucide-react";
import type { MemberRow } from "@/lib/insights";
import type { Team } from "@/lib/types";

type Mix = {
  done: number;
  inProgress: number;
  todo: number;
  total: number;
  blocked?: number;
};

// Above this many tasks the segments would be slivers; fall back to proportional runs.
const MAX_SEGMENTS = 14;

/** One segment per task, ordered done → blocked → in progress → to do. Always paired with a text label. */
export function StatusBar({ mix, label }: { mix: Mix; label: string }) {
  const blocked = Math.min(mix.blocked || 0, mix.total - mix.done),
    // Blocked tasks are open tasks; count them out of in-progress first, then to-do.
    inProgress = Math.max(0, mix.inProgress - blocked),
    todo = Math.max(0, mix.total - mix.done - blocked - inProgress),
    runs = [
      ["done", mix.done],
      ["blocked", blocked],
      ["in_progress", inProgress],
      ["todo", todo],
    ] as const;
  return (
    <span
      className={`status-bar${mix.total > MAX_SEGMENTS ? " dense" : ""}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {mix.total > MAX_SEGMENTS
        ? runs.map(([k, n]) =>
            n ? <i key={k} className={k} style={{ flexGrow: n }} /> : null,
          )
        : runs.flatMap(([k, n]) =>
            Array.from({ length: n }, (_, i) => (
              <i key={k + i} className={k} />
            )),
          )}
    </span>
  );
}

export function mixLabel(m: Mix) {
  return m.total
    ? `${m.done} done, ${m.inProgress} in progress, ${m.todo} to do` +
        (m.blocked ? `, ${m.blocked} blocked` : "")
    : "No tasks assigned yet";
}

export function MemberBreakdown({
  rows,
  userId,
  avatar,
}: {
  rows: MemberRow[];
  userId: string;
  avatar: (r: MemberRow) => React.ReactNode;
}) {
  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div className="breakdown-row" key={r.user.id}>
          {avatar(r)}
          <div className="breakdown-main">
            <strong>
              {r.user.name}
              {r.user.id === userId && <small className="you">You</small>}
              {!r.accepted && (
                <small className="pending-tag">Agreement pending</small>
              )}
            </strong>
            <StatusBar mix={r} label={mixLabel(r)} />
            <span className="breakdown-meta">
              {r.total
                ? `${r.done} of ${r.total} task${r.total === 1 ? "" : "s"} done`
                : "No tasks yet"}
              <span className="dot">·</span>
              {r.updates} update{r.updates === 1 ? "" : "s"}
              {r.blocked > 0 && (
                <span className="blocker">
                  <Flag size={11} />
                  {r.blocked} blocked
                </span>
              )}
            </span>
          </div>
        </div>
      ))}
      <StatusLegend />
    </div>
  );
}

export function StatusLegend() {
  return (
    <div className="legend" aria-hidden="true">
      <span>
        <i className="done" />
        Done
      </span>
      <span>
        <i className="in_progress" />
        In progress
      </span>
      <span>
        <i className="blocked" />
        Blocked
      </span>
      <span>
        <i className="todo" />
        To do
      </span>
    </div>
  );
}

/** Professor view: every team's progress side by side, in course order. */
export function TeamProgressChart({
  rows,
  onOpen,
}: {
  rows: { team: Team; health: Mix & { overdue: number } }[];
  onOpen: (teamId: string) => void;
}) {
  return (
    <section
      className="panel progress-chart"
      aria-labelledby="progress-chart-title"
    >
      <div className="panel-title">
        <div>
          <h2 id="progress-chart-title">Team progress</h2>
          <p>Every team&rsquo;s recorded tasks, side by side.</p>
        </div>
      </div>
      <div className="progress-rows">
        {rows.map(({ team, health: h }) => (
          <button
            key={team.id}
            className="progress-row"
            onClick={() => onOpen(team.id)}
            aria-label={`${team.name}: ${mixLabel(h)}. Open team tasks`}
          >
            <span className="progress-name">{team.name}</span>
            <StatusBar mix={h} label={mixLabel(h)} />
            <span className="progress-count">
              <strong>{h.done}</strong> / {h.total} done
            </span>
            <span className="progress-flag">
              {h.overdue > 0 && (
                <small className="attention-tag">{h.overdue} overdue</small>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="panel-foot">
        <StatusLegend />
      </div>
    </section>
  );
}

/** Team switcher. Rendered only when there is a real choice to make. */
export function TeamMenu({
  teams,
  value,
  onChange,
}: {
  teams: Team[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    wrap = useRef<HTMLDivElement>(null),
    current = teams.find((t) => t.id === value) || teams[0];
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    wrap.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  function key(e: React.KeyboardEvent) {
    const items = [
      ...(wrap.current?.querySelectorAll<HTMLElement>('[role="option"]') || []),
    ];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      setOpen(false);
      wrap.current?.querySelector<HTMLElement>("button")?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      items[(next + items.length) % items.length]?.focus();
    }
  }
  return (
    <div className="team-menu" ref={wrap} onKeyDown={key}>
      <button
        className="team-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current team: ${current?.name}. Change team`}
        onClick={() => setOpen(!open)}
      >
        <Users size={15} />
        <span>{current?.name}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="team-options" role="listbox" aria-label="Teams">
          {teams.map((t) => (
            <button
              key={t.id}
              role="option"
              aria-selected={t.id === current?.id}
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <span>
                {t.name}
                <small>{t.memberIds.length} members</small>
              </span>
              {t.id === current?.id && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
