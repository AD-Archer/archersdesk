"use client";

import { useMounted, useNow } from "../hooks";
import { clock12 } from "../alarmUtil";
import type { WidgetProps } from "./registry";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function ClockWidget({ wide }: WidgetProps) {
  const now = useNow(1000);
  const mounted = useMounted();
  const { time, ampm } = clock12(now);
  const pct = ((now.getSeconds() + 1) / 60) * 100;
  return (
    <>
      <span className="w-label">clock</span>
      <div className="w-body">
        <div className="clock-time" suppressHydrationWarning>
          {time}
          <span className="clock-ampm">{ampm}</span>
        </div>
        <div className="clock-date" suppressHydrationWarning>
          {DATE_FMT.format(now)}
        </div>
        {!wide && mounted && (
          <div className="clock-seconds-bar">
            <b style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </>
  );
}

export function AnalogWidget(_: WidgetProps) {
  const now = useNow(1000);
  const mounted = useMounted();
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  const sa = s * 6;
  const ma = m * 6 + s * 0.1;
  const ha = h * 30 + m * 0.5;

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const major = i % 3 === 0;
    const r1 = major ? 82 : 87;
    return (
      <line
        key={i}
        x1={100 + Math.sin(a) * r1}
        y1={100 - Math.cos(a) * r1}
        x2={100 + Math.sin(a) * 93}
        y2={100 - Math.cos(a) * 93}
        stroke={major ? "var(--cream-dim)" : "var(--faint)"}
        strokeWidth={major ? 3 : 1.5}
        strokeLinecap="round"
      />
    );
  });

  return (
    <>
      <span className="w-label">clock</span>
      <div className="w-body">
        <svg className="an-svg" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="97" fill="none" stroke="var(--line)" strokeWidth="1.5" />
          {ticks}
          {mounted && (
            <>
              <g transform={`rotate(${ha} 100 100)`}>
                <line x1="100" y1="108" x2="100" y2="54" stroke="var(--cream)" strokeWidth="6" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${ma} 100 100)`}>
                <line x1="100" y1="110" x2="100" y2="32" stroke="var(--cream)" strokeWidth="3.5" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${sa} 100 100)`}>
                <line x1="100" y1="116" x2="100" y2="26" stroke="var(--amber)" strokeWidth="1.6" strokeLinecap="round" />
              </g>
            </>
          )}
          <circle cx="100" cy="100" r="5" fill="var(--amber)" />
          <circle cx="100" cy="100" r="2" fill="var(--bg)" />
        </svg>
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
        <div
          className="clock-time"
          style={{ fontSize: wide ? undefined : "calc(var(--ps) * 0.24)" }}
          suppressHydrationWarning
        >
          {time}
          <span className="clock-ampm">{ampm}</span>
        </div>
        <div className="clock-date" suppressHydrationWarning>
          {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>
    </>
  );
}
