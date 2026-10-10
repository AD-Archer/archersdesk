"use client";

import { useMounted, useNow } from "../hooks";
import { clock12 } from "../alarmUtil";
import { BigTime } from "./kit";
import type { WidgetProps } from "./registry";

const DOW_SHORT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });
const DATE_LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

/** StandBy's digital clock: the time fills the half, two tones of green. */
export function ClockWidget({ wide }: WidgetProps) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  return (
    <div className={`hero-clock${wide ? " wide" : ""}`}>
      <div className="hero-clock-date" suppressHydrationWarning>
        {DATE_LONG.format(now)}
      </div>
      <BigTime className="hero-clock-time" time={time} tone />
      <div className="hero-clock-ampm" suppressHydrationWarning>
        {ampm}
      </div>
    </div>
  );
}

/** StandBy's analog face: white numerals, white hands, an orange second hand. */
export function AnalogWidget(_: WidgetProps) {
  const now = useNow(1000);
  const mounted = useMounted();
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  const sa = s * 6;
  const ma = m * 6 + s * 0.1;
  const ha = h * 30 + m * 0.5;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 * Math.PI) / 180;
    const hour = i % 5 === 0;
    const r1 = hour ? 89 : 91;
    return (
      <line
        key={i}
        x1={100 + Math.sin(a) * r1}
        y1={100 - Math.cos(a) * r1}
        x2={100 + Math.sin(a) * 97}
        y2={100 - Math.cos(a) * 97}
        stroke={hour ? "#fff" : "rgba(235,235,245,0.45)"}
        strokeWidth={hour ? 2.2 : 1.1}
        strokeLinecap="round"
      />
    );
  });

  const numerals = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const a = (n * 30 * Math.PI) / 180;
    return (
      <text key={n} x={100 + Math.sin(a) * 74} y={100 - Math.cos(a) * 74} className="an-num">
        {n}
      </text>
    );
  });

  return (
    <div className="hero-analog">
      <svg className="an-svg" viewBox="0 0 200 200" role="img" aria-label={`${h || 12}:${String(m).padStart(2, "0")}`}>
        {ticks}
        {numerals}
        {mounted && (
          <>
            <g transform={`rotate(${ha} 100 100)`}>
              <line x1="100" y1="100" x2="100" y2="88" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <line x1="100" y1="88" x2="100" y2="50" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" />
            </g>
            <g transform={`rotate(${ma} 100 100)`}>
              <line x1="100" y1="100" x2="100" y2="88" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <line x1="100" y1="88" x2="100" y2="22" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" />
            </g>
            <circle cx="100" cy="100" r="5.5" fill="#fff" />
            <g className="an-sec" transform={`rotate(${sa} 100 100)`}>
              <line x1="100" y1="118" x2="100" y2="12" stroke="var(--tint)" strokeWidth="1.6" strokeLinecap="round" />
            </g>
            <circle cx="100" cy="100" r="3.6" fill="var(--tint)" />
            <circle cx="100" cy="100" r="1.5" fill="#000" />
          </>
        )}
      </svg>
    </div>
  );
}

/** StandBy's date: "Sat Oct" over one huge white day number. */
export function DateWidget({ wide }: WidgetProps) {
  const now = useNow(30_000);
  return (
    <div className={`hero-date${wide ? " wide" : ""}`} suppressHydrationWarning>
      <div className="hero-date-head">
        <span className="hero-date-dow">{DOW_SHORT.format(now)}</span>{" "}
        <span className="hero-date-mon">{MONTH_SHORT.format(now)}</span>
      </div>
      <div className="hero-date-num">{now.getDate()}</div>
    </div>
  );
}

/** Date over time: the weekday in red, the time big and white. */
export function DatetimeWidget({ wide }: WidgetProps) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  return (
    <div className={`hero-dt${wide ? " wide" : ""}`} suppressHydrationWarning>
      <div className="hero-date-head">
        <span className="hero-date-dow">{DOW_SHORT.format(now)}</span>{" "}
        <span className="hero-date-mon">
          {MONTH_SHORT.format(now)} {now.getDate()}
        </span>
      </div>
      <BigTime className="hero-dt-time" time={time} ampm={ampm} />
    </div>
  );
}
