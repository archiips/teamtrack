"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    // Read the browser-only fragment after hydration, then remove it from history.
    const frame = window.requestAnimationFrame(() => {
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <main style={{ maxWidth: 440, margin: "12vh auto", padding: 24 }}>
      <Link href="/">TeamTrack</Link>
      <h1>Choose a new password</h1>
      {done ? (
        <>
          <p role="status">
            Your password has been reset. Sign in with your new password.
          </p>
          <Link href="/">Back to sign in</Link>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (password !== confirm) {
              setError("The passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
              });
              const data = await res.json();
              if (!res.ok)
                throw Error(data.error || "Could not reset your password.");
              setDone(true);
              setPassword("");
              setConfirm("");
              setToken("");
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not reset your password. Please retry.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Use at least 8 characters. Reset links expire after 30 minutes.</p>
          {!token && (
            <p role="alert">
              Open the reset link from your email, or return to sign in to
              request a new one.
            </p>
          )}
          <label style={{ display: "block", marginBottom: 16 }}>
            New password
            <input
              style={{ display: "block", width: "100%" }}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label style={{ display: "block", marginBottom: 16 }}>
            Confirm new password
            <input
              style={{ display: "block", width: "100%" }}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy || !token} type="submit">
            {busy ? "Resetting…" : "Reset password"}
          </button>
          <p>
            <Link href="/">Back to sign in</Link>
          </p>
        </form>
      )}
    </main>
  );
}
