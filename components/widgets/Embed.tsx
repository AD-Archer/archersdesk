"use client";

// Embed — a clean full-bleed player frame. No chrome except a floating gear
// (same mark as the app's settings button); tapping it opens the manager
// popup where you pick which embed plays, and add / edit / delete saved
// ones. Writes go through /api/embeds (a small dedicated channel, like
// /api/presence) so this never needs the full settings-editor round trip.

import { useEffect, useState } from "react";
import type { EmbedFeed } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { Shell } from "./kit";
import type { WidgetProps } from "./registry";

const SELECTED_KEY = "archersdesk.embed.selected";

const yt = (id: string) => `https://www.youtube.com/embed/${id}`;

/** Rewrite share links into their embeddable player form — youtube watch /
 *  shorts / live / playlist, spotify, vimeo, soundcloud. A plain page url
 *  passes through unchanged, but note most regular sites send
 *  X-Frame-Options / CSP frame-ancestors and will refuse to render in any
 *  iframe — that's the site's call, not something this app can override.
 *  Non-http(s) schemes (javascript:, data:, …) are rejected — settings are
 *  sanitized to https? on save, but the live preview reads unsaved state,
 *  so this is the layer that actually guards what reaches the iframe src. */
function toEmbeddable(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    const host = u.hostname.replace(/^(www|m|music)\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/")[1];
      return id ? yt(id) : raw;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? yt(id) : raw;
      }
      const path = u.pathname.match(/^\/(shorts|live)\/([\w-]+)/);
      if (path) return yt(path[2]);
      if (u.pathname === "/playlist") {
        const list = u.searchParams.get("list");
        return list ? `https://www.youtube.com/embed/videoseries?list=${list}` : raw;
      }
      return raw; // already /embed/…
    }
    if (host === "open.spotify.com") {
      const m = u.pathname.match(/^\/(?:intl-\w+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : raw;
    }
    if (host === "vimeo.com") {
      const m = u.pathname.match(/^\/(\d+)/);
      return m ? `https://player.vimeo.com/video/${m[1]}` : raw;
    }
    if (host === "soundcloud.com" || host === "on.soundcloud.com") {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&visual=true`;
    }
    return raw;
  } catch {
    return "";
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "test.com" → "https://test.com"; anything already naming a scheme is left
 *  alone (so an explicit http:// is honored, and javascript: etc still get
 *  rejected downstream). Mirrors the server's sanitizeEmbeds rule. */
function withScheme(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

/** Same hand-drawn gear as the app's own settings button (Dashboard.tsx's
 *  `.gear`) — reused instead of an emoji or an unverified icon-font glyph
 *  (this app's Material Symbols file is a hand-picked subset; an unlisted
 *  glyph name silently renders blank). */
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8.2 16 12 10 15.8 10 8.2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

async function callEmbeds(action: string, payload?: unknown): Promise<EmbedFeed[]> {
  const res = await fetch("/api/embeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const body = await res.json().catch(() => ({}));
  return (body as { embeds?: EmbedFeed[] }).embeds ?? [];
}

export function EmbedWidget({ settings }: WidgetProps) {
  const [embeds, setEmbeds] = useState<EmbedFeed[]>(settings.embeds);
  useEffect(() => setEmbeds(settings.embeds), [settings.embeds]);

  // which embed plays survives a reload; localStorage is read post-mount so
  // server and client render the same first frame (see useMounted's note).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => setSelectedId(localStorage.getItem(SELECTED_KEY)), []);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = embeds.find((e) => e.id === selectedId) ?? embeds[0] ?? null;
  const src = current ? toEmbeddable(current.url) : "";

  function select(id: string) {
    setSelectedId(id);
    localStorage.setItem(SELECTED_KEY, id);
    setOpen(false);
  }

  function openManager() {
    clearForm();
    setOpen(true);
  }

  function clearForm() {
    setEditingId(null);
    setDraftName("");
    setDraftUrl("");
    setError(null);
  }

  function edit(e: EmbedFeed) {
    setEditingId(e.id);
    setDraftName(e.name);
    setDraftUrl(e.url);
    setError(null);
  }

  async function save() {
    const url = withScheme(draftUrl);
    if (!url || saving) return;
    setSaving(true);
    setError(null);
    try {
      const name = draftName.trim() || hostOf(url);
      const next = editingId
        ? await callEmbeds("update", { id: editingId, name, url })
        : await callEmbeds("add", { name, url });
      // the server silently drops urls its sanitizer rejects — surface that
      // here instead of the form just appearing to do nothing
      const stored = url.replace(/\/+$/, "");
      const stuck = editingId
        ? next.find((e) => e.id === editingId)?.url !== stored
        : next.length === embeds.length;
      if (stuck) {
        setEmbeds(next);
        setError("that doesn't look like a valid link — check the address");
        return;
      }
      setEmbeds(next);
      clearForm();
    } catch {
      setError("couldn't save — is the desk offline?");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const next = await callEmbeds("remove", { id });
    setEmbeds(next);
    if (selectedId === id) setSelectedId(null);
    clearForm();
  }

  return (
    <Shell label="embed">
      <div className="embed">
        <div className="embed-frame">
          {src ? (
            <iframe
              key={current!.id}
              src={src}
              title={current!.name}
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button className="embed-empty" onClick={openManager}>
              <PlayIcon />
              <b>{embeds.length ? "that link can't be embedded" : "nothing playing"}</b>
              <small>{embeds.length ? "tap to fix the url" : "tap to add music or a video"}</small>
            </button>
          )}
          <button className="embed-gear" onClick={openManager} aria-label="manage embeds">
            <GearIcon />
          </button>
        </div>
      </div>

      <EditablePopup
        open={open}
        title="embeds"
        onClose={() => setOpen(false)}
        footer={
          <>
            {editingId && (
              <button className="edit-pop-muted" onClick={() => remove(editingId)}>
                delete
              </button>
            )}
            {editingId && (
              <button className="edit-pop-muted" onClick={clearForm}>
                cancel
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="edit-pop-primary" onClick={save} disabled={saving || !draftUrl.trim()}>
              {editingId ? "save" : "add"}
            </button>
          </>
        }
      >
        {embeds.length > 0 && (
          <div className="embed-rows">
            {embeds.map((e) => (
              <div key={e.id} className={`embed-row${current?.id === e.id ? " on" : ""}`}>
                <button className="embed-row-main" onClick={() => select(e.id)}>
                  <b>{e.name}</b>
                  <small>{hostOf(e.url)}</small>
                </button>
                <button className="embed-row-edit" onClick={() => edit(e)} aria-label={`edit ${e.name}`}>
                  <PencilIcon />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="embed-form-head">{editingId ? "edit embed" : "add an embed"}</div>
        <label className="edit-field">
          <span>name</span>
          <input
            value={draftName}
            maxLength={60}
            placeholder="optional — the site name is used"
            onChange={(e) => setDraftName(e.target.value)}
          />
        </label>
        <label className="edit-field">
          <span>link</span>
          <input
            value={draftUrl}
            maxLength={500}
            placeholder="paste a link"
            onChange={(e) => {
              setDraftUrl(e.target.value);
              setError(null);
            }}
            autoCapitalize="off"
            autoCorrect="off"
            inputMode="url"
          />
        </label>
        {error && <p className="embed-error">{error}</p>}
        <p className="embed-hint">
          youtube, spotify, vimeo and soundcloud links become their players automatically. regular
          websites only load if they allow being embedded.
        </p>
      </EditablePopup>
    </Shell>
  );
}
