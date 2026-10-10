// Client-safe helpers for finding a pad and its grid, shared by the widget,
// the editor, the remote, /api/macapad and lib/settings.

import { MACAPAD_TEMPLATES, templateButtons } from "./macapadTemplates";
import {
  MACAPAD_REMOTE,
  MACAPAD_SLOTS,
  type MacapadButton,
  type MacapadPadId,
  type MacapadPads,
  type MacapadPage,
  type MacapadScreenPad,
} from "./types";

/** Who's pressing, as macapad's X-Macapad-Client headers: each screen (and the
 *  phone remote) is its own client on the mac, so each can follow its own
 *  schedule there. The id keeps that schedule when a screen is renamed. */
export function macapadClientHeaders(
  devices: Array<{ id: string; name: string }>,
  screen: string | null | undefined
): Record<string, string> {
  const device = screen === MACAPAD_REMOTE ? null : (devices.find((d) => d.id === screen) ?? devices[0]);
  const id = device ? device.id : MACAPAD_REMOTE;
  const name = device ? device.name.trim() || "Screen" : "Remote";
  // header values are ascii-only; macapad decodes the name
  return { "X-Macapad-Client": encodeURIComponent(name.slice(0, 60)), "X-Macapad-Client-Id": `archersdesk-${id}`.slice(0, 64) };
}

/** The pad id for a screen's pad page (a device id, or MACAPAD_REMOTE). */
export const screenPad = (key: string): MacapadPadId => `screen:${key}`;

/** The screen key in a pad id, or null for the widget pads. */
export function screenKey(pad: MacapadPadId): string | null {
  return pad.startsWith("screen:") ? pad.slice(7) : null;
}

export interface PadView {
  cols: number;
  rows: number;
  slots: number;
  pages: MacapadPage[];
}

/** A pad's grid and pages, or null when it doesn't exist (a deleted screen). */
export function padOf(pads: MacapadPads | undefined, pad: MacapadPadId): PadView | null {
  if (!pads) return null;
  if (pad === "small" || pad === "big") {
    const cols = pad === "big" ? 4 : 2;
    return { cols, rows: 2, slots: MACAPAD_SLOTS[pad], pages: pads[pad] };
  }
  const key = screenKey(pad);
  const sp = key !== null ? pads.screens[key] : undefined;
  return sp ? { cols: sp.cols, rows: sp.rows, slots: sp.cols * sp.rows, pages: sp.pages } : null;
}

/** Every key on every pad (a press finds its key by id across all of them). */
export function allPadButtons(pads: MacapadPads): MacapadButton[] {
  return [...pads.small, ...pads.big, ...Object.values(pads.screens).flatMap((sp) => sp.pages)]
    .flatMap((page) => page.buttons)
    .filter((b): b is MacapadButton => b !== null);
}

/** A new screen's pad page: 4×2, or 2×4 standing up on the phone remote;
 *  music + volume, then the mac's own shortcuts. Ids carry the screen key, so
 *  no two screens share a key id. */
export function defaultScreenPad(key: string): MacapadScreenPad {
  const cols = key === MACAPAD_REMOTE ? 2 : 4;
  const rows = key === MACAPAD_REMOTE ? 4 : 2;
  return {
    cols,
    rows,
    pages: ["volume", "mac"].map((tid) => {
      const t = MACAPAD_TEMPLATES.find((x) => x.id === tid)!;
      return {
        id: `${key}-${t.id}`.slice(0, 64),
        name: t.name.toLowerCase(),
        buttons: templateButtons(t, cols * rows, (i) => `${key}-${t.id}-${i}`.slice(-64)),
      };
    }),
  };
}

/** A grid label: "5 × 3". */
export const gridLabel = (cols: number, rows: number) => `${cols} × ${rows}`;

/** The screens that have a pad page, in the order to list them. */
export function padScreens(devices: Array<{ id: string; name: string }>) {
  return [...devices.map((d) => ({ key: d.id, name: d.name })), { key: MACAPAD_REMOTE, name: "Remote" }];
}
