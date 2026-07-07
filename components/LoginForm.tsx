"use client";

import { useState } from "react";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "something went wrong");
      } else {
        location.href = "/";
      }
    } catch {
      setError("network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="login-form" onSubmit={submit}>
        <input
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="username"
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <div className="login-error">{error}</div>
        <button className="btn-amber" type="submit" disabled={busy}>
          {busy ? "…" : mode === "login" ? "sign in" : "create account"}
        </button>
      </form>
      <div className="login-switch">
        {mode === "login" ? "first time here?" : "already have a desk?"}
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "create an account" : "sign in"}
        </button>
      </div>
    </>
  );
}
