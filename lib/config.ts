import { load, YAMLException } from "js-yaml";
import { getDb } from "./db";
import { WIDGETS, type Alarm, type DeskConfig, type WidgetName } from "./types";

export type { Alarm, DeskConfig, WidgetName };
export { WIDGETS };

// ── the YAML widget config ────────────────────────────────────────────────
// Every account owns one YAML document (stored in sqlite). It drives which
// widgets appear on the main view, the standby page, and alarm schedules.

export const DEFAULT_YAML = `# ── archer's desk ─────────────────────────────────────
# widgets: clock · date · datetime · calendar ·
#          weather · nowplaying · alarms

city: New York
units: fahrenheit        # fahrenheit | celsius

layout:
  mode: split            # split = two squares · dual = one wide panel
  left: calendar
  right: nowplaying
  dual: clock            # the widget shown when mode is dual

standby:                 # the swipe-left page
  show_temp: true
  show_alarm: true

lastfm:
  username: ""           # your last.fm username (navidrome scrobbles here)
  api_key: ""            # optional — falls back to the server's LASTFM_API_KEY

alarms:
  - time: "07:30"
    label: wake up
    days: [mon, tue, wed, thu, fri]   # omit or [] = every day
    enabled: false
`;

const DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function widget(v: unknown, fallback: WidgetName, errors: string[], where: string): WidgetName {
  if (v === undefined || v === null) return fallback;
  const name = String(v).toLowerCase();
  if ((WIDGETS as readonly string[]).includes(name)) return name as WidgetName;
  errors.push(`${where}: unknown widget "${name}" — pick one of: ${WIDGETS.join(", ")}`);
  return fallback;
}

export function parseConfig(yamlText: string): { config: DeskConfig; errors: string[] } {
  const errors: string[] = [];
  let raw: unknown = {};
  try {
    raw = load(yamlText) ?? {};
  } catch (err) {
    if (err instanceof YAMLException) {
      errors.push(`yaml syntax: ${err.message.split("\n")[0]}`);
    } else {
      errors.push("yaml could not be parsed");
    }
  }
  const doc = isRecord(raw) ? raw : (errors.push("config must be a yaml mapping"), {});

  const layoutRaw = isRecord(doc.layout) ? doc.layout : {};
  const standbyRaw = isRecord(doc.standby) ? doc.standby : {};
  const lastfmRaw = isRecord(doc.lastfm) ? doc.lastfm : {};

  const mode = String(layoutRaw.mode ?? "split").toLowerCase();
  if (mode !== "split" && mode !== "dual")
    errors.push(`layout.mode: "${mode}" is not valid — use split or dual`);

  const units = String(doc.units ?? "fahrenheit").toLowerCase();
  if (units !== "fahrenheit" && units !== "celsius")
    errors.push(`units: "${units}" is not valid — use fahrenheit or celsius`);

  const alarms: Alarm[] = [];
  if (doc.alarms !== undefined && doc.alarms !== null) {
    if (!Array.isArray(doc.alarms)) {
      errors.push("alarms: must be a list");
    } else {
      doc.alarms.forEach((a, i) => {
        if (!isRecord(a)) {
          errors.push(`alarms[${i}]: must be a mapping with a time`);
          return;
        }
        const time = String(a.time ?? "");
        if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
          errors.push(`alarms[${i}].time: "${time}" — use 24h HH:MM (e.g. "07:30")`);
          return;
        }
        const days = Array.isArray(a.days) ? a.days.map((d) => String(d).toLowerCase().slice(0, 3)) : [];
        const badDay = days.find((d) => !DAY_NAMES.includes(d));
        if (badDay) errors.push(`alarms[${i}].days: "${badDay}" — use ${DAY_NAMES.join("/")}`);
        alarms.push({
          time: time.padStart(5, "0"),
          label: String(a.label ?? "alarm"),
          days: days.filter((d) => DAY_NAMES.includes(d)),
          enabled: a.enabled !== false,
        });
      });
    }
  }

  const config: DeskConfig = {
    city: String(doc.city ?? "New York"),
    units: units === "celsius" ? "celsius" : "fahrenheit",
    layout: {
      mode: mode === "dual" ? "dual" : "split",
      left: widget(layoutRaw.left, "calendar", errors, "layout.left"),
      right: widget(layoutRaw.right, "nowplaying", errors, "layout.right"),
      dual: widget(layoutRaw.dual, "clock", errors, "layout.dual"),
    },
    standby: {
      show_temp: standbyRaw.show_temp !== false,
      show_alarm: standbyRaw.show_alarm !== false,
    },
    lastfm: {
      username: String(lastfmRaw.username ?? ""),
      api_key: String(lastfmRaw.api_key ?? ""),
    },
    alarms,
  };

  return { config, errors };
}

export function getUserConfig(userId: number): { yaml: string; config: DeskConfig } {
  const row = getDb().prepare("SELECT yaml FROM configs WHERE user_id = ?").get(userId) as
    | { yaml: string }
    | undefined;
  const yaml = row?.yaml ?? DEFAULT_YAML;
  return { yaml, config: parseConfig(yaml).config };
}

export function saveUserConfig(userId: number, yaml: string) {
  getDb()
    .prepare(
      `INSERT INTO configs (user_id, yaml, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET yaml = excluded.yaml, updated_at = excluded.updated_at`
    )
    .run(userId, yaml, Date.now());
}
