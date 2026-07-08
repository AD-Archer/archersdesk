import { getDb } from "./db";
import {
  MAX_ROWS,
  THEMES,
  WIDGET_PAGE_COUNT,
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
  layout: {
    rows: [{ type: "split", left: "clock", right: "nowplaying" }],
    pages: [
      [{ type: "split", left: "clock", right: "nowplaying" }],
      [
        { type: "split", left: "weather", right: "alarms" },
        { type: "split", left: "github", right: "chess" },
      ],
    ],
    presets: [[], []],
  },
  standby: { showTemp: true, showAlarm: true },
  lastfm: { username: "", apiKey: "" },
  integrations: {
    github: { username: "", token: "" },
    chess: { username: "" },
    stocks: { symbols: ["AAPL", "SPY"] },
    anilist: { username: "" },
    wakatime: { apiKey: "", apiUrl: "" },
    septa: { station: "" },
    jellyfin: { url: "", apiKey: "", username: "", password: "" },
    plex: { url: "", token: "" },
    adguard: { url: "", username: "", password: "" },
    pihole: { url: "", password: "" },
    homeassistant: { url: "", token: "", entities: "" },
    seerr: { url: "", apiKey: "" },
    qbittorrent: { url: "", apiKey: "", username: "", password: "" },
    transmission: { url: "", username: "", password: "" },
  },
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

function trimmed(v: unknown, fallback: string, max = 120): string {
  return str(v, fallback, max).trim();
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

function sanitizeRowsValue(v: unknown): LayoutRow[] {
  const rows: LayoutRow[] = [];
  if (Array.isArray(v)) {
    for (const r of v.slice(0, MAX_ROWS)) {
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
  }
  return rows;
}

function sanitizeRows(layout: Record<string, unknown>): LayoutRow[] {
  let rows = sanitizeRowsValue(layout.rows);
  if (!rows.length && typeof layout.mode === "string") {
    // legacy single-row shape ({ mode, left, right, dual })
    rows.push(
      layout.mode === "dual"
        ? { type: "dual", widget: widget(layout.dual, "clock") }
        : { type: "split", left: widget(layout.left, "clock"), right: widget(layout.right, "nowplaying") }
    );
  }
  return rows.length ? rows : DEFAULT_SETTINGS.layout.rows;
}

function sanitizePages(layout: Record<string, unknown>): LayoutRow[][] {
  const out: LayoutRow[][] = [];
  if (Array.isArray(layout.pages)) {
    for (const p of layout.pages.slice(0, WIDGET_PAGE_COUNT)) {
      const rows = sanitizeRowsValue(p);
      out.push(rows.length ? rows : [{ type: "split", left: "clock", right: "calendar" }]);
    }
  }
  const legacy = sanitizeRows(layout);
  while (out.length < WIDGET_PAGE_COUNT) {
    out.push(out.length === 0 ? legacy : DEFAULT_SETTINGS.layout.pages[out.length]);
  }
  return out.slice(0, WIDGET_PAGE_COUNT);
}

function sanitizePresets(layout: Record<string, unknown>): LayoutRow[][] {
  const presets = Array.isArray(layout.presets) ? layout.presets : [];
  return Array.from({ length: 2 }, (_, i) => sanitizeRowsValue(presets[i]));
}

function sanitizeIntegrations(v: unknown): Settings["integrations"] {
  const s = isRecord(v) ? v : {};
  const github = isRecord(s.github) ? s.github : {};
  const chess = isRecord(s.chess) ? s.chess : {};
  const stocks = isRecord(s.stocks) ? s.stocks : {};
  const anilist = isRecord(s.anilist) ? s.anilist : {};
  const wakatime = isRecord(s.wakatime) ? s.wakatime : {};
  const septa = isRecord(s.septa) ? s.septa : {};
  const jellyfin = isRecord(s.jellyfin) ? s.jellyfin : {};
  const plex = isRecord(s.plex) ? s.plex : {};
  const adguard = isRecord(s.adguard) ? s.adguard : {};
  const pihole = isRecord(s.pihole) ? s.pihole : {};
  const homeassistant = isRecord(s.homeassistant) ? s.homeassistant : {};
  const seerr = isRecord(s.seerr) ? s.seerr : {};
  const qbittorrent = isRecord(s.qbittorrent) ? s.qbittorrent : {};
  const transmission = isRecord(s.transmission) ? s.transmission : {};
  const symbols = Array.isArray(stocks.symbols)
    ? stocks.symbols
        .map((x) => String(x).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "").slice(0, 12))
        .filter(Boolean)
        .slice(0, 6)
    : DEFAULT_SETTINGS.integrations.stocks.symbols;
  return {
    github: { username: trimmed(github.username, "", 60), token: trimmed(github.token, "", 120) },
    chess: { username: trimmed(chess.username, "", 60) },
    stocks: { symbols },
    anilist: { username: trimmed(anilist.username, "", 60) },
    wakatime: {
      apiKey: trimmed(wakatime.apiKey, "", 120),
      apiUrl: sanitizeUrl(str(wakatime.apiUrl, "", 200)),
    },
    septa: { station: trimmed(septa.station, "", 60) },
    jellyfin: {
      url: sanitizeUrl(str(jellyfin.url, "", 200)),
      apiKey: trimmed(jellyfin.apiKey, "", 120),
      username: trimmed(jellyfin.username, "", 80),
      password: str(jellyfin.password, "", 160),
    },
    plex: {
      url: sanitizeUrl(str(plex.url, "", 200)),
      token: trimmed(plex.token, "", 120),
    },
    adguard: {
      url: sanitizeUrl(str(adguard.url, "", 200)),
      username: trimmed(adguard.username, "", 80),
      password: str(adguard.password, "", 160),
    },
    pihole: {
      url: sanitizeUrl(str(pihole.url, "", 200)),
      password: str(pihole.password, "", 160),
    },
    homeassistant: {
      url: sanitizeUrl(str(homeassistant.url, "", 200)),
      token: trimmed(homeassistant.token, "", 2000),
      entities: trimmed(homeassistant.entities, "", 4000),
    },
    seerr: {
      url: sanitizeUrl(str(seerr.url, "", 200)),
      apiKey: trimmed(seerr.apiKey, "", 120),
    },
    qbittorrent: {
      url: sanitizeUrl(str(qbittorrent.url, "", 200)),
      apiKey: trimmed(qbittorrent.apiKey, "", 160),
      username: trimmed(qbittorrent.username, "", 80),
      password: str(qbittorrent.password, "", 160),
    },
    transmission: {
      url: sanitizeUrl(str(transmission.url, "", 200)),
      username: trimmed(transmission.username, "", 80),
      password: str(transmission.password, "", 160),
    },
  };
}

function sanitizeUrl(v: string): string {
  const trimmed = v.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\/[^\s]+$/.test(trimmed) ? trimmed : "";
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
    layout: {
      rows: sanitizeRows(layout),
      pages: sanitizePages(layout),
      presets: sanitizePresets(layout),
    },
    standby: {
      showTemp: standby.showTemp !== false,
      showAlarm: standby.showAlarm !== false,
    },
    lastfm: {
      username: str(lastfm.username, "", 64),
      apiKey: str(lastfm.apiKey, "", 64),
    },
    integrations: sanitizeIntegrations(s.integrations),
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
