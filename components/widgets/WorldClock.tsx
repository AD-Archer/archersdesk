"use client";

import { useNow } from "../hooks";
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
    dow: get("weekday").toLowerCase(),
  };
}

export function WorldClockWidget({ settings }: WidgetProps) {
  const now = useNow(10_000);
  const zones = settings.worldclock.length ? settings.worldclock : [];
  const localDow = now.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();

  return (
    <>
      <span className="w-label">world clock</span>
      <div className="w-body">
        {zones.length === 0 ? (
          <div className="w-empty">no zones configured</div>
        ) : (
          <div className="wc">
            {zones.slice(0, 4).map((z) => {
              const t = zoneParts(now, z.tz);
              return (
                <div key={z.tz + z.label} className="wc-row">
                  <span className="wc-city">{z.label}</span>
                  <span className="wc-time" suppressHydrationWarning>
                    {t.time}
                    <em>{t.ampm}</em>
                    {t.dow !== localDow && <span className="wc-day">{t.dow}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
