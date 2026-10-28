"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function LmsLoginForm() {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const r = await fetch("/lms/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    }).catch(() => null);
    if (r?.ok) return router.push("/lms/course");
    setError(
      (await r?.json().catch(() => null))?.error ||
        "Could not sign in. Please retry.",
    );
    setBusy(false);
  }
  return (
    <form className="lms-login-form" onSubmit={submit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p className="lms-error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
    </form>
  );
}
