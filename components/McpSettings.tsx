"use client";

import { useEffect, useState } from "react";
import type { ViewSettings } from "@/lib/types";
import { MCP_SCOPE_INFO, MCP_SCOPES, type McpScope, type McpTokenInfo } from "@/lib/mcp/scopes";
import { MI } from "./widgets/kit";

// settings → MCP: tokens that let an assistant (Claude, ChatGPT, Cursor…)
// change this desk through /api/mcp. Each has scopes and, if wanted, a few
// screens it's kept to. A token shows once, when it's made, with the lines to
// paste into a client.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ago(at: number | null): string {
  if (!at) return "never used";
  const m = Math.round((Date.now() - at) / 60_000);
  if (m < 1) return "used just now";
  if (m < 60) return `used ${m} min ago`;
  if (m < 60 * 24) return `used ${Math.round(m / 60)} h ago`;
  return `used ${Math.round(m / (60 * 24))} d ago`;
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      <MI name={done ? "check" : "content_copy"} />
      {done ? "Copied" : label}
    </button>
  );
}

export function McpSection({ settings }: { settings: ViewSettings }) {
  const [tokens, setTokens] = useState<McpTokenInfo[] | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<McpScope[]>(["read", "screens"]);
  const [screens, setScreens] = useState<string[]>([]);
  const [made, setMade] = useState<{ token: string; info: McpTokenInfo } | null>(null);
  const [err, setErr] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/api/mcp`;
  const screenName = new Map(settings.devices.map((d) => [d.id, d.name]));

  useEffect(() => {
    fetch("/api/mcp/tokens")
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => setTokens([]));
  }, []);

  async function make() {
    setErr("");
    const res = await fetch("/api/mcp/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "assistant", scopes, screens }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.token) return setErr(data?.error ?? "couldn't make the token");
    setMade(data);
    setTokens((t) => [data.info, ...(t ?? [])]);
    setName("");
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setTokens((t) => (t ?? []).filter((x) => x.id !== id));
      if (made?.info.id === id) setMade(null);
    }
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const claudeCode = made
    ? `claude mcp add --transport http archers-desk ${url} --header "Authorization: Bearer ${made.token}"`
    : "";
  const config = made
    ? JSON.stringify(
        { mcpServers: { "archers-desk": { type: "http", url, headers: { Authorization: `Bearer ${made.token}` } } } },
        null,
        2
      )
    : "";

  return (
    <>
      <p className="group-foot set-lead">
        Let an assistant like Claude or ChatGPT run this desk for you: make pages, move cards, set times, alarms,
        calendars and more. Each token is for one assistant; take it back here any time.
      </p>

      {made && (
        <>
          <h3 className="group-head">Copy it now: it won&rsquo;t show again</h3>
          <div className="group mcp-made">
            <div className="group-row mcp-block">
              <span className="row-label">Token</span>
              <code className="mcp-code">{made.token}</code>
              <Copy text={made.token} label="Copy" />
            </div>
            <div className="group-row mcp-block">
              <span className="row-label">Claude Code</span>
              <code className="mcp-code">{claudeCode}</code>
              <Copy text={claudeCode} label="Copy" />
            </div>
            <div className="group-row mcp-block">
              <span className="row-label">Other clients</span>
              <pre className="mcp-code">{config}</pre>
              <Copy text={config} label="Copy" />
            </div>
          </div>
          <p className="group-foot">
            The server is <code>{url}</code>. Claude.ai, ChatGPT and Cursor take the same address and an
            Authorization header.
          </p>
        </>
      )}

      <h3 className="group-head">New token</h3>
      <div className="group">
        <label className="group-row in-row">
          <span className="row-label">Name</span>
          <input className="in" value={name} placeholder="Claude" maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="group-row chips-row">
          <span className="chips-label">
            It can
            <span className="row-value">{scopes.length ? scopes.map((s) => MCP_SCOPE_INFO[s].label).join(", ") : "Nothing yet"}</span>
          </span>
          <div className="chips">
            {MCP_SCOPES.map((s) => (
              <button
                key={s}
                className={`chip${scopes.includes(s) ? " on" : ""}`}
                aria-pressed={scopes.includes(s)}
                title={MCP_SCOPE_INFO[s].blurb}
                onClick={() => setScopes(toggle(scopes, s))}
              >
                {MCP_SCOPE_INFO[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="group-row chips-row">
          <span className="chips-label">
            On
            <span className="row-value">
              {screens.length ? `${screens.length} screen${screens.length === 1 ? "" : "s"}` : "Every screen"}
            </span>
          </span>
          <div className="chips">
            {settings.devices.map((d) => (
              <button
                key={d.id}
                className={`chip${screens.includes(d.id) ? " on" : ""}`}
                aria-pressed={screens.includes(d.id)}
                onClick={() => setScreens(toggle(screens, d.id))}
              >
                {cap(d.name)}
              </button>
            ))}
          </div>
        </div>
        <button className="group-row row-action" onClick={make} disabled={!scopes.length}>
          <MI name="key" />
          Make a token
        </button>
      </div>
      <p className="group-foot">
        {err ||
          (scopes.length
            ? scopes.map((s) => `${MCP_SCOPE_INFO[s].label}: ${MCP_SCOPE_INFO[s].blurb}`).join(" ")
            : "Pick what it can do.")}
      </p>

      <h3 className="group-head">Tokens</h3>
      {tokens && tokens.length === 0 && <p className="set-empty">None yet.</p>}
      {tokens && tokens.length > 0 && (
        <div className="group">
          {tokens.map((t) => (
            <div key={t.id} className="group-row saved-row">
              <span className="row-text">
                <b>{t.name}</b>
                <small>
                  {t.scopes.map((s) => MCP_SCOPE_INFO[s].label).join(", ")} ·{" "}
                  {t.screens.length ? t.screens.map((id) => cap(screenName.get(id) ?? "a removed screen")).join(", ") : "every screen"} ·{" "}
                  {ago(t.lastUsedAt)}
                </small>
              </span>
              <button className="text-btn red" onClick={() => revoke(t.id)}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="group-foot">
        Every tool and what it needs is in the{" "}
        <a href="/docs" target="_blank" rel="noreferrer">
          MCP docs
        </a>
        .
      </p>
    </>
  );
}
