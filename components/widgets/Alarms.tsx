"use client";

import { useNow } from "../hooks";
import { alarmsForDevice, dayChips, fmt12, nextAlarm, untilText } from "../alarmUtil";
import type { WidgetProps } from "./registry";

export function AlarmsWidget({ settings }: WidgetProps) {
  const now = useNow(10_000);
  const alarms = alarmsForDevice(settings.alarms, settings.deviceId);
  const next = nextAlarm(alarms, now);

  return (
    <>
      <span className="w-label">alarms</span>
      <div className="w-body">
        {next ? (
          <>
            <div className="al-next-time">
              {fmt12(next.alarm.time).time}
              <em>{fmt12(next.alarm.time).ampm}</em>
            </div>
            <div className="al-in">{untilText(next.at, now)}</div>
            <div className="al-label">{next.alarm.label}</div>
          </>
        ) : (
          <div className="al-none">
            no alarms set —<br />
            add one in settings → alarms
          </div>
        )}
        {alarms.length > 0 && (
          <div className="al-list">
            {alarms.slice(0, 3).map((a, i) => (
              <div key={i} className={`al-row${a.enabled ? "" : " off"}`}>
                <b>
                  {fmt12(a.time).time} {fmt12(a.time).ampm}
                </b>
                <span>{a.label}</span>
                <span>{a.enabled ? dayChips(a.days) : "off"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
