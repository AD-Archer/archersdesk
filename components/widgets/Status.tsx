"use client";

import { useEffect, useState } from "react";
import { VIBES, type Vibe } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { useNow } from "../hooks";
import { pushPresence } from "../presence";
import type { WidgetProps } from "./registry";

const STATUS_COPY = {
  dnd: {
    label: "status",
    title: "DO NOT DISTURB",
    note: "go away · actually working here",
    tone: "quiet",
  },
  please: {
    label: "status",
    title: "PLEASE DISTURB",
    note: "PLS",
    tone: "open",
  },
  vibe: {
    label: "status",
    title: "Vibe check",
    note: "Generally available",
    tone: "vibe",
  },
} as const;

const VIBE_MOODS: Record<Vibe, { label: string; title: string; note: string }> = {
  joyful: { label: "joyful", title: "Joyful", note: "High sparkle, low friction" },
  sad: { label: "sad", title: "Soft mode", note: "Gentle interruptions only" },
  stressed: { label: "stressed", title: "Stressed", note: "Send help, not surprises" },
  calm: { label: "calm", title: "Calm", note: "Steady waters" },
  busy: { label: "busy", title: "In motion", note: "Fast replies unlikely" },
  mysterious: { label: "mysterious", title: "Unclear aura", note: "Proceed with curiosity" },
};

function toInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatAwayUntil(value: string | null, now: Date) {
  if (!value) return { main: "Away", detail: "Tap to set a return time", expired: false };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { main: "Away", detail: "Tap to set a return time", expired: false };

  const expired = date.getTime() <= now.getTime();
  const sameDay = date.toDateString() === now.toDateString();
  const main = expired ? "Back now" : "Away until";
  const detail = new Intl.DateTimeFormat("en-US", {
    weekday: sameDay ? undefined : "short",
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return { main, detail, expired };
}

function StatusCard({
  label,
  title,
  note,
  tone,
  wide,
}: {
  label: string;
  title: string;
  note: string;
  tone: string;
  wide?: boolean;
}) {
  return (
    <>
      <span className="w-label">{label}</span>
      <div className={`w-body status status-${tone}${wide ? " wide" : ""}`}>
        <div className="status-mark" aria-hidden="true" />
        <div className="status-title">{title}</div>
        <div className="status-note">{note}</div>
      </div>
    </>
  );
}

export function DoNotDisturbWidget({ wide }: WidgetProps) {
  return <StatusCard {...STATUS_COPY.dnd} wide={wide} />;
}

export function PleaseDisturbWidget({ wide }: WidgetProps) {
  return <StatusCard {...STATUS_COPY.please} wide={wide} />;
}

export function VibeWidget({ settings, wide }: WidgetProps) {
  const [open, setOpen] = useState(false);
  // presence is server-synced per device; keep a local optimistic copy so the
  // pick shows instantly, and reconcile whenever the poll refreshes props.
  const [mood, setMood] = useState<Vibe>(settings.presence.vibe);
  useEffect(() => setMood(settings.presence.vibe), [settings.presence.vibe]);
  const vibe = VIBE_MOODS[mood];

  function pick(next: Vibe) {
    setMood(next);
    setOpen(false);
    void pushPresence([settings.deviceId], { vibe: next });
  }

  return (
    <>
      <span className="w-label">{STATUS_COPY.vibe.label}</span>
      <div
        className={`w-body status status-vibe mood-${mood}${wide ? " wide" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="status-mark" aria-hidden="true" />
        <div className="status-title">{vibe.title}</div>
        <div className="status-note">{vibe.note}</div>
      </div>
      <EditablePopup open={open} title="Vibe check" onClose={() => setOpen(false)}>
        <div className="mood-grid">
          {VIBES.map((key) => (
            <button key={key} className={`mood-card${mood === key ? " on" : ""}`} onClick={() => pick(key)}>
              <b>{VIBE_MOODS[key].label}</b>
              <small>{VIBE_MOODS[key].note}</small>
            </button>
          ))}
        </div>
      </EditablePopup>
    </>
  );
}

export function AwayUntilWidget({ settings, wide }: WidgetProps) {
  const now = useNow(30_000);
  const [open, setOpen] = useState(false);
  // optimistic mirrors of the synced presence, reconciled on each poll
  const [awayUntil, setAwayUntil] = useState<string | null>(settings.presence.awayUntil);
  const [awayLoc, setAwayLoc] = useState(settings.presence.awayLocation);
  const [draft, setDraft] = useState("");
  const [draftLoc, setDraftLoc] = useState("");

  useEffect(() => {
    setAwayUntil(settings.presence.awayUntil);
    setAwayLoc(settings.presence.awayLocation);
  }, [settings.presence.awayUntil, settings.presence.awayLocation]);

  useEffect(() => {
    setDraft(toInputValue(awayUntil ? new Date(awayUntil) : new Date(Date.now() + 60 * 60_000)));
    setDraftLoc(awayLoc);
    // seed the editor when opening / when synced values change
  }, [open, awayUntil, awayLoc]);

  const away = formatAwayUntil(awayUntil, now);
  const note = awayLoc ? `${away.detail} · ${awayLoc}` : away.detail;

  function save() {
    const next = new Date(draft);
    if (Number.isNaN(next.getTime())) return;
    const value = next.toISOString();
    setAwayUntil(value);
    setAwayLoc(draftLoc);
    setOpen(false);
    void pushPresence([settings.deviceId], { awayUntil: value, awayLocation: draftLoc });
  }

  function clear() {
    setAwayUntil(null);
    setOpen(false);
    void pushPresence([settings.deviceId], { awayUntil: null });
  }

  function quick(minutes: number) {
    setDraft(toInputValue(new Date(Date.now() + minutes * 60_000)));
  }

  return (
    <>
      <span className="w-label">status</span>
      <div
        className={`w-body status status-away${away.expired ? " expired" : ""}${wide ? " wide" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="status-mark" aria-hidden="true" />
        <div className="status-title">{away.main}</div>
        <div className="status-note">{note}</div>
      </div>
      <EditablePopup
        open={open}
        title="Away until"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="edit-pop-muted" onClick={clear}>
              clear
            </button>
            <span style={{ flex: 1 }} />
            <button className="edit-pop-primary" onClick={save}>
              set
            </button>
          </>
        }
      >
        <label className="edit-field">
          <span>return time</span>
          <input type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <label className="edit-field">
          <span>where you are</span>
          <input
            type="text"
            placeholder="e.g. coffee shop"
            maxLength={80}
            value={draftLoc}
            onChange={(e) => setDraftLoc(e.target.value)}
          />
        </label>
        <div className="edit-quick">
          <button onClick={() => quick(30)}>+30m</button>
          <button onClick={() => quick(60)}>+1h</button>
          <button onClick={() => quick(120)}>+2h</button>
        </div>
      </EditablePopup>
    </>
  );
}
