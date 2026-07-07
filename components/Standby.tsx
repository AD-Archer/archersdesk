"use client";

import type { DeskConfig, WeatherData } from "@/lib/types";
import { useNow, usePoll } from "./hooks";
import { clock12, fmt12, nextAlarm } from "./alarmUtil";
import { WxIcon } from "./widgets/Weather";

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function Standby({ config }: { config: DeskConfig }) {
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  const wx = usePoll<WeatherData>("/api/weather", 10 * 60 * 1000, [config.city, config.units]);
  const next = nextAlarm(config.alarms, now);

  return (
    <div className="standby">
      <div className="standby-glow" />
      <div className="standby-date">{DATE_FMT.format(now)}</div>
      <div className="standby-time">
        {time}
        <span className="standby-ampm">{ampm}</span>
      </div>
      <div className="standby-chips">
        {config.standby.show_temp && wx && !wx.error && (
          <div className="chip">
            <WxIcon kind={wx.kind} />
            <span>
              <b>{wx.temp}°</b> {wx.city.toLowerCase()}
            </span>
          </div>
        )}
        {config.standby.show_alarm && (
          <div className="chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5a6.5 6.5 0 0 1 6.5 6.5c0 3.2.9 4.4 1.7 5.5H3.8c.8-1.1 1.7-2.3 1.7-5.5A6.5 6.5 0 0 1 12 5z" />
              <path d="M10 20a2 2 0 0 0 4 0M12 2.5V5" />
            </svg>
            {next ? (
              <span>
                <b>
                  {fmt12(next.alarm.time).time} {fmt12(next.alarm.time).ampm}
                </b>{" "}
                {next.alarm.label}
              </span>
            ) : (
              <span>no alarm</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
