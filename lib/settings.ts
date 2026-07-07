import { getDb } from "./db";
import {
  MAX_ROWS,
  THEMES,
  WIDGETS,
  type Alarm,
  type LayoutRow,
  type Settings,
  type ThemeName,
  type WidgetName,
  type WorldClockZone,
} from "./types";

// ── per-user settings ────────────────────────────────────────────────
// One JSON document per account, edited entirely by tapping in the UI.
// sanitize() is the only gate: whatever the client sends, what lands in
// the db (and comes back out) is a fully-shaped Settings object.

export const DEFAULT_SETTINGS: Settings = {
  theme: "ember",
  location: {
    name: "New York",
    region: "New York · United States",
    latitude: 40.7128,
    longitude: -74.006,
  },
  units: "fahrenheit",
  layout: { rows: [{ type: "split", left: "clock", right: "nowplaying" }] },
  standby: { showTemp: true, showAlarm: true },
  lastfm: { username: "", apiKey: "" },
  alarms: [],
  worldclock: [
    { label: "london", tz: "Europe/London" },
    { label: "tokyo", tz: "Asia/Tokyo" },
    { label: "los angeles", tz: "America/Los_Angeles" },
  ],
};

const DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function widget(v: unknown, fallback: WidgetName): WidgetName {
  const name = String(v ?? "").toLowerCase();
  return (WIDGETS as readonly string[]).includes(name) ? (name as WidgetName) : fallback;
}

function str(v: unknown, fallback: string, max = 120): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function sanitizeAlarms(v: unknown): Alarm[] {
  if (!Array.isArray(v)) return [];
  const out: Alarm[] = [];
  for (const a of v.slice(0, 20)) {
    if (!isRecord(a)) continue;
    const time = String(a.time ?? "");
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) continue;
    const days = Array.isArray(a.days)
      ? a.days.map((d) => String(d).toLowerCase().slice(0, 3)).filter((d) => DAY_NAMES.includes(d))
      : [];
    out.push({
      time: time.padStart(5, "0"),
      label: str(a.label, "alarm", 40),
      days,
      enabled: a.enabled !== false,
    });
  }
  return out;
}

function sanitizeZones(v: unknown): WorldClockZone[] {
  if (!Array.isArray(v)) return DEFAULT_SETTINGS.worldclock;
  const out: WorldClockZone[] = [];
  for (const z of v.slice(0, 6)) {
    if (!isRecord(z)) continue;
    const tz = str(z.tz, "");
    if (!tz || !validTz(tz)) continue;
    out.push({ label: str(z.label, tz.split("/").pop() ?? tz, 32), tz });
  }
  return out;
}

function sanitizeRows(layout: Record<string, unknown>): LayoutRow[] {
  const rows: LayoutRow[] = [];
  if (Array.isArray(layout.rows)) {
    for (const r of layout.rows.slice(0, MAX_ROWS)) {
      if (!isRecord(r)) continue;
      if (r.type === "dual") {
        rows.push({ type: "dual", widget: widget(r.widget, "clock") });
      } else {
        rows.push({
          type: "split",
          left: widget(r.left, "clock"),
          right: widget(r.right, "calendar"),
        });
      }
    }
  } else if (typeof layout.mode === "string") {
    // legacy single-row shape ({ mode, left, right, dual })
    rows.push(
      layout.mode === "dual"
        ? { type: "dual", widget: widget(layout.dual, "clock") }
        : { type: "split", left: widget(layout.left, "clock"), right: widget(layout.right, "nowplaying") }
    );
  }
  return rows.length ? rows : DEFAULT_SETTINGS.layout.rows;
}

export function sanitizeSettings(input: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const s = isRecord(input) ? input : {};
  const layout = isRecord(s.layout) ? s.layout : {};
  const standby = isRecord(s.standby) ? s.standby : {};
  const lastfm = isRecord(s.lastfm) ? s.lastfm : {};
  const loc = isRecord(s.location) ? s.location : {};

  return {
    theme: (THEMES as readonly string[]).includes(String(s.theme))
      ? (s.theme as ThemeName)
      : d.theme,
    location: {
      name: str(loc.name, d.location.name, 60),
      region: str(loc.region, "", 80),
      latitude: num(loc.latitude, d.location.latitude, -90, 90),
      longitude: num(loc.longitude, d.location.longitude, -180, 180),
    },
    units: s.units === "celsius" ? "celsius" : "fahrenheit",
    layout: { rows: sanitizeRows(layout) },
    standby: {
      showTemp: standby.showTemp !== false,
      showAlarm: standby.showAlarm !== false,
    },
    lastfm: {
      username: str(lastfm.username, "", 64),
      apiKey: str(lastfm.apiKey, "", 64),
    },
    alarms: sanitizeAlarms(s.alarms),
    worldclock: sanitizeZones(s.worldclock),
  };
}

export function getUserSettings(userId: number): Settings {
  const row = getDb().prepare("SELECT data FROM settings WHERE user_id = ?").get(userId) as
    | { data: string }
    | undefined;
  if (!row) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(row.data));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(userId: number, settings: Settings) {
  getDb()
    .prepare(
      `INSERT INTO settings (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(userId, JSON.stringify(settings), Date.now());
}
