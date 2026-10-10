"use client";

import { useNow } from "../hooks";
import { alarmsForDevice, dayChips, fmt12, nextAlarm, untilText } from "../alarmUtil";
import { BigTime, Empty } from "./kit";
import type { WidgetProps } from "./registry";

/** The next alarm big in the tint, then the rest as a short list. */
export function AlarmsWidget({ settings, wide }: WidgetProps) {
  const now = useNow(10_000);
  const alarms = alarmsForDevice(settings.alarms, settings.deviceId);
  const next = nextAlarm(alarms, now);

  return (
    <>
      <span className="w-label">Alarms</span>
      <div className="w-body">
        <div className={`al${wide ? " wide" : ""}`}>
          {next ? (
            <div className="al-next">
              <BigTime className="al-next-time" time={fmt12(next.alarm.time).time} ampm={fmt12(next.alarm.time).ampm} />
              <div className="al-in" suppressHydrationWarning>
                {next.alarm.label ? `${next.alarm.label}, ` : "Rings "}
                {untilText(next.at, now)}
              </div>
            </div>
          ) : (
            <Empty icon="alarm">{alarms.length ? "All alarms are off" : "Add an alarm in settings"}</Empty>
          )}
          {alarms.length > 0 && (
            <div className="al-list">
              {alarms.slice(0, 3).map((a, i) => (
                <div key={i} className={`al-row${a.enabled ? "" : " off"}`}>
                  <BigTime className="al-row-time" time={fmt12(a.time).time} ampm={fmt12(a.time).ampm} />
                  <span className="al-row-label">{a.label || "Alarm"}</span>
                  <span className="al-row-days">{a.enabled ? dayChips(a.days) : "Off"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
