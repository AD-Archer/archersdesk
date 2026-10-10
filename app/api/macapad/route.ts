import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { mutateUserSettings, sanitizeMacapadButton } from "@/lib/settings";
import { gridLabel, padOf, screenKey } from "@/lib/macapad";
import { MACAPAD_TEMPLATES, templateButtons } from "@/lib/macapadTemplates";
import {
  MACAPAD_GRID,
  MACAPAD_MAX_PAGES,
  type MacapadButton,
  type MacapadPadId,
  type MacapadPads,
  type MacapadPage,
  type Settings,
} from "@/lib/types";

// Dedicated write channel for the macapad editor (settings → macapad) — like
// /api/embeds: one focused mutation per edit. The pads are owned here; full
// settings writes (PUT /api/settings) always keep the stored pads. Pages and
// slots are addressed by page id + slot index, so a stale tab can't hit the
// wrong page after another device reorders them.
//
// `pad` is "small", "big", or a pad page: "screen:<device id>" / "screen:remote"
// (the old `size: "small"|"big"` still works).
//
//   set        {pad, page, index, button|null}       fill or clear one slot
//   move       {pad, from:{page,index}, to:{page,index}}  swap two slots (any pages)
//   addPage    {pad, name?, template?}               → also returns {page: newId}
//              (template: a lib/macapadTemplates id — the page comes filled)
//   applyTemplate {pad, page, template}             replace a page's keys with a template's
//              (the page takes the template's name unless it was given its own)
//   renamePage {pad, page, name}
//   movePage   {pad, page, by: -1|1} or {pad, page, to: index}  (to: drag / typed position)
//   removePage {pad, page}                           (a pad keeps at least one page)
//   setGrid    {pad: "screen:…", cols, rows}         keys keep their row and column
//              where they still fit; the rest fill empty slots on their page,
//              then spill onto new pages right after it ("music 2")

type Pages = MacapadPage[];

function padId(p: Record<string, unknown>): MacapadPadId | null {
  const v = p.pad ?? p.size;
  if (v === "small" || v === "big") return v;
  return typeof v === "string" && /^screen:[\w-]{1,64}$/.test(v) ? (v as MacapadPadId) : null;
}

