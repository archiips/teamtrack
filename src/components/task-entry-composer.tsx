"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Link2, Paperclip, X } from "lucide-react";
import { MAX_FILE_BYTES } from "@/lib/chat-types";
import type { Command } from "@/lib/types";
export function TaskEntryComposer({
  taskId,
  name,
  busy,
  command,
  upload,
}: {
  taskId: string;
  name: string;
  busy: boolean;
  command: (c: Command, m?: string) => Promise<boolean>;
  upload: (form: FormData) => Promise<boolean>;
}) {
  const [body, setBody] = useState(""),
    [url, setUrl] = useState(""),
    [kind, setKind] = useState("contribution"),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null),
    requestId = useRef<string | null>(null);
  const changed = () => {
    requestId.current = null;
    setError("");
  };
  function choose(next: File | null) {
    if (next && (!next.size || next.size > MAX_FILE_BYTES)) {
      setError(
        next.size
          ? "Files can be up to 3 MB. Choose a smaller file."
          : "That file is empty. Choose another file.",
      );
      if (picker.current) picker.current.value = "";
      return;
    }
    setFile(next);
    changed();
    if (!next && picker.current) picker.current.value = "";
  }
  return (
    <form
      className="update-form task-entry-composer"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || (!body.trim() && !file)) return;
        let ok: boolean;
        if (file) {
          requestId.current ??= crypto.randomUUID();
          const form = new FormData();
          form.set("taskId", taskId);
          form.set("kind", kind);
          form.set("body", body);
          form.set("url", kind === "contribution" ? url : "");
          form.set("file", file);
          form.set("requestId", requestId.current);
          ok = await upload(form);
        } else
          ok = await command(
            {
              type: kind === "comment" ? "comment.add" : "contribution.add",
              taskId,
              body,
              url: kind === "contribution" ? url : "",
            },
            kind === "comment" ? "Comment added" : "Contribution recorded",
          );
        if (!ok)
          setError(
            "Could not send this update. Your draft and file are kept; please retry.",
          );
        if (ok) {
          setBody("");
          setUrl("");
          setFile(null);
          requestId.current = null;
          setError("");
          if (picker.current) picker.current.value = "";
        }
      }}
    >
      <div className="tabs">
        <button
          type="button"
          disabled={busy}
          className={kind === "contribution" ? "selected" : ""}
          onClick={() => {
            if (kind !== "contribution") {
              setKind("contribution");
              changed();
            }
          }}
        >
          Contribution
        </button>
        <button
          type="button"
          disabled={busy}
          className={kind === "comment" ? "selected" : ""}
          onClick={() => {
            if (kind !== "comment") {
              setKind("comment");
              changed();
            }
          }}
        >
          Comment
        </button>
      </div>
      <textarea
        aria-label="Contribution or comment"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          changed();
        }}
        placeholder={
          kind === "contribution"
            ? "What did you work on? What did you learn?"
            : "Share a thought or help your teammate."
        }
        required={!file}
        readOnly={busy}
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
            readOnly={busy}
            onChange={(e) => {
              setUrl(e.target.value);
              changed();
            }}
          />
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {file && (
        <div className="task-pending-file">
          <Paperclip size={16} />
          <span>
            {file.name}
            <small>{Math.max(1, Math.ceil(file.size / 1024))} KB</small>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Remove task attachment"
            disabled={busy}
            onClick={() => choose(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="task-file-controls">
        <input
          ref={picker}
          type="file"
          className="sr-only"
          aria-label="Attach a file to this task update"
          disabled={busy}
          onChange={(e) => choose(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          <Paperclip size={15} />
          Attach file
        </button>
        <small>One file, up to 3 MB</small>
      </div>
      <div className="update-bottom">
        <small>Attributed to {name}</small>
        <button
          type="submit"
          className="primary"
          disabled={busy || (!body.trim() && !file)}
        >
          {busy
            ? "Sending…"
            : kind === "comment"
              ? "Send comment"
              : "Share update"}
          <ArrowUpRight size={15} />
        </button>
      </div>
    </form>
  );
}
