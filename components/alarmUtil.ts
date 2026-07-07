import type { Alarm } from "@/lib/types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface NextAlarm {
  alarm: Alarm;
  at: Date;
}

/** Next occurrence across all enabled alarms, searching the coming week. */
export function nextAlarm(alarms: Alarm[], from: Date = new Date()): NextAlarm | null {
  let best: NextAlarm | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [h, m] = alarm.time.split(":").map(Number);
    for (let d = 0; d < 8; d++) {
      const at = new Date(from);
      at.setDate(at.getDate() + d);
      at.setHours(h, m, 0, 0);
      if (at.getTime() <= from.getTime()) continue;
      if (alarm.days.length && !alarm.days.includes(DAY_KEYS[at.getDay()])) continue;
      if (!best || at < best.at) best = { alarm, at };
      break;
    }
  }
  return best;
}

/** Does this alarm fire at the given moment? */
export function alarmMatches(alarm: Alarm, now: Date): boolean {
  if (!alarm.enabled) return false;
  const [h, m] = alarm.time.split(":").map(Number);
  if (now.getHours() !== h || now.getMinutes() !== m) return false;
  return alarm.days.length === 0 || alarm.days.includes(DAY_KEYS[now.getDay()]);
}

/** "07:30" → { time: "7:30", ampm: "am" } */
export function fmt12(hhmm: string): { time: string; ampm: string } {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return { time: `${hr}:${String(m).padStart(2, "0")}`, ampm };
}

export function clock12(d: Date): { time: string; ampm: string } {
  return fmt12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
}

export function untilText(at: Date, from: Date): string {
  const mins = Math.max(0, Math.round((at.getTime() - from.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

export function dayChips(days: string[]): string {
  if (!days.length) return "every day";
  if (days.length === 7) return "every day";
  const weekdays = ["mon", "tue", "wed", "thu", "fri"];
  if (days.length === 5 && weekdays.every((d) => days.includes(d))) return "weekdays";
  if (days.length === 2 && days.includes("sat") && days.includes("sun")) return "weekends";
  return days.join(" · ");
}
