"use client";

import type { Presence } from "@/lib/types";
import { useNow } from "./hooks";

// Full-screen "away" sign, forced onto a display while its presence.awayUntil is
// in the future (pushed from the phone remote or set on the device itself).
// Rendered as a sibling of the dashboard so the wake lock keeps holding.

const FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

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
  const untilLabel = until
    ? sameDay
      ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(until)
      : FMT.format(until)
    : "";

  return (
    <div className="away-overlay">
      <div className="away-glow" />
      <div className="away-mark" aria-hidden="true" />
      <div className="away-title">Away</div>
      {presence.awayLocation && <div className="away-where">at {presence.awayLocation}</div>}
      {until && <div className="away-until">back {untilLabel}</div>}
      <button className="away-back" onClick={onBack}>
        I&apos;m back
      </button>
    </div>
  );
}
