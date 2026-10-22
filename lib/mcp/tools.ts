import crypto from "node:crypto";
import { copyLayout, dropPage, pageName, targetLabel } from "@/components/pageJumps";
import { getDb } from "../db";
import { getUserSettings, mutateUserSettings, setPresence } from "../settings";
import {
  MAX_ROWS,
  MAX_WIDGET_PAGES,
  VIBES,
  WIDGET_CATEGORIES,
  WIDGET_INFO,
  WIDGETS,
  type Device,
  type DeviceLayout,
  type LayoutRow,
  type PageJump,
  type PageTarget,
  type Settings,
  type WidgetName,
} from "../types";
import type { McpScope } from "./scopes";
import type { McpContext } from "./tokens";

// Everything an MCP client (or the REST mirror) can do to a desk, as one list.
// Each tool is a name, a JSON schema for its arguments, the scope it needs and
// a handler. The MCP route, /api/v1/<tool>, /openapi.json and /docs all read
// this list, so they can't drift apart.
//
// The words are the app's own: a screen is a device, a page is a widget page
// (1 is the first one after Standby), a card is a widget in a row, a set time
// is a timed page jump. Writes go through mutateUserSettings, which sanitises
// and bumps the version, so every screen picks the change up on its next poll.

type Args = Record<string, unknown>;

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  scope: McpScope;
  input: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Args, ctx: McpContext) => unknown | Promise<unknown>;
}

/** A mistake the caller can fix: shown to them as the tool's answer. */
export class ToolError extends Error {}

/** The token isn't allowed to do that (a 403 on the REST mirror). */
export class ScopeError extends ToolError {}

const fail = (message: string): never => {
  throw new ToolError(message);
};

// ── shared schema pieces ───────────────────────────────────────────

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const screenProp = {
  type: "string",
  description: "The screen's name or id. Can be left out when the token (or the account) has just one screen.",
};
const pageProp = {
  type: ["integer", "string"],
  description: "A page: its number (1 is the first page after Standby) or its name.",
};
const widgetProp = { type: "string", enum: [...WIDGETS], description: "A widget; list_widgets describes them all." };
const rowProp = {
  type: "object",
  description: "A row: two square cards side by side ({left, right}) or one wide card ({wide}).",
  properties: { left: widgetProp, right: widgetProp, wide: widgetProp },
  additionalProperties: false,
};
const targetProp = {
  type: ["string", "integer"],
  description: '"standby", "pad", or a page by number or name.',
};
const timeProp = {
  type: "string",
  pattern: "^([01]?\\d|2[0-3]):[0-5]\\d$",
  description: 'A 24-hour time on the screen\'s own clock, like "16:15".',
};
const daysProp = {
  type: "array",
  items: { type: "string", enum: DAYS },
  description: "The days it repeats on. Empty or left out means every day.",
};
const dateProp = {
  type: ["string", "null"],
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  description: 'Just once, on this date ("2026-10-22"), instead of repeating. null makes it repeat again.',
};

