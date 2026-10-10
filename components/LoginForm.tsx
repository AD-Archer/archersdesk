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
        const msg = String(data.error ?? "Something went wrong");
        setError(msg.charAt(0).toUpperCase() + msg.slice(1));
      } else {
        location.href = "/";
      }
    } catch {
      setError("Can’t reach the desk. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="login-form" onSubmit={submit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="username"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button className="btn-amber" type="submit" disabled={busy}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <div className="login-error" role="alert">
          {error}
        </div>
      </form>
      <div className="login-switch">
        {mode === "login" ? "First time here?" : "Already have a desk?"}
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </div>
    </>
  );
}
