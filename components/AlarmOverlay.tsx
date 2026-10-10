"use client";

import { useEffect } from "react";
import type { Alarm } from "@/lib/types";
import { useNow } from "./hooks";
import { clock12 } from "./alarmUtil";
import { chime } from "./audio";
import { BigTime, MI } from "./widgets/kit";

// The ringing alarm, like iOS StandBy's: the time huge in orange on black,
// the alarm's name above it, and two big buttons (Snooze, Stop) that can be
// hit half-asleep from across the room.

export default function AlarmOverlay({
  alarm,
  onSnooze,
  onDismiss,
}: {
  alarm: Alarm;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  const label = alarm.label.trim() || "Alarm";

  useEffect(() => {
    chime();
    const id = setInterval(chime, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="alarm-overlay" role="alertdialog" aria-label={`${label}, ${time} ${ampm}`}>
      <div className="ring-face">
        <div className="ring-label">
          <MI name="alarm" className="ring-bell" />
          <span>{label}</span>
        </div>
        <div className="ring-clock">
          <BigTime tone time={time} className="ring-time" />
          <span className="ring-ampm" suppressHydrationWarning>
            {ampm}
          </span>
        </div>
      </div>
      <div className="ring-keys">
        <button className="ring-snooze" onClick={onSnooze}>
          <span>Snooze</span>
          <small>5 minutes</small>
        </button>
        <button className="btn ring-stop" onClick={onDismiss}>
          Stop
        </button>
      </div>
    </div>
  );
}
