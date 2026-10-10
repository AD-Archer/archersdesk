"use client";

import { useNow } from "../hooks";
import type { WidgetProps } from "./registry";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_SHORT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });
const MONTH_LONG = new Intl.DateTimeFormat("en-US", { month: "long" });

/** StandBy's month: a red month name over the grid, today in a red disc.
 *  Wide, it adds the big "Sat Oct / 10" date on the left like StandBy. */
export function CalendarWidget({ wide }: WidgetProps) {
  const now = useNow(60_000);
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const lead = new Date(year, month, 1).getDay(); // sunday-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className={`hero-cal${wide ? " wide" : ""}`} suppressHydrationWarning>
      {wide && (
        <div className="hero-date">
          <div className="hero-date-head">
            <span className="hero-date-dow">{DOW_SHORT.format(now)}</span>{" "}
            <span className="hero-date-mon">{MONTH_SHORT.format(now)}</span>
          </div>
          <div className="hero-date-num">{today}</div>
        </div>
      )}
      <div className="cal">
        <div className="cal-head">{MONTH_LONG.format(now)}</div>
        <div className="cal-grid">
          {DOW.map((d, i) => (
            <div key={`h${i}`} className={`cal-dow${i === 0 || i === 6 ? " weekend" : ""}`}>
              {d}
            </div>
          ))}
          {cells.map((n, i) => (
            <div
              key={i}
              className={`cal-day${n === today ? " today" : ""}${i % 7 === 0 || i % 7 === 6 ? " weekend" : ""}`}
              aria-current={n === today ? "date" : undefined}
            >
              {n ?? ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
