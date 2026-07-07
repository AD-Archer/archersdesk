"use client";

import { useNow } from "../hooks";
import { dayChips, fmt12, nextAlarm, untilText } from "../alarmUtil";
import type { WidgetProps } from "./registry";

export function AlarmsWidget({ config }: WidgetProps) {
  const now = useNow(10_000);
  const next = nextAlarm(config.alarms, now);

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
            add them in your yaml config
          </div>
        )}
        {config.alarms.length > 0 && (
          <div className="al-list">
            {config.alarms.slice(0, 3).map((a, i) => (
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
