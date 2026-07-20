import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { env } from "./env";
import {
  MAX_ROWS,
  THEMES,
  VIBES,
  WIDGET_PAGE_COUNT,
  WIDGETS,
  type Alarm,
  type CalendarFeed,
  type Device,
  type EmbedFeed,
  type LayoutRow,
  type Location,
  type Presence,
  type Settings,
  type ThemeName,
  type Vibe,
  type WidgetName,
  type WorldClockZone,
} from "./types";

// ── per-user settings ────────────────────────────────────────────────
// One JSON document per account, edited entirely by tapping in the UI.
// sanitize() is the only gate: whatever the client sends, what lands in
// the db (and comes back out) is a fully-shaped Settings object.

const MAX_DEVICES = 12;
const DEFAULT_THEME: ThemeName = "ember";
const SETTINGS_ENCRYPTION_PREFIX = "enc:v1:";
const SETTINGS_KEY_FILE = "settings.encryption.key";
let cachedSettingsKey: Buffer | null = null;

const DEFAULT_LOCATION: Location = {
  name: "New York",
  region: "New York · United States",
  latitude: 40.7128,
  longitude: -74.006,
};

const DEFAULT_LAYOUT: Device["layout"] = {
  rows: [{ type: "split", left: "clock", right: "nowplaying" }],
  pages: [
    [{ type: "split", left: "clock", right: "nowplaying" }],
    [
      { type: "split", left: "weather", right: "alarms" },
      { type: "split", left: "github", right: "chess" },
    ],
  ],
};

const DEFAULT_PRESENCE: Presence = { awayUntil: null, awayLocation: "", vibe: "joyful" };

export const DEFAULT_SETTINGS: Settings = {
  version: 0,
  devices: [
    {
      id: "default",
      name: "main",
      theme: DEFAULT_THEME,
      location: { ...DEFAULT_LOCATION },
      layout: { rows: [...DEFAULT_LAYOUT.rows], pages: DEFAULT_LAYOUT.pages.map((p) => [...p]) },
      standby: { showTemp: true, showAlarm: true },
      presence: { ...DEFAULT_PRESENCE },
    },
  ],
  presets: [[], []],
  units: "fahrenheit",
  lastfm: { username: "", apiKey: "" },
  integrations: {
    github: { username: "", token: "" },
    chess: { username: "" },
    stocks: { symbols: ["AAPL", "SPY"] },
    anilist: { username: "" },
    wakatime: { apiKey: "", apiUrl: "" },
    monkeytype: { apeKey: "" },
    septa: { station: "" },
    jellyfin: { url: "", apiKey: "", username: "", password: "" },
    plex: { url: "", token: "" },
    adguard: { url: "", username: "", password: "" },
    pihole: { url: "", password: "" },
    homeassistant: { url: "", token: "", entities: "" },
    seerr: { url: "", apiKey: "" },
    qbittorrent: { url: "", apiKey: "", username: "", password: "" },
    transmission: { url: "", username: "", password: "" },
    navidrome: { url: "", username: "", password: "" },
  },
  embeds: [],
  alarms: [],
  worldclock: [
    { label: "london", tz: "Europe/London" },
    { label: "tokyo", tz: "Asia/Tokyo" },
    { label: "los angeles", tz: "America/Los_Angeles" },
  ],
  calendars: [],
  showEpicInAgenda: true,
};

const DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function keyFromString(raw: string): Buffer {
  const value = raw.trim();
  if (/^[A-Fa-f0-9]{64}$/.test(value)) return Buffer.from(value, "hex");
  if (/^[A-Za-z0-9_-]{43,44}$/.test(value)) {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.length === 32) return decoded;
  }
  if (/^[A-Za-z0-9+/]{43}=?$/.test(value)) {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  }
  return crypto.createHash("sha256").update(value).digest();
}

