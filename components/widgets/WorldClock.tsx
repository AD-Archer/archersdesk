"use client";

import { useNow } from "../hooks";
import { BigTime, Empty } from "./kit";
import type { WidgetProps } from "./registry";

function zoneParts(now: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    time: `${get("hour")}:${get("minute")}`,
    ampm: get("dayPeriod").toLowerCase(),
    dow: get("weekday"),
  };
}

/** Hours between here and there, like iOS's "Today, +5HRS" line. */
function offsetText(now: Date, tz: string): { day: string; diff: string } {
  const there = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const here = new Date(now.toLocaleString("en-US"));
  const hrs = Math.round(((there.getTime() - here.getTime()) / 3_600_000) * 2) / 2;
  const sameDay = there.toDateString() === here.toDateString();
  const day = sameDay ? "Today" : there.getTime() > here.getTime() ? "Tomorrow" : "Yesterday";
  const diff = hrs === 0 ? "" : `${hrs > 0 ? "+" : "−"}${Math.abs(hrs)} hr${Math.abs(hrs) === 1 ? "" : "s"}`;
  return { day, diff };
}

/** iOS world clock: one row per city — name and offset on the left, the
 *  local time big on the right. Wide, the cities sit side by side. */
export function WorldClockWidget({ settings, wide }: WidgetProps) {
  const now = useNow(10_000);
  const zones = settings.worldclock.length ? settings.worldclock : [];

  return (
    <>
      <span className="w-label">World clock</span>
      <div className="w-body">
        {zones.length === 0 ? (
          <Empty icon="public">Add a city in settings</Empty>
        ) : (
          <div className={`wc n${Math.min(zones.length, 4)}${wide ? " wide" : ""}`}>
            {zones.slice(0, 4).map((z) => {
              const t = zoneParts(now, z.tz);
              const o = offsetText(now, z.tz);
              return (
                <div key={z.tz + z.label} className="wc-row">
                  <span className="wc-place">
                    <span className="wc-city">{z.label}</span>
                    <span className="wc-day" suppressHydrationWarning>
                      {o.day}
                      {o.diff && `, ${o.diff}`}
                    </span>
                  </span>
                  <BigTime className="wc-time" time={t.time} ampm={t.ampm} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