function slotIndex(slots: number, v: unknown): number | null {
  const i = Number(v);
  return Number.isInteger(i) && i >= 0 && i < slots ? i : null;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/** The pads with `pad`'s pages replaced. */
function withPages(m: MacapadPads, pad: MacapadPadId, pages: Pages): MacapadPads {
  if (pad === "small" || pad === "big") return { ...m, [pad]: pages };
  const key = screenKey(pad)!;
  return { ...m, screens: { ...m.screens, [key]: { ...m.screens[key], pages } } };
}

/** Re-lay one page for a new grid: keys keep their row and column where
 *  they fit, then fill its empty slots; any left over spill onto new pages
 *  that follow it. */
function regrid(page: MacapadPage, from: { cols: number }, cols: number, rows: number): MacapadPage[] {
  const slots = cols * rows;
  const buttons: (MacapadButton | null)[] = Array(slots).fill(null);
  const homeless: MacapadButton[] = [];
  page.buttons.forEach((b, i) => {
    if (!b) return;
    const r = Math.floor(i / from.cols);
    const c = i % from.cols;
    if (r < rows && c < cols) buttons[r * cols + c] = b;
    else homeless.push(b);
  });
  while (homeless.length && buttons.includes(null)) buttons[buttons.indexOf(null)] = homeless.shift()!;
  const out: MacapadPage[] = [{ ...page, buttons }];
  for (let n = 2; homeless.length; n++) {
    const spill = homeless.splice(0, slots);
    out.push({
      id: crypto.randomUUID(),
      name: `${page.name} ${n}`.slice(0, 30),
      buttons: Array.from({ length: slots }, (_, i) => spill[i] ?? null),
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const { action, payload } = (await req.json().catch(() => ({}))) as { action?: string; payload?: unknown };
  const p = (payload ?? {}) as Record<string, unknown>;
  const pad = padId(p);
  if (!pad) return bad("pad must be small, big or screen:<id>");

  // run one edit on this pad's pages; the edit returns an error string to refuse
  let failure: string | null = null;
  let created: string | null = null;
  const refuse = (current: Settings, why: string) => {
    failure = why;
    return current;
  };
  const edit = (fn: (pages: Pages, slots: number) => Pages | string) =>
    mutateUserSettings(user.id, (current: Settings) => {
      const found = padOf(current.macapad, pad);
      if (!found) return refuse(current, "that screen no longer exists");
      const result = fn(
        found.pages.map((pg) => ({ ...pg, buttons: [...pg.buttons] })),
        found.slots
      );
      if (typeof result === "string") return refuse(current, result);
      return { ...current, macapad: withPages(current.macapad, pad, result) };
    });

  let settings: Settings;
  switch (action) {
    case "set": {
      const button = p.button === null ? null : sanitizeMacapadButton(p.button);
      if (p.button !== null && !button) return bad("a button needs at least one step");
      settings = edit((pages, slots) => {
        const index = slotIndex(slots, p.index);
        if (index === null) return "that slot isn't on this pad";
        const page = pages.find((pg) => pg.id === p.page);
        if (!page) return "that page no longer exists";
        page.buttons[index] = button;
        return pages;
      });
      break;
    }
    case "move": {
      const from = (p.from ?? {}) as Record<string, unknown>;
      const to = (p.to ?? {}) as Record<string, unknown>;
      settings = edit((pages, slots) => {
        const fi = slotIndex(slots, from.index);
        const ti = slotIndex(slots, to.index);
        if (fi === null || ti === null) return "that slot isn't on this pad";
        const fp = pages.find((pg) => pg.id === from.page);
        const tp = pages.find((pg) => pg.id === to.page);
        if (!fp || !tp) return "that page no longer exists";
        [fp.buttons[fi], tp.buttons[ti]] = [tp.buttons[ti], fp.buttons[fi]];
        return pages;
      });
      break;
    }
    case "addPage": {
      const template = p.template === undefined ? null : MACAPAD_TEMPLATES.find((t) => t.id === p.template);
      if (template === undefined) return bad("no such template");
      settings = edit((pages, slots) => {
        if (pages.length >= MACAPAD_MAX_PAGES) return `a pad can have up to ${MACAPAD_MAX_PAGES} pages`;
        created = crypto.randomUUID();
        const name =
          typeof p.name === "string" && p.name.trim()
            ? p.name.trim().slice(0, 30)
            : (template?.name.toLowerCase() ?? `page ${pages.length + 1}`);
        const buttons = template
          ? templateButtons(template, slots, () => crypto.randomUUID())
          : Array(slots).fill(null);
        return [...pages, { id: created, name, buttons }];
      });
      break;
    }
    case "applyTemplate": {
      const template = MACAPAD_TEMPLATES.find((t) => t.id === p.template);
      if (!template) return bad("no such template");
      settings = edit((pages, slots) => {
        const page = pages.find((pg) => pg.id === p.page);
        if (!page) return "that page no longer exists";
        page.buttons = templateButtons(template, slots, () => crypto.randomUUID());
        // "page 3" was never really named: it becomes "developer"
        if (!page.name.trim() || /^page \d+$/i.test(page.name.trim())) page.name = template.name.toLowerCase();
        return pages;
      });
      break;
    }
    case "renamePage": {
      settings = edit((pages) => {
        const page = pages.find((pg) => pg.id === p.page);
        if (!page) return "that page no longer exists";
        page.name = typeof p.name === "string" ? p.name : page.name;
        return pages;
      });
      break;
    }
    case "movePage": {
      settings = edit((pages) => {
        const i = pages.findIndex((pg) => pg.id === p.page);
        if (i < 0) return "that page no longer exists";
        const to = Number(p.to);
        const j = Number.isInteger(to)
          ? Math.min(pages.length - 1, Math.max(0, to))
          : i + (p.by === -1 ? -1 : 1);
        if (j < 0 || j >= pages.length || j === i) return pages;
        const [moved] = pages.splice(i, 1);
        pages.splice(j, 0, moved);
        return pages;
      });
      break;
    }
    case "removePage": {
      settings = edit((pages) => {
        if (pages.length <= 1) return "a pad needs at least one page";
        const next = pages.filter((pg) => pg.id !== p.page);
        return next.length === pages.length ? "that page no longer exists" : next;
      });
      break;
    }
    case "setGrid": {
      const key = screenKey(pad);
      if (key === null) return bad("only a pad page has a grid to change");
      const cols = Number(p.cols);
      const rows = Number(p.rows);
      const { minCols, maxCols, minRows, maxRows } = MACAPAD_GRID;
      if (!Number.isInteger(cols) || cols < minCols || cols > maxCols) return bad(`columns go from ${minCols} to ${maxCols}`);
      if (!Number.isInteger(rows) || rows < minRows || rows > maxRows) return bad(`rows go from ${minRows} to ${maxRows}`);
      settings = mutateUserSettings(user.id, (current) => {
        const sp = current.macapad.screens[key];
        if (!sp) return refuse(current, "that screen no longer exists");
        const pages = sp.pages.flatMap((page) => regrid(page, sp, cols, rows));
        if (pages.length > MACAPAD_MAX_PAGES)
          return refuse(
            current,
            `a ${gridLabel(cols, rows)} grid would need ${pages.length} pages for these keys (a pad holds ${MACAPAD_MAX_PAGES}). Remove some keys or pages first.`
          );
        return { ...current, macapad: { ...current.macapad, screens: { ...current.macapad.screens, [key]: { cols, rows, pages } } } };
      });
      break;
    }
    default:
      return bad(`unknown action "${action}"`);
  }

  if (failure) return NextResponse.json({ error: failure, macapad: settings.macapad }, { status: 409 });
  return NextResponse.json({ macapad: settings.macapad, ...(created ? { page: created } : {}) });
}
