import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { mutateUserSettings, sanitizeMacapadButton } from "@/lib/settings";
import { MACAPAD_MAX_PAGES, MACAPAD_SLOTS, type MacapadPage, type MacapadSize, type Settings } from "@/lib/types";

// Dedicated write channel for the macapad editor (settings → macapad) — like
// /api/embeds: one focused mutation per edit. The pads are owned here; full
// settings writes (PUT /api/settings) always keep the stored pads. Pages and
// slots are addressed by page id + slot index, so a stale tab can't hit the
// wrong page after another device reorders them.
//
//   set        {size, page, index, button|null}       fill or clear one slot
//   move       {size, from:{page,index}, to:{page,index}}  swap two slots (any pages)
//   addPage    {size, name?}                          → also returns {page: newId}
//   renamePage {size, page, name}
//   movePage   {size, page, by: -1|1}
//   removePage {size, page}                           (a pad keeps at least one page)

type Pages = MacapadPage[];

function size(v: unknown): MacapadSize | null {
  return v === "small" || v === "big" ? v : null;
}

function slotIndex(s: MacapadSize, v: unknown): number | null {
  const i = Number(v);
  return Number.isInteger(i) && i >= 0 && i < MACAPAD_SLOTS[s] ? i : null;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const { action, payload } = (await req.json().catch(() => ({}))) as { action?: string; payload?: unknown };
  const p = (payload ?? {}) as Record<string, unknown>;
  const s = size(p.size);
  if (!s) return bad("size must be small or big");

  // run one edit on this pad's pages; the edit returns an error string to refuse
  let failure: string | null = null;
  let created: string | null = null;
  const edit = (fn: (pages: Pages) => Pages | string) =>
    mutateUserSettings(user.id, (current: Settings) => {
      const result = fn(current.macapad[s].map((pg) => ({ ...pg, buttons: [...pg.buttons] })));
      if (typeof result === "string") {
        failure = result;
        return current;
      }
      return { ...current, macapad: { ...current.macapad, [s]: result } };
    });

  let settings: Settings;
  switch (action) {
    case "set": {
      const index = slotIndex(s, p.index);
      if (index === null) return bad("bad slot");
      const button = p.button === null ? null : sanitizeMacapadButton(p.button);
      if (p.button !== null && !button) return bad("a button needs at least one step");
      settings = edit((pages) => {
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
      const fi = slotIndex(s, from.index);
      const ti = slotIndex(s, to.index);
      if (fi === null || ti === null) return bad("bad slot");
      settings = edit((pages) => {
        const fp = pages.find((pg) => pg.id === from.page);
        const tp = pages.find((pg) => pg.id === to.page);
        if (!fp || !tp) return "that page no longer exists";
        [fp.buttons[fi], tp.buttons[ti]] = [tp.buttons[ti], fp.buttons[fi]];
        return pages;
      });
      break;
    }
    case "addPage": {
      settings = edit((pages) => {
        if (pages.length >= MACAPAD_MAX_PAGES) return `a pad can have up to ${MACAPAD_MAX_PAGES} pages`;
        created = crypto.randomUUID();
        const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : `page ${pages.length + 1}`;
        return [...pages, { id: created, name, buttons: Array(MACAPAD_SLOTS[s]).fill(null) }];
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
        const j = i + (p.by === -1 ? -1 : 1);
        if (i < 0) return "that page no longer exists";
        if (j < 0 || j >= pages.length) return pages;
        [pages[i], pages[j]] = [pages[j], pages[i]];
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
    default:
      return bad(`unknown action "${action}"`);
  }

  if (failure) return NextResponse.json({ error: failure, macapad: settings.macapad }, { status: 409 });
  return NextResponse.json({ macapad: settings.macapad, ...(created ? { page: created } : {}) });
}
