"use client";

import type { ViewSettings } from "@/lib/types";
import { useNow } from "./hooks";
import { alarmsForDevice, clock12, fmt12, nextAlarm } from "./alarmUtil";
import { WxIcon, useWeather } from "./widgets/Weather";
import { BigTime } from "./widgets/kit";

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function Standby({ settings }: { settings: ViewSettings }) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  const wx = useWeather(settings);
  const next = nextAlarm(alarmsForDevice(settings.alarms, settings.deviceId), now);

  return (
    <div className="standby">
      <div className="standby-info" suppressHydrationWarning>
        <span className="standby-date">{DATE_FMT.format(now)}</span>
        {settings.standby.showTemp && wx && !wx.error && (
          <span className="chip">
            <WxIcon kind={wx.kind} />
            <b>{wx.temp}°</b>
          </span>
        )}
        {settings.standby.showAlarm && next && (
          <span className="chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5a6.5 6.5 0 0 1 6.5 6.5c0 3.2.9 4.4 1.7 5.5H3.8c.8-1.1 1.7-2.3 1.7-5.5A6.5 6.5 0 0 1 12 5z" />
              <path d="M10 20a2 2 0 0 0 4 0M12 2.5V5" />
            </svg>
            <b>
              {fmt12(next.alarm.time).time} {fmt12(next.alarm.time).ampm}
            </b>
          </span>
        )}
      </div>

      <BigTime className="standby-time" time={time} ampm={ampm} tone />
    </div>
  );
}
