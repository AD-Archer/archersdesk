"use client";

import { useNow } from "../hooks";
import type { WidgetProps } from "./registry";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarWidget(_: WidgetProps) {
  const now = useNow(60_000);
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const lead = first.getDay(); // sunday-start

  const cells: Array<{ n: number; out: boolean; today: boolean }> = [];
  for (let i = lead - 1; i >= 0; i--) cells.push({ n: daysInPrev - i, out: true, today: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ n: d, out: false, today: d === today });
  while (cells.length % 7 !== 0) cells.push({ n: cells.length - lead - daysInMonth + 1, out: true, today: false });

  return (
    <>
      <span className="w-label">calendar</span>
      <div className="w-body">
        <div className="cal">
          <div className="cal-head">
            {now.toLocaleDateString("en-US", { month: "long" })} <span>{year}</span>
          </div>
          <div className="cal-grid">
            {DOW.map((d, i) => (
              <div key={`h${i}`} className="cal-dow">
                {d}
              </div>
            ))}
            {cells.map((c, i) => (
              <div key={i} className={`cal-day${c.out ? " out" : ""}${c.today ? " today" : ""}`}>
                {c.n}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
