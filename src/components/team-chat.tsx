"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Download,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import type { Team } from "@/lib/types";
import {
  MAX_FILE_BYTES,
  type ChatMessage,
  type ChatPage,
} from "@/lib/chat-types";
const size = (n: number) =>
  n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(n / 1024))} KB`;
const byId = (a: ChatMessage, b: ChatMessage) =>
  BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0;

/** Mounted per workspace/team/user so history and drafts cannot cross conversations. */
export function TeamChat({
  team,
  userId,
  csrf,
  readOnly = false,
}: {
  team: Team;
  userId: string;
  csrf: string;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [loading, setLoading] = useState(true),
    [hasOlder, setHasOlder] = useState(false),
    [olderBusy, setOlderBusy] = useState(false),
    [loadError, setLoadError] = useState(""),
    [sendError, setSendError] = useState(""),
    [body, setBody] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [sending, setSending] = useState(false),
    [unread, setUnread] = useState(0),
    [sent, setSent] = useState(false),
    [retry, setRetry] = useState(0),
    [denied, setDenied] = useState(false);
  const transcript = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    picker = useRef<HTMLInputElement>(null),
    newest = useRef<string | null>(null),
    loadedIds = useRef(new Set<string>()),
    requestId = useRef<string | null>(null),
    scroll = useRef<
      | { kind: "bottom" }
      | { kind: "preserve"; height: number; top: number }
      | null
    >(null),
    outgoing = useRef<AbortController | null>(null),
    historyRequest = useRef<AbortController | null>(null);
  const nearBottom = () => {
    const el = transcript.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };
  const merge = (items: ChatMessage[]) => {
    for (const m of items) loadedIds.current.add(m.id);
    setMessages((old) =>
      [...new Map([...old, ...items].map((m) => [m.id, m])).values()].sort(
        byId,
      ),
    );
  };
  useLayoutEffect(() => {
    const el = transcript.current,
      action = scroll.current;
    if (!el || !action) return;
    el.scrollTop =
      action.kind === "bottom"
        ? el.scrollHeight
        : action.top + el.scrollHeight - action.height;
    scroll.current = null;
  }, [messages]);
  useEffect(() => {
    const controller = new AbortController();
    let live = true,
      pending = false;
    const get = async (after?: string): Promise<ChatPage> => {
      const q = new URLSearchParams({
        teamId: team.id,
        ...(after ? { after } : {}),
      });
      const r = await fetch(`/api/chat?${q}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          historyRequest.current?.abort();
          setDenied(true);
          setMessages([]);
          newest.current = null;
          loadedIds.current.clear();
          setHasOlder(false);
          setOlderBusy(false);
          setUnread(0);
        }
        throw Error(d.error || "Could not refresh chat. Please retry.");
      }
      setDenied(false);
      return d;
    };
    const update = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        if (!newest.current) {
          const d = await get();
          if (!live) return;
          scroll.current = { kind: "bottom" };
          merge(d.messages);
          newest.current = d.messages.at(-1)?.id || null;
          setHasOlder(d.hasMore);
        } else {
          // Drain pages in chronological order; a busy conversation cannot skip messages.
          for (let page = 0; page < 10; page++) {
            const d = await get(newest.current!);
            if (!live) return;
            const count = d.messages.filter(
              (m) => !loadedIds.current.has(m.id),
            ).length;
            if (count) {
              if (nearBottom()) scroll.current = { kind: "bottom" };
              else setUnread((n) => n + count);
              merge(d.messages);
            }
            if (d.messages.length) newest.current = d.messages.at(-1)!.id;
            if (!d.hasMore || !d.messages.length) break;
          }
        }
        setLoadError("");
      } catch (e) {
        if (live && !controller.signal.aborted)
          setLoadError(
            (e as Error).message || "Could not refresh chat. Please retry.",
          );
      } finally {
        if (live) {
          setLoading(false);
          pending = false;
        }
      }
    };
    void update();
    const timer = setInterval(() => void update(), 5000);
    const visible = () => {
      if (!document.hidden) void update();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
    // The component key supplies workspace/team/user isolation; merge operates on current state.
  }, [team.id, retry]);
  useEffect(
    () => () => {
      outgoing.current?.abort();
      historyRequest.current?.abort();
    },
    [],
  );
  async function older() {
    if (!messages[0] || olderBusy) return;
    setOlderBusy(true);
    const controller = new AbortController();
    historyRequest.current = controller;
    try {
      const q = new URLSearchParams({
        teamId: team.id,
        before: messages[0].id,
      });
      const r = await fetch(`/api/chat?${q}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const d = await r.json();
      if (controller.signal.aborted) return;
      if (!r.ok) throw Error(d.error || "Could not load older messages.");
      const el = transcript.current!;
      scroll.current = {
        kind: "preserve",
        height: el.scrollHeight,
        top: el.scrollTop,
      };
      merge(d.messages);
      setHasOlder(d.hasMore);
      setLoadError("");
    } catch (e) {
      if (!controller.signal.aborted) setLoadError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setOlderBusy(false);
    }
  }
  function choose(next: File | null) {
    if (next && (!next.size || next.size > MAX_FILE_BYTES)) {
      setSendError(
        next.size
          ? "Files can be up to 3 MB. Choose a smaller file or send a link."
          : "That file is empty. Choose another file.",
      );
      if (picker.current) picker.current.value = "";
      return;
    }
    setFile(next);
    setSendError("");
    setSent(false);
    requestId.current = null;
    if (!next && picker.current) picker.current.value = "";
  }
  async function send() {
    if (sending || denied || loading || readOnly || (!body.trim() && !file))
      return;
    setSending(true);
    setSendError("");
    setSent(false);
    requestId.current ??= crypto.randomUUID();
    const form = new FormData();
    form.set("teamId", team.id);
    form.set("body", body);
    form.set("requestId", requestId.current);
    if (file) form.set("file", file);
    const controller = new AbortController();
    outgoing.current = controller;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: form,
        signal: controller.signal,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Message not sent. Please retry.");
      scroll.current = { kind: "bottom" };
      merge([d.message]);
      // Keep the polling cursor at the last fetched message, so a simultaneous teammate send is not skipped.
      setBody("");
      setFile(null);
      requestId.current = null;
      setUnread(0);
      setSent(true);
      if (picker.current) picker.current.value = "";
      setRetry((n) => n + 1);
      composer.current?.focus();
    } catch (e) {
      if (!controller.signal.aborted)
        setSendError(
          e instanceof TypeError
            ? "Message not sent. Check your connection and retry."
            : (e as Error).message || "Message not sent. Please retry.",
        );
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }
  return (
    <section className="panel team-chat" aria-label={`${team.name} team chat`}>
      <header className="chat-header">
        <span className="chat-mark">
          <MessageSquare size={22} />
        </span>
        <div>
          <h2>{team.name}</h2>
          <p>Messages and files · visible to your team and instructor</p>
        </div>
        <span className="chat-people">
          {team.memberIds.length}{" "}
          {team.memberIds.length === 1 ? "member" : "members"}
        </span>
      </header>
      {loadError && (
        <div className="chat-error" role="alert">
          <span>{loadError}</span>
          <button
            className="text-button"
            onClick={() => {
              setDenied(false);
              setRetry((n) => n + 1);
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}
      <div
        className="chat-transcript"
        ref={transcript}
        role="log"
        aria-label="Team messages"
        aria-live="off"
        tabIndex={0}
        onScroll={() => {
          if (nearBottom()) setUnread(0);
        }}
      >
        {hasOlder && (
          <button
            className="secondary chat-older"
            onClick={older}
            disabled={olderBusy}
          >
            {olderBusy ? "Loading…" : "Load older messages"}
          </button>
        )}
        {loading ? (
          <div className="chat-empty" role="status">
            Opening the conversation…
          </div>
        ) : !messages.length && !loadError ? (
          <div className="chat-empty">
            <MessageSquare size={30} />
            <h3>A place for the whole team.</h3>
            <p>
              Ask a question, coordinate a meeting, or share a file.
              <br />
              Send the first message to get things started.
            </p>
          </div>
        ) : null}
        {messages.map((m, i) => {
          const day = new Date(m.at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const previous = messages[i - 1];
          const showDay =
            !previous ||
            new Date(previous.at).toDateString() !==
              new Date(m.at).toDateString();
          return (
            <div key={m.id}>
              {showDay && (
                <div className="chat-day">
                  <span>{day}</span>
                </div>
              )}
              <article
                className={`chat-message ${m.actorId === userId ? "mine" : ""}`}
              >
                <span className={`avatar small ${m.color}`}>{m.initials}</span>
                <div className="chat-message-content">
                  <div className="chat-byline">
                    <strong>{m.name}</strong>
                    {m.role === "instructor" && (
                      <span className="chat-role">Instructor</span>
                    )}
                    <time
                      dateTime={m.at}
                      title={new Date(m.at).toLocaleString()}
                    >
                      {new Date(m.at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  {m.body && <p>{m.body}</p>}
                  {m.attachment && (
                    <a
                      className="chat-attachment"
                      href={`/api/chat/files/${m.id}`}
                      download={m.attachment.name}
                    >
                      <span className="chat-file-icon">
                        <Paperclip size={18} />
                      </span>
                      <span>
                        <strong>{m.attachment.name}</strong>
                        <small>
                          {size(m.attachment.bytes)} · Download file
                        </small>
                      </span>
                      <Download size={16} />
                    </a>
                  )}
                </div>
              </article>
            </div>
          );
        })}
      </div>
      {unread > 0 && (
        <button
          className="chat-new"
          onClick={() => {
            const el = transcript.current;
            if (el) el.scrollTop = el.scrollHeight;
            setUnread(0);
          }}
        >
          {unread} new {unread === 1 ? "message" : "messages"} ↓
        </button>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {sendError && (
          <p className="chat-error" role="alert">
            {sendError} Your draft is kept.
          </p>
        )}
        {file && (
          <div className="chat-pending">
            <Paperclip size={16} />
            <span>
              <strong>{file.name}</strong>
              <small>{size(file.size)}</small>
            </span>
            <button
              type="button"
              className="icon-button"
              disabled={sending}
              aria-label="Remove attachment"
              onClick={() => choose(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <textarea
          ref={composer}
          aria-label="Message your team"
          placeholder="Message your team…"
          value={body}
          maxLength={4000}
          rows={2}
          readOnly={sending || readOnly}
          disabled={denied || loading || readOnly}
          onChange={(e) => {
            setBody(e.target.value);
            requestId.current = null;
            setSent(false);
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="chat-compose-actions">
          <input
            ref={picker}
            id={`chat-file-${team.id}`}
            type="file"
            className="sr-only"
            aria-label="Attach a file"
            disabled={sending || denied || loading || readOnly}
            onChange={(e) => choose(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="secondary"
            disabled={sending || denied || loading || readOnly}
            onClick={() => picker.current?.click()}
          >
            <Paperclip size={16} />
            Attach file
          </button>
          <span className="chat-limit">One file, up to 3 MB</span>
          <button
            className="primary chat-send"
            aria-label="Send message"
            disabled={
              sending ||
              denied ||
              loading ||
              readOnly ||
              (!body.trim() && !file)
            }
          >
            {sending ? "Sending…" : "Send"}
            <Send size={15} />
          </button>
        </div>
        <div className="chat-compose-foot">
          <span>Enter to send · Shift + Enter for a new line</span>
          <span role="status">
            {sent ? "Message sent" : unread ? `${unread} new messages` : ""}
          </span>
          <span>
            {body.length ? `${body.length.toLocaleString()} / 4,000` : ""}
          </span>
        </div>
      </form>
    </section>
  );
}
