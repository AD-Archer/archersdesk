"use client";

import type { Presence } from "@/lib/types";
import { useNow } from "./hooks";
import { MI } from "./widgets/kit";

// Full-screen "away" sign, forced onto a display while its presence.awayUntil is
// in the future (pushed from the phone remote or set on the device itself).
// Rendered as a sibling of the dashboard so the wake lock keeps holding.
// Reads like a StandBy widget: one yellow glyph, the return time huge.

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });

/** "3:30 PM" → { hm: "3:30", ampm: "pm" } */
function timeParts(d: Date) {
  const parts = TIME.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hm: `${get("hour")}:${get("minute")}`, ampm: get("dayPeriod").toLowerCase() };
}

export default function AwayOverlay({
  presence,
  onBack,
}: {
  presence: Presence;
  onBack: () => void;
}) {
  const now = useNow(1000);
  const until = presence.awayUntil ? new Date(presence.awayUntil) : null;
  const sameDay = until ? until.toDateString() === now.toDateString() : false;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const dayLabel = !until || sameDay
    ? ""
    : until.toDateString() === tomorrow.toDateString()
      ? "tomorrow"
      : WEEKDAY.format(until);
  const t = until ? timeParts(until) : null;
  const where = presence.awayLocation.trim();

  return (
    <div className="away-overlay">
      <div className="away-sign">
        <MI name="directions_walk" className="away-glyph" />

        <div className="away-text">
          {t ? (
            <>
              <div className="away-lead">Away until{dayLabel ? ` ${dayLabel}` : ""}</div>
              <div className="away-time" aria-label={`${t.hm} ${t.ampm}`}>
                {t.hm}
                <span className="away-ampm">{t.ampm}</span>
              </div>
            </>
          ) : (
            <div className="away-time away-word">Away</div>
          )}
          {where && (
            <div className="away-where">
              <MI name="place" />
              <span>{where}</span>
            </div>
          )}
        </div>
      </div>

      <button className="btn away-back" onClick={onBack}>
        I&apos;m back
      </button>
    </div>
  );
}
