"use client";

import { useEffect } from "react";
import type { Alarm } from "@/lib/types";
import { useNow } from "./hooks";
import { clock12 } from "./alarmUtil";
import { chime } from "./audio";

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

  useEffect(() => {
    chime();
    const id = setInterval(chime, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="alarm-overlay">
      <div className="alarm-time">
        {time}
        <span className="standby-ampm">{ampm}</span>
      </div>
      <div className="alarm-label">{alarm.label}</div>
      <div className="alarm-actions">
        <button className="btn-snooze" onClick={onSnooze}>
          snooze 5 min
        </button>
        <button className="btn-dismiss" onClick={onDismiss}>
          dismiss
        </button>
      </div>
    </div>
  );
}
