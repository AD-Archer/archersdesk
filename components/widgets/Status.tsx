"use client";

import { useEffect, useState } from "react";
import { VIBES, type Vibe } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { clock12 } from "../alarmUtil";
import { useNow } from "../hooks";
import { pushPresence } from "../presence";
import { BigTime, MI } from "./kit";
import type { WidgetProps } from "./registry";

const STATUS_COPY = {
  dnd: {
    label: "Focus",
    title: "Do not disturb",
    note: "Go away, actually working here",
    glyph: "moon",
  },
  please: {
    label: "Focus",
    title: "Please disturb",
    note: "Pls",
    glyph: "bell",
  },
  vibe: {
    label: "Vibe check",
  },
} as const;

// each mood gets its own face, so the sign reads without relying on color.
// tone is kept for the picker (what the mood means for a visitor).
const VIBE_MOODS: Record<Vibe, { label: string; title: string; note: string; tone: string }> = {
  joyful: { label: "Joyful", title: "Joyful", note: "High sparkle, low friction", tone: "green" },
  sad: { label: "Sad", title: "Soft mode", note: "Gentle interruptions only", tone: "lit" },
  stressed: { label: "Stressed", title: "Stressed", note: "Send help, not surprises", tone: "red" },
  calm: { label: "Calm", title: "Calm", note: "Steady waters", tone: "green" },
  busy: { label: "Busy", title: "In motion", note: "Fast replies unlikely", tone: "yellow" },
  mysterious: { label: "Mysterious", title: "Unclear aura", note: "Proceed with curiosity", tone: "lit" },
};

/** Big filled status glyphs drawn in the tint (the icon font has no faces). */
function SignGlyph({ kind }: { kind: string }) {
  const face = (features: React.ReactNode) => (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g fill="none" stroke="#000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {features}
      </g>
    </svg>
  );
  switch (kind) {
    case "moon":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.6 15.2A9.2 9.2 0 0 1 8.8 3.4a.6.6 0 0 0-.8-.7 9.8 9.8 0 1 0 13.3 13.3.6.6 0 0 0-.7-.8z" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.2a1.6 1.6 0 0 0-1.6 1.6v.5a6.4 6.4 0 0 0-4.8 6.2v4.1l-1.8 2.3a.9.9 0 0 0 .7 1.5h15a.9.9 0 0 0 .7-1.5l-1.8-2.3v-4.1a6.4 6.4 0 0 0-4.8-6.2v-.5A1.6 1.6 0 0 0 12 2.2zM9.3 19.6a2.7 2.7 0 0 0 5.4 0z" />
          <path
            d="M3.2 9.2a8.6 8.6 0 0 1 2.6-5M20.8 9.2a8.6 8.6 0 0 0-2.6-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "walk":
      // same figure as the away overlay
      return <MI name="directions_walk" />;
    case "joyful":
      return face(
        <>
          <path d="M8.2 9.2v.6M15.8 9.2v.6" strokeWidth="2.2" />
          <path d="M7.2 13.6a5 5 0 0 0 9.6 0z" fill="#000" />
        </>
      );
    case "sad":
      return face(
        <>
          <path d="M8.2 9.6v.6M15.8 9.6v.6" strokeWidth="2.2" />
          <path d="M8.4 17a4.4 4.4 0 0 1 7.2 0" />
        </>
      );
    case "stressed":
      return face(
        <>
          <path d="M7 8.4l2.4 1.2M17 8.4l-2.4 1.2" />
          <path d="M7.4 16l1.5-1.4 1.5 1.4 1.6-1.4 1.6 1.4 1.5-1.4 1.5 1.4" />
        </>
      );
    case "calm":
      return face(
        <>
          <path d="M6.8 10a1.9 1.9 0 0 0 3 0M14.2 10a1.9 1.9 0 0 0 3 0" />
          <path d="M9 14.8a3.6 3.6 0 0 0 6 0" />
        </>
      );
    case "busy":
      return face(
        <>
          <path d="M8.2 9.4v.6M15.8 9.4v.6" strokeWidth="2.2" />
          <path d="M8.6 15.6h6.8" />
        </>
      );
    default:
      return face(
        <>
          <path d="M9.4 9.4v.6M17 9.4v.6" strokeWidth="2.2" />
          <path d="M9 15.4c1.2.6 2.4-.6 3.6 0s2.4.6 3.4 0" />
        </>
      );
  }
}

function toInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatAwayUntil(value: string | null, now: Date) {
  const unset = { main: "Away", day: "", time: null, detail: "Tap to set a return time", expired: false };
  if (!value) return unset;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unset;

  const expired = date.getTime() <= now.getTime();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const day =
    date.toDateString() === now.toDateString()
      ? ""
      : date.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
  const time = clock12(date);
  return {
    main: expired ? "Back now" : `Away until${day ? ` ${day === "Tomorrow" ? "tomorrow" : day}` : ""}`,
    day,
    time: expired ? null : time,
    detail: expired ? `Since ${time.time} ${time.ampm}` : "",
    expired,
  };
}

/** A status sign the StandBy way: a big glyph in the tint, a huge word,
 *  one quiet line. Wide, the glyph sits beside the words. */
function StatusSign({
  label,
  glyph,
  title,
  note,
  wide,
  className = "",
  hero,
  ...rest
}: {
  label: string;
  glyph: string;
  title: string;
  note: string;
  wide?: boolean;
  className?: string;
  hero?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <>
      <span className="w-label">{label}</span>
      <div className={`w-body sign${wide ? " wide" : ""}${className ? ` ${className}` : ""}`} {...rest}>
        <span className="sign-glyph">
          <SignGlyph kind={glyph} />
        </span>
        <div className="sign-text">
          <div className="sign-title">{title}</div>
          {hero}
          {note && <div className="sign-note">{note}</div>}
        </div>
      </div>
    </>
  );
}

export function DoNotDisturbWidget({ wide }: WidgetProps) {
  return <StatusSign {...STATUS_COPY.dnd} wide={wide} />;
}

export function PleaseDisturbWidget({ wide }: WidgetProps) {
  return <StatusSign {...STATUS_COPY.please} wide={wide} />;
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
      <StatusSign
        label={STATUS_COPY.vibe.label}
        glyph={mood}
        title={vibe.title}
        note={vibe.note}
        wide={wide}
        className="tappable"
        role="button"
        tabIndex={0}
        aria-label={`vibe: ${vibe.title}. tap to change`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <EditablePopup open={open} title="Vibe check" onClose={() => setOpen(false)}>
        <div className="mood-grid">
          {VIBES.map((key) => (
            <button
              key={key}
              className={`mood-card tone-${VIBE_MOODS[key].tone}${mood === key ? " on" : ""}`}
              onClick={() => pick(key)}
            >
              <span className="mood-face">
                <SignGlyph kind={key} />
              </span>
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
  const note = [away.detail, awayLoc].filter(Boolean).join(" · ");

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
      <StatusSign
        label="Away"
        glyph="walk"
        title={away.main}
        note={note}
        wide={wide}
        className={`tappable away${away.time ? " has-time" : ""}${away.expired ? " expired" : ""}`}
        hero={
          away.time && (
            <div className="sign-hero">
              <BigTime className="sign-time" time={away.time.time} ampm={away.time.ampm} />
            </div>
          )
        }
        role="button"
        tabIndex={0}
        aria-label={`${away.main}. tap to change`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
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
