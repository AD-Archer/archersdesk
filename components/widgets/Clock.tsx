"use client";

import { useNow } from "../hooks";
import { clock12 } from "../alarmUtil";
import type { WidgetProps } from "./registry";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function ClockWidget({ wide }: WidgetProps) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  const pct = ((now.getSeconds() + 1) / 60) * 100;
  return (
    <>
      <span className="w-label">clock</span>
      <div className="w-body">
        <div className="clock-time">
          {time}
          <span className="clock-ampm">{ampm}</span>
        </div>
        <div className="clock-date">{DATE_FMT.format(now)}</div>
        {!wide && (
          <div className="clock-seconds-bar">
            <b style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </>
  );
}

export function DateWidget(_: WidgetProps) {
  const now = useNow(30_000);
  return (
    <>
      <span className="w-label">today</span>
      <div className="w-body">
        <div className="date-weekday">{now.toLocaleDateString("en-US", { weekday: "long" })}</div>
        <div className="date-num">{now.getDate()}</div>
        <div className="date-month">
          {now.toLocaleDateString("en-US", { month: "long" })} {now.getFullYear()}
        </div>
      </div>
    </>
  );
}

export function DatetimeWidget({ wide }: WidgetProps) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  return (
    <>
      <span className="w-label">date &amp; time</span>
      <div className="w-body">
        <div className="date-weekday">{now.toLocaleDateString("en-US", { weekday: "long" })}</div>
        <div className="clock-time" style={{ fontSize: wide ? undefined : "calc(var(--ps) * 0.24)" }}>
          {time}
          <span className="clock-ampm">{ampm}</span>
        </div>
        <div className="clock-date">
          {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>
    </>
  );
}
