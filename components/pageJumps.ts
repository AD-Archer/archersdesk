import type { DeviceLayout, PageJump, PageTarget } from "@/lib/types";

// The desk turning pages on its own: back to a page after it's been left
// alone, and to a page at a set time. Targets name pages ("standby", "pad",
// "2"), not positions, so they survive the pad page coming and going; the
// settings sheet keeps them pointing at the right page when one is removed.

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The desk's page index for a target: 0 is StandBy, 1..n the widget pages,
 *  then the pad page. null when it isn't there (no pad, a page since removed). */
export function targetPage(to: PageTarget, widgetPages: number, padOn: boolean): number | null {
  if (to === "standby") return 0;
  if (to === "pad") return padOn ? widgetPages + 1 : null;
  const n = Number(to);
  return n >= 1 && n <= widgetPages ? n : null;
}

/** A widget page's name, "Page 2" when it has none (`n` is 1-based). */
export function pageName(names: string[], n: number): string {
  return names[n - 1]?.trim() || `Page ${n}`;
}

/** "Standby", "Phantom" (a page's name), "Pad" */
export function targetLabel(to: PageTarget, names: string[]): string {
  return to === "standby" ? "Standby" : to === "pad" ? "Pad" : pageName(names, Number(to));
}

/** A date as the screen's own calendar has it: "2026-10-22". */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Does this jump happen at the given moment (to the minute)? */
export function jumpMatches(jump: PageJump, now: Date): boolean {
  const [h, m] = jump.at.split(":").map(Number);
  if (now.getHours() !== h || now.getMinutes() !== m) return false;
  if (jump.date) return jump.date === localDate(now);
  return jump.days.length === 0 || jump.days.includes(DAY_KEYS[now.getDay()]);
}

/** A one-time jump whose minute has gone by. */
export function jumpPast(jump: PageJump, now: Date): boolean {
  return !!jump.date && `${jump.date}T${jump.at}` < `${localDate(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Widget page `removed` (1-based) is going: its name and program go with
 *  it, targets past it move down one, targets at it go to StandBy. */
export function dropPage(
  layout: DeviceLayout,
  removed: number
): Pick<DeviceLayout, "names" | "programs" | "idle" | "schedule"> {
  const shift = (to: PageTarget): PageTarget => {
    const n = Number(to);
    if (!Number.isInteger(n)) return to;
    if (n === removed) return "standby";
    return n > removed ? (`${n - 1}` as PageTarget) : to;
  };
  return {
    names: layout.names.filter((_, i) => i !== removed - 1),
    programs: (layout.programs ?? []).filter((_, i) => i !== removed - 1),
    idle: { ...layout.idle, to: shift(layout.idle.to) },
    schedule: layout.schedule.map((j) => ({ ...j, to: shift(j.to) })),
  };
}

/** Widget page `from` moves to `to` (both 1-based), the pages between
 *  shuffling over: names and programs go with their pages, and targets
 *  follow the page they named to wherever it ends up. */
export function movePage(
  layout: DeviceLayout,
  from: number,
  to: number
): Pick<DeviceLayout, "rows" | "pages" | "names" | "programs" | "idle" | "schedule"> {
  // order[k] is the page (old number) that ends up at k + 1
  const order = layout.pages.map((_, i) => i + 1);
  order.splice(to - 1, 0, ...order.splice(from - 1, 1));
  const shift = (target: PageTarget): PageTarget => {
    const at = order.indexOf(Number(target));
    return at < 0 ? target : (`${at + 1}` as PageTarget);
  };
  const pages = order.map((o) => layout.pages[o - 1]);
  return {
    rows: pages[0],
    pages,
    names: order.map((o) => layout.names[o - 1] ?? ""),
    programs: order.map((o) => layout.programs?.[o - 1] ?? ""),
    idle: { ...layout.idle, to: shift(layout.idle.to) },
    schedule: layout.schedule.map((j) => ({ ...j, to: shift(j.to) })),
  };
}

/** A deep copy, for a new screen starting from another's layout. */
export function copyLayout(layout: DeviceLayout): DeviceLayout {
  return {
    rows: [...layout.rows],
    pages: layout.pages.map((p) => [...p]),
    names: [...layout.names],
    programs: [...(layout.programs ?? [])],
    idle: { ...layout.idle },
    schedule: layout.schedule.map((j) => ({ ...j, days: [...j.days] })),
  };
}