function object(properties: Record<string, unknown>, required: string[] = []): ToolDef["input"] {
  return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

// ── reading the desk ───────────────────────────────────────────────

const lower = (v: unknown) => String(v ?? "").trim().toLowerCase();

function screensFor(s: Settings, ctx: McpContext): Device[] {
  return s.devices.filter((d) => ctx.screens.length === 0 || ctx.screens.includes(d.id));
}

function findScreen(s: Settings, ref: unknown, ctx: McpContext): Device {
  const pool = screensFor(s, ctx);
  if (ref === undefined || ref === null || ref === "") {
    if (pool.length === 1) return pool[0];
    return fail(`say which screen: ${pool.map((d) => `"${d.name}"`).join(", ")}`);
  }
  const d = s.devices.find((x) => x.id === ref) ?? s.devices.find((x) => lower(x.name) === lower(ref));
  if (!d) return fail(`there's no screen called "${ref}"; there's ${pool.map((x) => `"${x.name}"`).join(", ")}`);
  if (!pool.includes(d)) throw new ScopeError(`this token can't reach the "${d.name}" screen`);
  return d;
}

/** A page as a 0-based index, from its number or its name. */
function findPage(d: Device, ref: unknown): number {
  const { pages, names } = d.layout;
  if (typeof ref === "number" || /^\d+$/.test(String(ref ?? ""))) {
    const n = Number(ref);
    if (n >= 1 && n <= pages.length) return n - 1;
    return fail(`"${d.name}" has pages 1 to ${pages.length}`);
  }
  const i = names.findIndex((n) => n.trim() && lower(n) === lower(ref));
  if (i >= 0) return i;
  return fail(`"${d.name}" has no page "${ref}"; its pages are ${pages.map((_, k) => `"${pageName(names, k + 1)}"`).join(", ")}`);
}

function findTarget(d: Device, ref: unknown): PageTarget {
  if (lower(ref) === "standby") return "standby";
  if (lower(ref) === "pad") return "pad";
  return `${findPage(d, ref) + 1}` as PageTarget;
}

function widget(v: unknown): WidgetName {
  return (WIDGETS as readonly string[]).includes(String(v))
    ? (v as WidgetName)
    : fail(`"${v}" isn't a widget; list_widgets has the names`);
}

function rowIn(v: unknown): LayoutRow {
  const r = (v && typeof v === "object" ? v : {}) as Args;
  if (r.wide !== undefined) return { type: "dual", widget: widget(r.wide) };
  if (r.left !== undefined && r.right !== undefined) return { type: "split", left: widget(r.left), right: widget(r.right) };
  return fail("a row is {left, right} for two squares or {wide} for one wide card");
}

const rowOut = (r: LayoutRow) => (r.type === "dual" ? { wide: r.widget } : { left: r.left, right: r.right });

function whenOut(j: PageJump) {
  return j.date ? { once_on: j.date } : { repeats: j.days.length ? j.days : "every day" };
}

function screenOut(d: Device, s: Settings) {
  const padOn = Boolean(s.integrations.macapad.url && s.integrations.macapad.token);
  const { names } = d.layout;
  return {
    id: d.id,
    name: d.name,
    location: { place: d.location.name, region: d.location.region, latitude: d.location.latitude, longitude: d.location.longitude },
    order: ["Standby", ...d.layout.pages.map((_, i) => pageName(names, i + 1)), ...(padOn ? ["Pad"] : [])],
    pages: d.layout.pages.map((rows, i) => ({
      page: i + 1,
      name: pageName(names, i + 1),
      ...(d.layout.programs?.[i] ? { program: d.layout.programs[i] } : {}),
      rows: rows.map(rowOut),
    })),
    set_times: d.layout.schedule.map((j, i) => ({
      set_time: i + 1,
      at: j.at,
      show: targetLabel(j.to, names),
      ...whenOut(j),
      stay_minutes: j.minutes || "until touched",
    })),
    idle_return: d.layout.idle.minutes
      ? { after_minutes: d.layout.idle.minutes, to: targetLabel(d.layout.idle.to, names) }
      : "off",
    standby: { show_temperature: d.standby.showTemp, show_next_alarm: d.standby.showAlarm },
    night_mode: d.night.enabled,
    away: d.presence.awayUntil ? { until: d.presence.awayUntil, note: d.presence.awayLocation } : null,
    vibe: d.presence.vibe,
  };
}

// accounts: a field is a secret when its name says so; secrets are only ever
// reported as set or not
const isSecret = (field: string) => /token|key|password/i.test(field);

function accountsOut(s: Settings) {
  const all: Record<string, Record<string, unknown>> = { lastfm: s.lastfm, ...s.integrations };
  return Object.entries(all).map(([service, fields]) => ({
    service,
    set_up: Object.entries(fields).some(([k, v]) => !isSecret(k) && (Array.isArray(v) ? v.length > 0 : Boolean(v))),
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, isSecret(k) ? (v ? "set" : "not set") : v])
    ),
    widgets: service === "lastfm" ? ["nowplaying"] : WIDGETS.filter((w) => w === service || w.startsWith(`${service}_`)),
  }));
}

function alarmsOut(s: Settings, ctx: McpContext) {
  const names = new Map(s.devices.map((d) => [d.id, d.name]));
  return s.alarms
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => alarmVisible(a.devices, ctx))
    .map(({ a, i }) => ({
      alarm: i + 1,
      time: a.time,
      label: a.label,
      repeats: a.days.length ? a.days : "every day",
      enabled: a.enabled,
      screens: a.devices.length ? a.devices.map((id) => names.get(id) ?? id) : "every screen",
    }));
}

// a screen-limited token sees alarms that ring on its screens, and changes
// only the ones that ring on nothing else
const alarmVisible = (devices: string[], ctx: McpContext) =>
  !ctx.screens.length || !devices.length || devices.some((id) => ctx.screens.includes(id));
const alarmEditable = (devices: string[], ctx: McpContext) =>
  !ctx.screens.length || (devices.length > 0 && devices.every((id) => ctx.screens.includes(id)));

// ── writing it ─────────────────────────────────────────────────────

function write(ctx: McpContext, change: (draft: Settings) => void): Settings {
  return mutateUserSettings(ctx.userId, (current) => {
    const draft = structuredClone(current);
    change(draft);
    return draft;
  });
}

/** Change one screen; answers with the screen as it is afterwards. */
function writeScreen(ctx: McpContext, ref: unknown, change: (d: Device, s: Settings) => void) {
  let id = "";
  const next = write(ctx, (s) => {
    const d = findScreen(s, ref, ctx);
    id = d.id;
    change(d, s);
    d.layout.rows = d.layout.pages[0] ?? d.layout.rows;
  });
  return screenOut(next.devices.find((d) => d.id === id)!, next);
}

/** Every page target through `map` (1-based page numbers in, out; 0 = gone). */
function remapTargets(layout: DeviceLayout, map: (n: number) => number) {
  const shift = (to: PageTarget): PageTarget => {
    const n = Number(to);
    if (!Number.isInteger(n)) return to;
    const m = map(n);
    return m === 0 ? "standby" : (`${m}` as PageTarget);
  };
  layout.idle.to = shift(layout.idle.to);
  layout.schedule = layout.schedule.map((j) => ({ ...j, to: shift(j.to) }));
}

function namesFull(layout: DeviceLayout) {
  return layout.pages.map((_, i) => layout.names[i] ?? "");
}