function getSettingsKey(): Buffer {
  if (cachedSettingsKey) return cachedSettingsKey;
  if (env.settingsEncryptionKey.trim()) {
    cachedSettingsKey = keyFromString(env.settingsEncryptionKey);
    return cachedSettingsKey;
  }

  const keyPath = path.join(env.dataDir, SETTINGS_KEY_FILE);
  let raw = "";
  try {
    raw = fs.readFileSync(keyPath, "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (!raw) {
    raw = crypto.randomBytes(32).toString("base64url");
    try {
      fs.writeFileSync(keyPath, `${raw}\n`, { mode: 0o600, flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      raw = fs.readFileSync(keyPath, "utf8").trim();
    }
  }

  cachedSettingsKey = keyFromString(raw);
  return cachedSettingsKey;
}

export function isEncryptedSettingsData(data: string): boolean {
  return data.startsWith(SETTINGS_ENCRYPTION_PREFIX);
}

function encryptSettingsData(settings: Settings): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSettingsKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(settings), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SETTINGS_ENCRYPTION_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptSettingsData(data: string): string {
  const [, , ivRaw, tagRaw, ciphertextRaw] = data.split(":");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("invalid encrypted settings payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getSettingsKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseStoredSettings(data: string): unknown {
  return JSON.parse(isEncryptedSettingsData(data) ? decryptSettingsData(data) : data);
}

function widget(v: unknown, fallback: WidgetName): WidgetName {
  let name = String(v ?? "").toLowerCase();
  if (name === "lunch") name = "away_until"; // removed widget → nearest surviving equivalent
  return (WIDGETS as readonly string[]).includes(name) ? (name as WidgetName) : fallback;
}

function str(v: unknown, fallback: string, max = 120): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

function trimmed(v: unknown, fallback: string, max = 120): string {
  return str(v, fallback, max).trim();
}

function secret(v: unknown, fallback = "", max = 512): string {
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

function sanitizeAlarms(v: unknown, validDeviceIds: Set<string>): Alarm[] {
  if (!Array.isArray(v)) return [];
  const out: Alarm[] = [];
  for (const a of v.slice(0, 20)) {
    if (!isRecord(a)) continue;
    const time = String(a.time ?? "");
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) continue;
    const days = Array.isArray(a.days)
      ? a.days.map((d) => String(d).toLowerCase().slice(0, 3)).filter((d) => DAY_NAMES.includes(d))
      : [];
    const devices = Array.isArray(a.devices)
      ? Array.from(new Set(a.devices.map((d) => String(d)).filter((d) => validDeviceIds.has(d))))
      : [];
    out.push({
      time: time.padStart(5, "0"),
      label: str(a.label, "alarm", 40),
      days,
      enabled: a.enabled !== false,
      devices, // empty = all devices
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

function sanitizeCalendars(v: unknown): CalendarFeed[] {
  if (!Array.isArray(v)) return [];
  const out: CalendarFeed[] = [];
  for (const c of v.slice(0, 20)) {
    if (!isRecord(c)) continue;
    // webcal:// is the same host over https — rewrite before sanitizeUrl
    const raw = str(c.url, "", 400).trim().replace(/^webcal:\/\//i, "https://");
    const url = sanitizeUrl(raw);
    if (!url) continue;
    out.push({
      id: trimmed(c.id, "", 64) || url,
      name: trimmed(c.name, "calendar", 60),
      url,
      enabled: c.enabled !== false,
    });
  }
  return out;
}

function sanitizeEmbeds(v: unknown): EmbedFeed[] {
  if (!Array.isArray(v)) return [];
  const out: EmbedFeed[] = [];
  for (const e of v.slice(0, 12)) {
    if (!isRecord(e)) continue;
    // bare hosts ("test.com") get https:// assumed; an explicit scheme is
    // kept as-is (and non-https? schemes then fail sanitizeUrl as before)
    const raw = str(e.url, "", 500).trim();
    const url = sanitizeUrl(raw && !/^[a-z][a-z0-9+.-]*:/i.test(raw) ? `https://${raw}` : raw);
    if (!url) continue;
    out.push({
      id: trimmed(e.id, "", 64) || url,
      name: trimmed(e.name, "embed", 60),
      url,
    });
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
  return rows.length ? rows : [...DEFAULT_LAYOUT.rows];
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
    out.push(out.length === 0 ? legacy : [...DEFAULT_LAYOUT.pages[out.length]]);
  }
  return out.slice(0, WIDGET_PAGE_COUNT);
}

function sanitizePresetsValue(v: unknown): LayoutRow[][] {
  const presets = Array.isArray(v) ? v : [];
  return Array.from({ length: 2 }, (_, i) => sanitizeRowsValue(presets[i]));
}

function sanitizePresence(v: unknown): Presence {
  const p = isRecord(v) ? v : {};
  let awayUntil: string | null = null;
  if (typeof p.awayUntil === "string") {
    const d = new Date(p.awayUntil);
    if (!Number.isNaN(d.getTime())) awayUntil = d.toISOString();
  }
  const vibe = (VIBES as readonly string[]).includes(String(p.vibe)) ? (p.vibe as Vibe) : "joyful";
  return { awayUntil, awayLocation: trimmed(p.awayLocation, "", 80), vibe };
}

function sanitizeDevice(raw: unknown, fallbackId: string, fallbackName: string): Device {
  const s = isRecord(raw) ? raw : {};
  const layout = isRecord(s.layout) ? s.layout : {};
  const standby = isRecord(s.standby) ? s.standby : {};
  const loc = isRecord(s.location) ? s.location : {};
  return {
    id: trimmed(s.id, "", 64) || fallbackId,
    name: trimmed(s.name, fallbackName, 40) || fallbackName,
    theme: (THEMES as readonly string[]).includes(String(s.theme)) ? (s.theme as ThemeName) : DEFAULT_THEME,
    location: {
      name: str(loc.name, DEFAULT_LOCATION.name, 60),
      region: str(loc.region, "", 80),
      latitude: num(loc.latitude, DEFAULT_LOCATION.latitude, -90, 90),
      longitude: num(loc.longitude, DEFAULT_LOCATION.longitude, -180, 180),
    },
    layout: { rows: sanitizeRows(layout), pages: sanitizePages(layout) },
    standby: { showTemp: standby.showTemp !== false, showAlarm: standby.showAlarm !== false },
    presence: sanitizePresence(s.presence),
  };
}

function sanitizeIntegrations(v: unknown): Settings["integrations"] {
  const s = isRecord(v) ? v : {};
  const github = isRecord(s.github) ? s.github : {};
  const chess = isRecord(s.chess) ? s.chess : {};
  const stocks = isRecord(s.stocks) ? s.stocks : {};
  const anilist = isRecord(s.anilist) ? s.anilist : {};
  const wakatime = isRecord(s.wakatime) ? s.wakatime : {};
  const monkeytype = isRecord(s.monkeytype) ? s.monkeytype : {};
  const septa = isRecord(s.septa) ? s.septa : {};
  const jellyfin = isRecord(s.jellyfin) ? s.jellyfin : {};
  const plex = isRecord(s.plex) ? s.plex : {};
  const adguard = isRecord(s.adguard) ? s.adguard : {};
  const pihole = isRecord(s.pihole) ? s.pihole : {};
  const homeassistant = isRecord(s.homeassistant) ? s.homeassistant : {};
  const seerr = isRecord(s.seerr) ? s.seerr : {};
  const qbittorrent = isRecord(s.qbittorrent) ? s.qbittorrent : {};
  const transmission = isRecord(s.transmission) ? s.transmission : {};
  const navidrome = isRecord(s.navidrome) ? s.navidrome : {};
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
    monkeytype: { apeKey: secret(monkeytype.apeKey) },
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
    navidrome: {
      url: sanitizeUrl(str(navidrome.url, "", 200)),
      username: trimmed(navidrome.username, "", 80),
      password: str(navidrome.password, "", 160),
    },
  };
}

function sanitizeUrl(v: string): string {
  const trimmed = v.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\/[^\s]+$/.test(trimmed) ? trimmed : "";
}

export function sanitizeSettings(input: unknown): Settings {
  const s = isRecord(input) ? input : {};
  const lastfm = isRecord(s.lastfm) ? s.lastfm : {};

  // Devices: use the provided array, else migrate legacy top-level
  // theme/location/layout/standby into a single "default" device.
  let devices: Device[];
  if (Array.isArray(s.devices) && s.devices.length) {
    const seen = new Set<string>();
    devices = s.devices.slice(0, MAX_DEVICES).map((raw, i) => {
      const dev = sanitizeDevice(raw, `device-${i + 1}`, `device ${i + 1}`);
      while (seen.has(dev.id)) dev.id = `${dev.id}-${i + 1}`;
      seen.add(dev.id);
      return dev;
    });
  } else {
    devices = [
      sanitizeDevice(
        { id: "default", name: "main", theme: s.theme, location: s.location, layout: s.layout, standby: s.standby },
        "default",
        "main"
      ),
    ];
  }
  const validIds = new Set(devices.map((d) => d.id));

  // Presets are account-global now; legacy docs kept them under layout.presets.
  const presetsRaw = Array.isArray(s.presets)
    ? s.presets
    : isRecord(s.layout)
      ? (s.layout as Record<string, unknown>).presets
      : undefined;

  return {
    version: num(s.version, 0, 0, Number.MAX_SAFE_INTEGER),
    devices,
    presets: sanitizePresetsValue(presetsRaw),
    units: s.units === "celsius" ? "celsius" : "fahrenheit",
    lastfm: {
      username: str(lastfm.username, "", 64),
      apiKey: str(lastfm.apiKey, "", 64),
    },
    integrations: sanitizeIntegrations(s.integrations),
    embeds: sanitizeEmbeds(s.embeds),
    alarms: sanitizeAlarms(s.alarms, validIds),
    worldclock: sanitizeZones(s.worldclock),
    calendars: sanitizeCalendars(s.calendars),
    showEpicInAgenda: s.showEpicInAgenda !== false,
  };
}

function keepWhenStale(incoming: string, current: string, stale: boolean): string {
  return stale && !incoming && current ? current : incoming;
}

/** Stale browsers may still autosave an older settings document after another
 *  device has saved account secrets. Preserve saved secrets from that newer DB
 *  row unless the incoming write is based on the current version. */
export function preserveSavedSecrets(current: Settings, incoming: Settings): Settings {
  const stale = incoming.version < current.version;
  if (!stale) return incoming;
  const cur = current.integrations;
  const next = incoming.integrations;
  return {
    ...incoming,
    lastfm: {
      ...incoming.lastfm,
      apiKey: keepWhenStale(incoming.lastfm.apiKey, current.lastfm.apiKey, stale),
    },
    integrations: {
      ...next,
      github: {
        ...next.github,
        token: keepWhenStale(next.github.token, cur.github.token, stale),
      },
      wakatime: {
        ...next.wakatime,
        apiKey: keepWhenStale(next.wakatime.apiKey, cur.wakatime.apiKey, stale),
      },
      monkeytype: {
        ...next.monkeytype,
        apeKey: keepWhenStale(next.monkeytype.apeKey, cur.monkeytype.apeKey, stale),
      },
      jellyfin: {
        ...next.jellyfin,
        apiKey: keepWhenStale(next.jellyfin.apiKey, cur.jellyfin.apiKey, stale),
        password: keepWhenStale(next.jellyfin.password, cur.jellyfin.password, stale),
      },
      plex: {
        ...next.plex,
        token: keepWhenStale(next.plex.token, cur.plex.token, stale),
      },
      adguard: {
        ...next.adguard,
        password: keepWhenStale(next.adguard.password, cur.adguard.password, stale),
      },
      pihole: {
        ...next.pihole,
        password: keepWhenStale(next.pihole.password, cur.pihole.password, stale),
      },
      homeassistant: {
        ...next.homeassistant,
        token: keepWhenStale(next.homeassistant.token, cur.homeassistant.token, stale),
      },
      seerr: {
        ...next.seerr,
        apiKey: keepWhenStale(next.seerr.apiKey, cur.seerr.apiKey, stale),
      },
      qbittorrent: {
        ...next.qbittorrent,
        apiKey: keepWhenStale(next.qbittorrent.apiKey, cur.qbittorrent.apiKey, stale),
        password: keepWhenStale(next.qbittorrent.password, cur.qbittorrent.password, stale),
      },
      navidrome: {
        ...next.navidrome,
        password: keepWhenStale(next.navidrome.password, cur.navidrome.password, stale),
      },
      transmission: {
        ...next.transmission,
        password: keepWhenStale(next.transmission.password, cur.transmission.password, stale),
      },
    },
  };
}

export function getUserSettings(userId: number): Settings {
  const row = getDb().prepare("SELECT data FROM settings WHERE user_id = ?").get(userId) as
    | { data: string }
    | undefined;
  if (!row) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(parseStoredSettings(row.data));
  } catch (error) {
    if (isEncryptedSettingsData(row.data)) {
      console.error("[archersdesk] encrypted settings could not be decrypted", error);
      throw new Error("settings are encrypted but could not be decrypted; check SETTINGS_ENCRYPTION_KEY");
    }
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(userId: number, settings: Settings) {
  getDb()
    .prepare(
      `INSERT INTO settings (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(userId, encryptSettingsData(settings), Date.now());
}

/** Eagerly upgrade any legacy (pre-devices) settings rows to the current shape.
 *  Runs once on boot. sanitizeSettings already migrates on read, so this is a
 *  belt-and-suspenders pass so an upgraded instance rewrites old data proactively
 *  — no DB schema change is involved (same tables; the migration lives in JSON). */
export function migrateAllSettings() {
  const rows = getDb().prepare("SELECT user_id, data FROM settings").all() as Array<{
    user_id: number;
    data: string;
  }>;
  let migrated = 0;
  for (const row of rows) {
    let parsed: unknown;
    const encrypted = isEncryptedSettingsData(row.data);
    try {
      parsed = parseStoredSettings(row.data);
    } catch {
      continue; // corrupt plaintext row — getUserSettings falls back to defaults on read
    }
    // Rewrite plaintext rows to encrypted storage, and still migrate legacy docs.
    if (encrypted && isRecord(parsed) && Array.isArray(parsed.devices)) continue;
    saveUserSettings(row.user_id, sanitizeSettings(parsed));
    migrated++;
  }
  if (migrated) console.log(`[archersdesk] encrypted/migrated ${migrated} settings row(s)`);
}

/** Resolve the current settings doc plus the device a browser is acting as
 *  (falls back to the first device when the id is unknown/absent). */
export function getDeviceSettings(userId: number, deviceId: string | null | undefined) {
  const settings = getUserSettings(userId);
  const device = settings.devices.find((d) => d.id === deviceId) ?? settings.devices[0];
  return { settings, device };
}

/** Read-modify-write under the single settings row. The mutator receives the
 *  current (sanitized) settings and returns the next state; version is bumped
 *  and the result re-sanitized before persisting. Returns the saved settings. */
export function mutateUserSettings(
  userId: number,
  mutate: (current: Settings) => Settings
): Settings {
  const current = getUserSettings(userId);
  const next = sanitizeSettings(mutate(current));
  next.version = current.version + 1;
  saveUserSettings(userId, next);
  return next;
}

/** Merge a presence patch into the targeted devices. Does NOT bump version —
 *  presence is delivered by the presence poll itself, so it must not force a
 *  full-settings refetch on every away/vibe change. Only keys present in
 *  `patch` are applied (an absent key leaves the current value untouched). */
export function setPresence(
  userId: number,
  deviceIds: string[],
  patch: Partial<Presence>
): Settings {
  const targets = new Set(deviceIds);
  const current = getUserSettings(userId);
  const devices = current.devices.map((d) =>
    targets.has(d.id) ? { ...d, presence: sanitizePresence({ ...d.presence, ...patch }) } : d
  );
  const next: Settings = { ...current, devices };
  saveUserSettings(userId, next);
  return next;
}
