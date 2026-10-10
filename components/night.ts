// Red night mode: between sunset and sunrise a display turns red (StandBy's
// night mode) unless that device has it switched off, or someone chose
// "not tonight". Client-safe; sunrise/sunset come from the weather feed.

import type { NightMode } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

export type NightState = "day" | "night" | "paused" | "off";

/** Where `now` sits relative to today's sunrise/sunset, and whether a
 *  "not tonight" press covers it. A press counts for the night that follows
 *  the daytime it was made in, or for the rest of the night it was made in. */
export function nightState(
  night: NightMode | undefined,
  sunrise: string | null | undefined,
  sunset: string | null | undefined,
  now: Date
): NightState {
  if (night && !night.enabled) return "off";
  if (!sunrise || !sunset) return "day";
  const t = now.getTime();
  const rise = new Date(sunrise).getTime();
  const set = new Date(sunset).getTime();
  if (Number.isNaN(rise) || Number.isNaN(set)) return "day";

  let dayStart: number; // the sunrise before the current night
  if (t > set) dayStart = rise;
  else if (t < rise) dayStart = rise - DAY;
  else return "day";

  const paused = night?.pausedAt ? new Date(night.pausedAt).getTime() : NaN;
  return !Number.isNaN(paused) && paused >= dayStart ? "paused" : "night";
}

/** Is "not tonight" in effect for the coming/current night, given a press time? */
export function pausedTonight(night: NightMode | undefined, sunrise: string | null | undefined, now: Date): boolean {
  if (!night?.pausedAt || !sunrise) return false;
  const rise = new Date(sunrise).getTime();
  const dayStart = now.getTime() < rise ? rise - DAY : rise;
  return new Date(night.pausedAt).getTime() >= dayStart;
}
