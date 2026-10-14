"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag, Users } from "lucide-react";
import type { MemberRow } from "@/lib/insights";
import type { Team } from "@/lib/types";

type Mix = { done: number; inProgress: number; todo: number; total: number };

/** Segmented bar of task status. Always paired with a text label. */
export function StatusBar({ mix, label }: { mix: Mix; label: string }) {
  const pct = (n: number) => (mix.total ? (n / mix.total) * 100 : 0);
  return (
    <span className="status-bar" role="img" aria-label={label} title={label}>
      {mix.total ? (
        <>
          <i className="done" style={{ width: `${pct(mix.done)}%` }} />
          <i
            className="in_progress"
            style={{ width: `${pct(mix.inProgress)}%` }}
          />
          <i className="todo" style={{ width: `${pct(mix.todo)}%` }} />
        </>
      ) : null}
    </span>
  );
}

export function mixLabel(m: Mix) {
  return m.total
    ? `${m.done} done, ${m.inProgress} in progress, ${m.todo} to do`
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
          <i className="todo" />
          To do
        </span>
      </div>
    </div>
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
