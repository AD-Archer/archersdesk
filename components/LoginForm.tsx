"use client";

import { useState } from "react";

// Sign in (or make an account) on the lander. Once it works, the form slides
// away (the page gets .leaving) before the desk opens, so the clock reads as
// handing over to the standby screen; with reduced motion it opens at once.

export default function LoginForm({ canRegister }: { canRegister: boolean }) {
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
        setBusy(false);
        return;
      }
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector(".lander")?.classList.add("leaving");
      setTimeout(() => (location.href = "/"), still ? 0 : 420);
    } catch {
      setError("Can’t reach the desk. Check your connection.");
      setBusy(false);
    }
  }

  const registering = mode === "register";

  return (
    <>
      <p className="lander-say">
        {registering ? "Make an account, then set up your desk from here." : "Sign in to turn this screen into your desk."}
      </p>
      <form className="lander-form" onSubmit={submit}>
        <input
          aria-label="Username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="username"
          required
        />
        <input
          aria-label="Password"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={registering ? "new-password" : "current-password"}
          required
        />
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? (registering ? "Creating account…" : "Signing in…") : registering ? "Create account" : "Sign in"}
        </button>
        <p className="lander-error" role="alert">
          {error}
        </p>
      </form>
      {canRegister && (
        <p className="lander-switch">
          {registering ? "Already have an account?" : "First time here?"}
          <button
            type="button"
            onClick={() => {
              setMode(registering ? "login" : "register");
              setError("");
            }}
          >
            {registering ? "Sign in" : "Create an account"}
          </button>
        </p>
      )}
    </>
  );
}
