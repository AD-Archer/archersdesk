"use client";

import { useEffect, useState } from "react";
import type { DeskConfig } from "@/lib/types";
import { WIDGETS } from "@/lib/types";

export default function SettingsSheet({
  open,
  yaml,
  username,
  onClose,
  onSaved,
}: {
  open: boolean;
  yaml: string;
  username: string;
  onClose: () => void;
  onSaved: (yaml: string, config: DeskConfig) => void;
}) {
  const [text, setText] = useState(yaml);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setText(yaml);
      setErrors([]);
      setSaved(false);
    }
  }, [open, yaml]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setErrors([]);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? "couldn't save"]);
      } else {
        onSaved(data.yaml, data.config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setErrors(["network error — is the server up?"]);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <>
      <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`sheet${open ? " open" : ""}`}>
        <div className="sheet-head">
          <div className="sheet-title">config</div>
          <div className="sheet-user">signed in as {username}</div>
          <button className="sheet-close" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>
        <div className="yaml-box">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        {errors.length > 0 && (
          <div className="sheet-errors">
            {errors.map((e, i) => (
              <div key={i}>⚠ {e}</div>
            ))}
          </div>
        )}
        <div className="sheet-hint">
          widgets: <b>{WIDGETS.join(" · ")}</b> — set layout.mode to <b>dual</b> to give one
          widget both squares
        </div>
        <div className="sheet-foot">
          <button className="btn-amber" onClick={save} disabled={saving}>
            {saving ? "saving…" : "save"}
          </button>
          {saved && <span className="sheet-saved">saved ✓</span>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={logout}>
            sign out
          </button>
        </div>
      </div>
    </>
  );
}
