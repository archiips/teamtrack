"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import type { State } from "@/lib/types";
import type { Reminder } from "@/lib/notifications";
import styles from "./notification-inbox.module.css";
type Inbox = {
  items: Reminder[];
  emailEnabled: boolean;
  emailAvailable: boolean;
  persistence: boolean;
};
export function NotificationInbox({
  state,
  userId,
  namespace,
  csrf,
  onOpen,
}: {
  state: State;
  userId: string;
  namespace: string;
  csrf: string;
  onOpen: (
    target: "agreement" | "tasks",
    teamId: string,
    taskId?: string,
  ) => void;
}) {
  const [data, setData] = useState<Inbox | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    panelId = useId();
  useEffect(() => {
    let live = true;
    fetch("/api/notifications", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch(() => {
        if (live)
          setError("Could not load reminders. Try again after refreshing.");
      });
    return () => {
      live = false;
    };
  }, [state.version, namespace, userId]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  async function save(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (path.endsWith("/email"))
        setData((old) =>
          old ? { ...old, emailEnabled: d.emailEnabled } : old,
        );
      else setData(d);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const unread = data?.items.filter((i) => !i.read).length || 0;
  return (
    <div
      ref={root}
      className={styles.root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={styles.bell}
        aria-label={`Reminders${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} />
        {unread > 0 && <span className={styles.badge}>{unread}</span>}
      </button>
      {open && (
        <section id={panelId} aria-label="Reminders" className={styles.panel}>
          <header>
            <strong>Reminders</strong>
            <button
              type="button"
              aria-label="Close reminders"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </header>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {!data && !error && <p>Loading reminders…</p>}
          {data?.items.length === 0 && <p>You’re all caught up.</p>}
          <ul>
            {data?.items.map((i) => (
              <li key={i.id} className={i.read ? styles.read : styles.unread}>
                <button
                  type="button"
                  disabled={busy}
                  className={styles.action}
                  onClick={async () => {
                    if (
                      data.persistence &&
                      !(await save("/api/notifications", {
                        id: i.id,
                        action: "read",
                      }))
                    )
                      return;
                    setOpen(false);
                    onOpen(i.target, i.teamId, i.taskId);
                  }}
                >
                  <strong>{i.title}</strong>
                  <span>{i.detail}</span>
                </button>
                {data.persistence && (
                  <button
                    disabled={busy}
                    type="button"
                    className={styles.dismiss}
                    aria-label={`Dismiss: ${i.title}`}
                    onClick={() =>
                      save("/api/notifications", {
                        id: i.id,
                        action: "dismiss",
                      })
                    }
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <footer>
            <label>
              <input
                type="checkbox"
                checked={data?.emailEnabled || false}
                disabled={
                  busy || !data || (!data.emailAvailable && !data.emailEnabled)
                }
                onChange={(e) =>
                  save("/api/notifications/email", {
                    enabled: e.target.checked,
                  })
                }
              />
              Email me a daily reminder
            </label>
            <small>
              {data?.emailAvailable
                ? "Only when there are actions to take in this workspace."
                : "Email reminders are unavailable until account email delivery is configured."}
            </small>
            {data && !data.persistence && (
              <small>Read and dismiss need a configured database.</small>
            )}
          </footer>
        </section>
      )}
    </div>
  );
}
