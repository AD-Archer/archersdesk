"use client";

import { useEffect, useState } from "react";
import EditablePopup from "../EditablePopup";
import { useNow } from "../hooks";
import type { WidgetProps } from "./registry";

const AWAY_KEY = "archersdesk.awayUntil";
const VIBE_KEY = "archersdesk.vibeMood";
type VibeMood = "joyful" | "sad" | "stressed" | "calm" | "busy" | "mysterious";

const STATUS_COPY = {
  dnd: {
    label: "status",
    title: "Do not disturb",
    note: "Deep focus",
    tone: "quiet",
  },
  please: {
    label: "status",
    title: "Please disturb",
    note: "Interruptions welcome",
    tone: "open",
  },
  lunch: {
    label: "status",
    title: "At lunch",
    note: "Back soon",
    tone: "lunch",
  },
  vibe: {
    label: "status",
    title: "Vibe check",
    note: "Generally available",
    tone: "vibe",
  },
} as const;

const VIBE_MOODS: Record<VibeMood, { label: string; title: string; note: string }> = {
  joyful: { label: "joyful", title: "Joyful", note: "High sparkle, low friction" },
  sad: { label: "sad", title: "Soft mode", note: "Gentle interruptions only" },
  stressed: { label: "stressed", title: "Stressed", note: "Send help, not surprises" },
  calm: { label: "calm", title: "Calm", note: "Steady waters" },
  busy: { label: "busy", title: "In motion", note: "Fast replies unlikely" },
  mysterious: { label: "mysterious", title: "Unclear aura", note: "Proceed with curiosity" },
};

const DEFAULT_VIBE: VibeMood = "joyful";

function isVibeMood(value: string | null): value is VibeMood {
  return Boolean(value && value in VIBE_MOODS);
}

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

export function LunchWidget({ wide }: WidgetProps) {
  return <StatusCard {...STATUS_COPY.lunch} wide={wide} />;
}

export function VibeWidget({ wide }: WidgetProps) {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<VibeMood>(DEFAULT_VIBE);
  const vibe = VIBE_MOODS[mood];

  useEffect(() => {
    const saved = window.localStorage.getItem(VIBE_KEY);
    if (isVibeMood(saved)) setMood(saved);
  }, []);

  function pick(next: VibeMood) {
    window.localStorage.setItem(VIBE_KEY, next);
    setMood(next);
    setOpen(false);
  }

  return (
    <>
      <span className="w-label">{STATUS_COPY.vibe.label}</span>
      <button
        className={`w-body status status-vibe mood-${mood}${wide ? " wide" : ""}`}
        onClick={() => setOpen(true)}
      >
        <div className="status-mark" aria-hidden="true" />
        <div className="status-title">{vibe.title}</div>
        <div className="status-note">{vibe.note}</div>
      </button>
      <EditablePopup open={open} title="Vibe check" onClose={() => setOpen(false)}>
        <div className="mood-grid">
          {(Object.keys(VIBE_MOODS) as VibeMood[]).map((key) => (
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

export function AwayUntilWidget({ wide }: WidgetProps) {
  const now = useNow(30_000);
  const [open, setOpen] = useState(false);
  const [awayUntil, setAwayUntil] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const away = formatAwayUntil(awayUntil, now);

  useEffect(() => {
    const saved = window.localStorage.getItem(AWAY_KEY);
    if (saved) {
      setAwayUntil(saved);
      setDraft(toInputValue(new Date(saved)));
    } else {
      setDraft(toInputValue(new Date(Date.now() + 60 * 60_000)));
    }
  }, []);

  function save() {
    const next = new Date(draft);
    if (Number.isNaN(next.getTime())) return;
    const value = next.toISOString();
    window.localStorage.setItem(AWAY_KEY, value);
    setAwayUntil(value);
    setOpen(false);
  }

  function clear() {
    window.localStorage.removeItem(AWAY_KEY);
    setAwayUntil(null);
    setDraft(toInputValue(new Date(Date.now() + 60 * 60_000)));
    setOpen(false);
  }

  function quick(minutes: number) {
    setDraft(toInputValue(new Date(Date.now() + minutes * 60_000)));
  }

  return (
    <>
      <span className="w-label">status</span>
      <button
        className={`w-body status status-away${away.expired ? " expired" : ""}${wide ? " wide" : ""}`}
        onClick={() => setOpen(true)}
      >
        <div className="status-mark" aria-hidden="true" />
        <div className="status-title">{away.main}</div>
        <div className="status-note">{away.detail}</div>
      </button>
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
        <div className="edit-quick">
          <button onClick={() => quick(30)}>+30m</button>
          <button onClick={() => quick(60)}>+1h</button>
          <button onClick={() => quick(120)}>+2h</button>
        </div>
      </EditablePopup>
    </>
  );
}