function programsFull(layout: DeviceLayout) {
  return layout.pages.map((_, i) => layout.programs?.[i] ?? "");
}

/** A page's program: a stern slug, "unified:rec…", or "" for none. */
function program(v: unknown): string {
  const k = String(v ?? "").trim();
  if (k === "" || /^(unified:rec[A-Za-z0-9]{14}|[a-z0-9][a-z0-9_-]{0,63})$/.test(k)) return k;
  return fail(`"${k}" isn't a program: use its stern slug (like "phantom"), "unified:rec…", or "" for none`);
}

const programProp = {
  type: "string",
  maxLength: 80,
  description:
    'The Hack Club program this page shows, for the stern_ program widgets: its Stern slug, or "unified:<airtable id>" for one only Unified knows. "" for none.',
};

function jumpIndex(d: Device, v: unknown): number {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= d.layout.schedule.length) return n - 1;
  return fail(`"${d.name}" has ${d.layout.schedule.length} set time(s); get_screen numbers them`);
}

function time(v: unknown): string {
  const t = String(v ?? "");
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(t) ? t.padStart(5, "0") : fail(`"${v}" isn't a 24-hour time like "16:15"`);
}

function days(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return fail("days is a list like [\"mon\", \"wed\"]");
  return v.map((d) => (DAYS.includes(lower(d).slice(0, 3)) ? lower(d).slice(0, 3) : fail(`"${d}" isn't a day`)));
}

function date(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : fail(`"${v}" isn't a date like "2026-10-22"`);
}

function minutes(v: unknown, max: number): number {
  const n = Number(v ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : fail(`minutes runs 0 to ${max}`);
}

async function geocode(place: string) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
    { signal: AbortSignal.timeout(8000) }
  ).catch(() => fail("the place search (open-meteo) can't be reached right now"));
  const r = (await res.json())?.results?.[0];
  if (!r) return fail(`couldn't find a place called "${place}"`);
  return {
    name: String(r.name),
    region: [r.admin1, r.country].filter(Boolean).join(" · "),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  };
}

function findCalendar(s: Settings, ref: unknown) {
  const i = s.calendars.findIndex((c) => c.id === ref || lower(c.name) === lower(ref));
  return i >= 0 ? i : fail(`no calendar "${ref}"; list_calendars has them`);
}

function alarmIndex(s: Settings, v: unknown, ctx: McpContext): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > s.alarms.length) return fail(`there are ${s.alarms.length} alarm(s); list_alarms numbers them`);
  if (!alarmEditable(s.alarms[n - 1].devices, ctx)) return fail("that alarm rings on screens this token can't reach");
  return n - 1;
}

function screenIds(s: Settings, v: unknown, ctx: McpContext): string[] {
  if (v === undefined || v === null) return ctx.screens.length ? [...ctx.screens] : [];
  if (!Array.isArray(v)) return fail("screens is a list of screen names");
  return v.map((ref) => findScreen(s, ref, ctx).id);
}

function username(userId: number): string {
  const row = getDb().prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string } | undefined;
  return row?.username ?? "";
}

// ── the tools ──────────────────────────────────────────────────────

const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
const EDIT = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ADD = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const REMOVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };

export const TOOLS: ToolDef[] = [
  // read
  {
    name: "get_desk",
    title: "Get the desk",
    description:
      "Start here. The account, its screens (each with its pages in order), units, world clocks, how many alarms and calendars there are, which accounts are set up, and what this token may do.",
    scope: "read",
    input: object({}),
    annotations: READ,
    run: (_, ctx) => {
      const s = getUserSettings(ctx.userId);
      return {
        account: username(ctx.userId),
        screens: screensFor(s, ctx).map((d) => ({ id: d.id, name: d.name, pages: screenOut(d, s).order })),
        units: s.units,
        world_clocks: s.worldclock,
        alarms: alarmsOut(s, ctx).length,
        calendars: s.calendars.length,
        accounts_set_up: accountsOut(s).filter((a) => a.set_up).map((a) => a.service),
        token: { scopes: [...ctx.scopes], screens: ctx.screens.length ? screensFor(s, ctx).map((d) => d.name) : "every screen" },
      };
    },
  },
  {
    name: "get_screen",
    title: "Get a screen",
    description:
      "One screen in full: its pages and their rows of cards, its set times, where it goes when left alone, its location, standby options, night mode and away status.",
    scope: "read",
    input: object({ screen: screenProp }),
    annotations: READ,
    run: (a, ctx) => {
      const s = getUserSettings(ctx.userId);
      return screenOut(findScreen(s, a.screen, ctx), s);
    },
  },
  {
    name: "list_widgets",
    title: "List widgets",
    description:
      "Every widget a card can show, by category, with what it shows. Widgets in the \"your accounts\" category need that account set up (list_accounts).",
    scope: "read",
    input: object({}),
    annotations: READ,
    run: () =>
      WIDGET_CATEGORIES.map((c) => ({
        category: c.label,
        widgets: WIDGETS.filter((w) => WIDGET_INFO[w].category === c.key).map((w) => ({
          widget: w,
          label: WIDGET_INFO[w].label,
          shows: WIDGET_INFO[w].blurb,
        })),
      })),
  },
  {
    name: "list_accounts",
    title: "List accounts",
    description:
      "The services widgets sign in to (GitHub, Plex, Home Assistant, Phantom…), what's filled in, and which widgets use each. Keys, tokens and passwords only ever show as \"set\" or \"not set\".",
    scope: "read",
    input: object({}),
    annotations: READ,
    run: (_, ctx) => accountsOut(getUserSettings(ctx.userId)),
  },
  {
    name: "list_alarms",
    title: "List alarms",
    description: "The alarms, numbered, with their times, days and the screens they ring on.",
    scope: "read",
    input: object({}),
    annotations: READ,
    run: (_, ctx) => alarmsOut(getUserSettings(ctx.userId), ctx),
  },
  {
    name: "list_calendars",
    title: "List calendars",
    description: "The calendar feeds the agenda and calendar widgets read.",
    scope: "read",
    input: object({}),
    annotations: READ,
    run: (_, ctx) => {
      const s = getUserSettings(ctx.userId);
      return { calendars: s.calendars, show_epic_games_in_agenda: s.showEpicInAgenda };
    },
  },

  // screens: pages
  {
    name: "create_page",
    title: "Create a page",
    description:
      "Add a page to a screen, optionally named and filled with rows. It goes at the end unless position says where (1 = first after Standby). Set times pointing at pages after it follow them along.",
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        name: { type: "string", maxLength: 30, description: 'What the page is called, like "Phantom".' },
        rows: { type: "array", items: rowProp, maxItems: MAX_ROWS, description: "Its rows, top to bottom. Defaults to one row: clock and calendar." },
        position: { type: "integer", minimum: 1, description: "Where it goes among the pages. Defaults to the end." },
        program: programProp,
      },
      []
    ),
    annotations: ADD,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        const L = d.layout;
        if (L.pages.length >= MAX_WIDGET_PAGES) fail(`a screen has at most ${MAX_WIDGET_PAGES} pages`);
        const rows = Array.isArray(a.rows) && a.rows.length ? a.rows.map(rowIn) : [{ type: "split", left: "clock", right: "calendar" } as LayoutRow];
        const at = Math.min(Math.max(Number(a.position ?? L.pages.length + 1), 1), L.pages.length + 1);
        const names = namesFull(L);
        const programs = programsFull(L);
        L.pages.splice(at - 1, 0, rows);
        names.splice(at - 1, 0, String(a.name ?? "").slice(0, 30));
        programs.splice(at - 1, 0, program(a.program));
        L.names = names;
        L.programs = programs;
        remapTargets(L, (n) => (n >= at ? n + 1 : n));
      }),
  },
  {
    name: "update_page",
    title: "Update a page",
    description:
      "Rename a page, give it a Hack Club program, replace all its rows, or move it. Leave out what shouldn't change. To change a single card use set_card.",
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        page: pageProp,
        name: { type: "string", maxLength: 30, description: 'A new name; "" goes back to "Page N".' },
        rows: { type: "array", items: rowProp, minItems: 1, maxItems: MAX_ROWS, description: "Every row, top to bottom, replacing the ones there." },
        position: { type: "integer", minimum: 1, description: "Move the page here among the pages." },
        program: programProp,
      },
      ["page"]
    ),
    annotations: EDIT,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        const L = d.layout;
        const i = findPage(d, a.page);
        const names = namesFull(L);
        const programs = programsFull(L);
        if (a.name !== undefined) names[i] = String(a.name).slice(0, 30);
        if (a.program !== undefined) programs[i] = program(a.program);
        L.programs = programs;
        if (a.rows !== undefined) {
          if (!Array.isArray(a.rows) || !a.rows.length) fail("rows needs at least one row");
          L.pages[i] = (a.rows as unknown[]).map(rowIn);
        }
        L.names = names;
        if (a.position !== undefined) {
          const to = Math.min(Math.max(Number(a.position), 1), L.pages.length) - 1;
          if (to !== i) {
            const [page] = L.pages.splice(i, 1);
            L.pages.splice(to, 0, page);
            const [name] = L.names.splice(i, 1);
            L.names.splice(to, 0, name);
            const [prog] = L.programs.splice(i, 1);
            L.programs.splice(to, 0, prog);
            const from = i + 1;
            const dest = to + 1;
            remapTargets(L, (n) =>
              n === from ? dest : from < dest && n > from && n <= dest ? n - 1 : dest < from && n >= dest && n < from ? n + 1 : n
            );
          }
        }
      }),
  },
  {
    name: "delete_page",
    title: "Delete a page",
    description:
      "Remove a page and its rows. Set times and the idle return that pointed at it go to Standby instead. A screen keeps at least one page.",
    scope: "screens",
    input: object({ screen: screenProp, page: pageProp }, ["page"]),
    annotations: REMOVE,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        if (d.layout.pages.length <= 1) fail("that's the screen's only page");
        const i = findPage(d, a.page);
        const kept = dropPage({ ...d.layout, names: namesFull(d.layout), programs: programsFull(d.layout) }, i + 1);
        d.layout.pages.splice(i, 1);
        Object.assign(d.layout, kept);
      }),
  },

  // screens: rows and cards
  {
    name: "set_card",
    title: "Set a card",
    description:
      'Put a widget in one spot on a page: the left or right square of a row, or "wide" for the whole row. Setting a side of a wide row splits it (the old widget keeps the other side); setting "wide" on a split row joins it.',
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        page: pageProp,
        row: { type: "integer", minimum: 1, description: "Which row, 1 at the top." },
        slot: { type: "string", enum: ["left", "right", "wide"], description: "Which spot in the row." },
        widget: widgetProp,
      },
      ["page", "row", "slot", "widget"]
    ),
    annotations: EDIT,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        const rows = d.layout.pages[findPage(d, a.page)];
        const r = Number(a.row) - 1;
        if (!rows[r]) fail(`that page has rows 1 to ${rows.length}`);
        const w = widget(a.widget);
        const cur = rows[r];
        if (a.slot === "wide") rows[r] = { type: "dual", widget: w };
        else if (a.slot === "left" || a.slot === "right") {
          const other = cur.type === "dual" ? cur.widget : a.slot === "left" ? cur.right : cur.left;
          rows[r] = a.slot === "left" ? { type: "split", left: w, right: other } : { type: "split", left: other, right: w };
        } else fail('slot is "left", "right" or "wide"');
      }),
  },
  {
    name: "add_row",
    title: "Add a row",
    description: "Add a row of cards to a page, at the bottom unless position says where.",
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        page: pageProp,
        row: rowProp,
        position: { type: "integer", minimum: 1, description: "Where it goes, 1 at the top. Defaults to the bottom." },
      },
      ["page", "row"]
    ),
    annotations: ADD,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        const rows = d.layout.pages[findPage(d, a.page)];
        if (rows.length >= MAX_ROWS) fail(`a page has at most ${MAX_ROWS} rows`);
        const at = Math.min(Math.max(Number(a.position ?? rows.length + 1), 1), rows.length + 1);
        rows.splice(at - 1, 0, rowIn(a.row));
      }),
  },
  {
    name: "remove_row",
    title: "Remove a row",
    description: "Take a row of cards off a page. A page keeps at least one row.",
    scope: "screens",
    input: object(
      { screen: screenProp, page: pageProp, row: { type: "integer", minimum: 1, description: "Which row, 1 at the top." } },
      ["page", "row"]
    ),
    annotations: REMOVE,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        const rows = d.layout.pages[findPage(d, a.page)];
        const r = Number(a.row) - 1;
        if (!rows[r]) fail(`that page has rows 1 to ${rows.length}`);
        if (rows.length <= 1) fail("that's the page's only row");
        rows.splice(r, 1);
      }),
  },

  // screens: set times and idle
  {
    name: "add_set_time",
    title: "Add a set time",
    description:
      'Make a screen turn to a page at a time: every day, on some days, or just once on a date. With stay_minutes it goes back to what it was showing afterwards (unless someone touched it); without, it stays until touched. E.g. "16:15 on tue → Phantom for 60 minutes".',
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        at: timeProp,
        show: targetProp,
        days: daysProp,
        date: dateProp,
        stay_minutes: { type: "integer", minimum: 0, maximum: 720, description: "How long it stays; 0 or left out = until touched." },
      },
      ["at", "show"]
    ),
    annotations: ADD,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        if (d.layout.schedule.length >= 20) fail("a screen has at most 20 set times");
        const once = date(a.date);
        d.layout.schedule.push({
          at: time(a.at),
          to: findTarget(d, a.show),
          date: once,
          days: once ? [] : days(a.days),
          minutes: minutes(a.stay_minutes, 720),
        });
      }),
  },
  {
    name: "update_set_time",
    title: "Update a set time",
    description: "Change a set time (numbered as get_screen lists them). Leave out what shouldn't change.",
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        set_time: { type: "integer", minimum: 1, description: "Which set time." },
        at: timeProp,
        show: targetProp,
        days: daysProp,
        date: dateProp,
        stay_minutes: { type: "integer", minimum: 0, maximum: 720, description: "How long it stays; 0 = until touched." },
      },
      ["set_time"]
    ),
    annotations: EDIT,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        const j = d.layout.schedule[jumpIndex(d, a.set_time)];
        if (a.at !== undefined) j.at = time(a.at);
        if (a.show !== undefined) j.to = findTarget(d, a.show);
        if (a.date !== undefined) j.date = date(a.date);
        if (a.days !== undefined) j.days = days(a.days);
        if (j.date) j.days = [];
        if (a.stay_minutes !== undefined) j.minutes = minutes(a.stay_minutes, 720);
      }),
  },
  {
    name: "remove_set_time",
    title: "Remove a set time",
    description: "Delete a set time (numbered as get_screen lists them).",
    scope: "screens",
    input: object({ screen: screenProp, set_time: { type: "integer", minimum: 1, description: "Which set time." } }, ["set_time"]),
    annotations: REMOVE,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        d.layout.schedule.splice(jumpIndex(d, a.set_time), 1);
      }),
  },
  {
    name: "set_idle_return",
    title: "Set the idle return",
    description:
      "After someone turns a screen's page and leaves it, go back to a page once it's been untouched this long. 0 minutes turns it off.",
    scope: "screens",
    input: object(
      {
        screen: screenProp,
        after_minutes: { type: "integer", minimum: 0, maximum: 1440, description: "Minutes untouched; 0 = off." },
        to: { ...targetProp, description: '"standby" (the default), "pad", or a page by number or name.' },
      },
      ["after_minutes"]
    ),
    annotations: EDIT,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        d.layout.idle = {
          minutes: minutes(a.after_minutes, 1440),
          to: a.to === undefined ? d.layout.idle.to : findTarget(d, a.to),
        };
      }),
  },

  // screens: the screen itself
  {
    name: "set_location",
    title: "Set a screen's location",
    description:
      "Where a screen is, for its weather, sunrise and night mode. Give a place to search for (\"Philadelphia\"), or exact latitude and longitude with a name.",
    scope: "screens",
    input: object({
      screen: screenProp,
      place: { type: "string", description: "A city or place to look up." },
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
      name: { type: "string", description: "What to call it, with latitude and longitude." },
    }),
    annotations: { ...EDIT, openWorldHint: true },
    run: async (a, ctx) => {
      const loc =
        typeof a.place === "string" && a.place.trim()
          ? await geocode(a.place.trim())
          : typeof a.latitude === "number" && typeof a.longitude === "number"
            ? { name: String(a.name ?? "Here"), region: "", latitude: a.latitude, longitude: a.longitude }
            : fail("give a place, or latitude and longitude");
      return writeScreen(ctx, a.screen, (d) => {
        d.location = loc;
      });
    },
  },
  {
    name: "update_screen",
    title: "Update a screen",
    description: "Rename a screen, or change what Standby shows and whether it turns red at night.",
    scope: "screens",
    input: object({
      screen: screenProp,
      name: { type: "string", maxLength: 40, description: "A new name for the screen." },
      show_temperature: { type: "boolean", description: "Standby shows the temperature." },
      show_next_alarm: { type: "boolean", description: "Standby shows the next alarm." },
      night_mode: { type: "boolean", description: "Turn red between sunset and sunrise." },
    }),
    annotations: EDIT,
    run: (a, ctx) =>
      writeScreen(ctx, a.screen, (d) => {
        if (typeof a.name === "string" && a.name.trim()) d.name = a.name.trim().slice(0, 40);
        if (typeof a.show_temperature === "boolean") d.standby.showTemp = a.show_temperature;
        if (typeof a.show_next_alarm === "boolean") d.standby.showAlarm = a.show_next_alarm;
        if (typeof a.night_mode === "boolean") d.night.enabled = a.night_mode;
      }),
  },
  {
    name: "set_away",
    title: "Set away",
    description:
      "Show the away screen on a screen until a time, with a note of where you are; or clear it. Also sets the vibe the vibe widget shows.",
    scope: "screens",
    input: object({
      screen: screenProp,
      until: { type: ["string", "null"], description: "When you're back, as an ISO time (\"2026-10-22T17:30:00-04:00\"). null clears away." },
      for_minutes: { type: "integer", minimum: 1, maximum: 10080, description: "Or: away for this many minutes from now." },
      note: { type: "string", maxLength: 80, description: "Where you are, shown on the away screen." },
      vibe: { type: "string", enum: [...VIBES], description: "How you're feeling." },
    }),
    annotations: EDIT,
    run: (a, ctx) => {
      const s = getUserSettings(ctx.userId);
      const d = findScreen(s, a.screen, ctx);
      const patch: Partial<Device["presence"]> = {};
      if (a.until === null) patch.awayUntil = null;
      else if (typeof a.until === "string") {
        const t = new Date(a.until);
        if (Number.isNaN(t.getTime())) fail(`"${a.until}" isn't a time`);
        patch.awayUntil = t.toISOString();
      } else if (a.for_minutes !== undefined) patch.awayUntil = new Date(Date.now() + minutes(a.for_minutes, 10080) * 60_000).toISOString();
      if (typeof a.note === "string") patch.awayLocation = a.note.slice(0, 80);
      if (a.vibe !== undefined) patch.vibe = (VIBES as readonly string[]).includes(String(a.vibe)) ? (a.vibe as never) : fail("that's not a vibe");
      const next = setPresence(ctx.userId, [d.id], patch);
      return screenOut(next.devices.find((x) => x.id === d.id)!, next);
    },
  },
  {
    name: "create_screen",
    title: "Create a screen",
    description:
      "Add a screen (a display the desk runs on) with a copy of another screen's pages and location. Needs a token that can reach every screen.",
    scope: "screens",
    input: object(
      {
        name: { type: "string", maxLength: 40, description: "What the screen is called." },
        copy_from: { ...screenProp, description: "The screen to copy pages and location from. Defaults to the first." },
      },
      ["name"]
    ),
    annotations: ADD,
    run: (a, ctx) => {
      if (ctx.screens.length) fail("a token limited to some screens can't make new ones");
      const name = String(a.name ?? "").trim().slice(0, 40) || fail("give the screen a name");
      let id = "";
      const next = write(ctx, (s) => {
        if (s.devices.length >= 12) fail("an account has at most 12 screens");
        const base = a.copy_from === undefined ? s.devices[0] : findScreen(s, a.copy_from, ctx);
        id = crypto.randomUUID();
        s.devices.push({
          id,
          name,
          location: { ...base.location },
          layout: copyLayout(base.layout),
          standby: { ...base.standby },
          night: { enabled: base.night.enabled, pausedAt: null },
          presence: { awayUntil: null, awayLocation: "", vibe: "joyful" },
        });
      });
      return screenOut(next.devices.find((d) => d.id === id)!, next);
    },
  },

  // alarms
  {
    name: "add_alarm",
    title: "Add an alarm",
    description: "An alarm that rings full screen with a chime. Rings on every screen unless screens says which.",
    scope: "alarms",
    input: object(
      {
        time: timeProp,
        label: { type: "string", maxLength: 40 },
        days: daysProp,
        screens: { type: "array", items: { type: "string" }, description: "Screen names it rings on; left out = every screen (or this token's screens)." },
        enabled: { type: "boolean", description: "Defaults to on." },
      },
      ["time"]
    ),
    annotations: ADD,
    run: (a, ctx) => {
      const next = write(ctx, (s) => {
        if (s.alarms.length >= 20) fail("an account has at most 20 alarms");
        s.alarms.push({
          time: time(a.time),
          label: String(a.label ?? "alarm").slice(0, 40) || "alarm",
          days: days(a.days),
          enabled: a.enabled !== false,
          devices: screenIds(s, a.screens, ctx),
        });
      });
      return alarmsOut(next, ctx);
    },
  },
  {
    name: "update_alarm",
    title: "Update an alarm",
    description: "Change an alarm (numbered as list_alarms lists them): its time, label, days, screens, or turn it on or off.",
    scope: "alarms",
    input: object(
      {
        alarm: { type: "integer", minimum: 1, description: "Which alarm." },
        time: timeProp,
        label: { type: "string", maxLength: 40 },
        days: daysProp,
        screens: { type: "array", items: { type: "string" }, description: "Screen names it rings on; [] = every screen." },
        enabled: { type: "boolean" },
      },
      ["alarm"]
    ),
    annotations: EDIT,
    run: (a, ctx) => {
      const next = write(ctx, (s) => {
        const al = s.alarms[alarmIndex(s, a.alarm, ctx)];
        if (a.time !== undefined) al.time = time(a.time);
        if (typeof a.label === "string") al.label = a.label.slice(0, 40) || "alarm";
        if (a.days !== undefined) al.days = days(a.days);
        if (typeof a.enabled === "boolean") al.enabled = a.enabled;
        if (a.screens !== undefined) {
          const ids = screenIds(s, a.screens, ctx);
          if (ctx.screens.length && !ids.length) fail("this token can only point alarms at its own screens");
          al.devices = ids;
        }
      });
      return alarmsOut(next, ctx);
    },
  },
  {
    name: "remove_alarm",
    title: "Remove an alarm",
    description: "Delete an alarm (numbered as list_alarms lists them).",
    scope: "alarms",
    input: object({ alarm: { type: "integer", minimum: 1, description: "Which alarm." } }, ["alarm"]),
    annotations: REMOVE,
    run: (a, ctx) => {
      const next = write(ctx, (s) => {
        s.alarms.splice(alarmIndex(s, a.alarm, ctx), 1);
      });
      return alarmsOut(next, ctx);
    },
  },

  // calendars
  {
    name: "add_calendar",
    title: "Add a calendar",
    description: "Add an iCal feed (an .ics or webcal:// link) for the agenda and calendar widgets.",
    scope: "calendars",
    input: object(
      {
        name: { type: "string", maxLength: 60 },
        url: { type: "string", description: "The feed's address; webcal:// works." },
      },
      ["url"]
    ),
    annotations: ADD,
    run: (a, ctx) => {
      const url = String(a.url ?? "").trim() || fail("give the feed's url");
      let count = 0;
      const next = write(ctx, (s) => {
        if (s.calendars.length >= 20) fail("an account has at most 20 calendars");
        s.calendars.push({ id: crypto.randomUUID(), name: String(a.name ?? "calendar").slice(0, 60), url, enabled: true });
        count = s.calendars.length;
      });
      // the settings sanitiser drops a url it can't use
      if (next.calendars.length < count) fail("that url wasn't accepted; it needs to be http(s) or webcal://");
      return next.calendars;
    },
  },
  {
    name: "update_calendar",
    title: "Update a calendar",
    description: "Rename a calendar feed, change its url, or switch it on or off. Also turns Epic's free games in the agenda on or off.",
    scope: "calendars",
    input: object({
      calendar: { type: "string", description: "The calendar's name or id." },
      name: { type: "string", maxLength: 60 },
      url: { type: "string" },
      enabled: { type: "boolean" },
      show_epic_games_in_agenda: { type: "boolean" },
    }),
    annotations: EDIT,
    run: (a, ctx) => {
      const next = write(ctx, (s) => {
        if (typeof a.show_epic_games_in_agenda === "boolean") s.showEpicInAgenda = a.show_epic_games_in_agenda;
        if (a.calendar === undefined) return;
        const c = s.calendars[findCalendar(s, a.calendar)];
        if (typeof a.name === "string") c.name = a.name.slice(0, 60);
        if (typeof a.url === "string") c.url = a.url.trim();
        if (typeof a.enabled === "boolean") c.enabled = a.enabled;
      });
      return { calendars: next.calendars, show_epic_games_in_agenda: next.showEpicInAgenda };
    },
  },
  {
    name: "remove_calendar",
    title: "Remove a calendar",
    description: "Delete a calendar feed.",
    scope: "calendars",
    input: object({ calendar: { type: "string", description: "The calendar's name or id." } }, ["calendar"]),
    annotations: REMOVE,
    run: (a, ctx) => {
      const next = write(ctx, (s) => {
        s.calendars.splice(findCalendar(s, a.calendar), 1);
      });
      return next.calendars;
    },
  },

  // time
  {
    name: "set_world_clocks",
    title: "Set world clocks",
    description: "Replace the world clock widget's cities: up to 6, each a label and an IANA time zone.",
    scope: "time",
    input: object(
      {
        clocks: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              label: { type: "string", maxLength: 32, description: 'What it\'s called, like "tokyo".' },
              tz: { type: "string", description: 'An IANA zone, like "Asia/Tokyo".' },
            },
            required: ["tz"],
            additionalProperties: false,
          },
        },
      },
      ["clocks"]
    ),
    annotations: EDIT,
    run: (a, ctx) => {
      const clocks = Array.isArray(a.clocks) ? (a.clocks as Args[]) : fail("clocks is a list");
      const zones = clocks.slice(0, 6).map((c) => {
        const tz = String(c.tz ?? "");
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
        } catch {
          fail(`"${tz}" isn't a time zone; use names like "Europe/London"`);
        }
        return { label: String(c.label ?? tz.split("/").pop() ?? tz).slice(0, 32), tz };
      });
      return write(ctx, (s) => {
        s.worldclock = zones;
      }).worldclock;
    },
  },
  {
    name: "set_units",
    title: "Set units",
    description: "Fahrenheit or celsius, for every temperature on every screen.",
    scope: "time",
    input: object({ units: { type: "string", enum: ["fahrenheit", "celsius"] } }, ["units"]),
    annotations: EDIT,
    run: (a, ctx) => {
      const units = a.units === "celsius" ? "celsius" : a.units === "fahrenheit" ? "fahrenheit" : fail('units is "fahrenheit" or "celsius"');
      return { units: write(ctx, (s) => void (s.units = units)).units };
    },
  },

  // accounts
  {
    name: "set_account",
    title: "Set an account",
    description:
      'Fill in a service widgets sign in to, e.g. {service: "github", fields: {username: "…", token: "…"}}. Only the fields given change; "" clears one. list_accounts shows each service\'s fields. Keys, tokens and passwords can be written but never read back.',
    scope: "accounts",
    input: object(
      {
        service: { type: "string", description: "A service from list_accounts, like \"github\" or \"phantom\"." },
        fields: { type: "object", description: "Field names to new values.", additionalProperties: { type: ["string", "array"] } },
      },
      ["service", "fields"]
    ),
    annotations: EDIT,
    run: (a, ctx) => {
      const service = String(a.service ?? "");
      const fields = (a.fields && typeof a.fields === "object" ? a.fields : fail("fields is an object")) as Args;
      const next = write(ctx, (s) => {
        const target: Record<string, unknown> | undefined =
          service === "lastfm" ? s.lastfm : (s.integrations as unknown as Record<string, Record<string, unknown>>)[service];
        if (!target) fail(`"${service}" isn't a service; list_accounts has them`);
        for (const [k, v] of Object.entries(fields)) {
          if (!(k in target!)) fail(`${service} has no "${k}"; it has ${Object.keys(target!).join(", ")}`);
          if (Array.isArray(target![k])) target![k] = Array.isArray(v) ? v.map(String) : String(v).split(",").map((x) => x.trim()).filter(Boolean);
          else target![k] = String(v ?? "");
        }
      });
      return accountsOut(next).find((x) => x.service === service);
    },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** What a token can call: read tools with "read", the rest by their scope. */
export const allowed = (t: ToolDef, ctx: McpContext) => ctx.scopes.has(t.scope);

/** Run a tool for a caller: the result, or a ToolError for anything the
 *  caller did wrong (unknown tool, missing scope, bad arguments). */
export async function callTool(name: string, args: unknown, ctx: McpContext): Promise<unknown> {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) return fail(`there's no tool called "${name}"`);
  if (!allowed(tool, ctx)) throw new ScopeError(`this token doesn't have the "${tool.scope}" scope ${name} needs`);
  return tool.run(args && typeof args === "object" && !Array.isArray(args) ? (args as Args) : {}, ctx);
}

/** What the server tells a client about the desk when it connects. */
export const INSTRUCTIONS = `archer's desk is an ambient dashboard that runs on screens (an Echo Show, a tablet, a spare monitor).
Each screen swipes sideways through Standby (a big clock), then its pages, then the Pad when a Mac pad is set up.
A page is rows of cards: two squares side by side, or one wide card. Swiping up and down moves through the rows.
Screens can turn to a page on their own at set times (daily, some days, or once) and go back to a page when left alone.
Alarms, calendars, world clocks, units and accounts are shared by every screen.
Start with get_desk, then get_screen for the one you're changing; list_widgets has every card you can place.
Pages and set times are numbered from 1. Changes show up on the screens within a few seconds.`;
