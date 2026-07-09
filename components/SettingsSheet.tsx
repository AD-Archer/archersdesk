"use client";

import { useEffect, useRef, useState } from "react";
import type { Alarm, GeocodeResult, LayoutRow, Settings, ThemeName, WidgetName } from "@/lib/types";
import { MAX_ROWS, THEME_INFO, THEMES, WIDGET_CATEGORIES, WIDGET_INFO, WIDGETS, WIDGET_PAGE_COUNT } from "@/lib/types";
import { dayChips, fmt12 } from "./alarmUtil";
import { useIntegrationAction } from "./widgets/kit";

type Tab = "layout" | "theme" | "alarms" | "calendar" | "location" | "accounts";
const TABS: Tab[] = ["layout", "theme", "alarms", "calendar", "location", "accounts"];

// swatch previews for the theme cards (mirrors globals.css palettes)
const SWATCH: Record<ThemeName, { bg: string; accent: string }> = {
  ember: { bg: "#0a0908", accent: "#e8a13c" },
  moonlight: { bg: "#060a10", accent: "#8fc3f2" },
  meadow: { bg: "#070a06", accent: "#b4d16a" },
  rose: { bg: "#0d070a", accent: "#ee94ac" },
  paper: { bg: "#f2ecdf", accent: "#bc5b22" },
};

const LAYOUT_PRESETS: { name: string; blurb: string; rows: LayoutRow[] }[] = [
  {
    name: "master",
    blurb: "mixed desk essentials",
    rows: [
      { type: "split", left: "nowplaying", right: "chess" },
      { type: "split", left: "clock", right: "calendar" },
      { type: "dual", widget: "nowplaying" },
      { type: "split", left: "forecast", right: "sun" },
      { type: "dual", widget: "dnd" },
      { type: "dual", widget: "please_disturb" },
      { type: "dual", widget: "away_until" },
    ],
  },
  {
    name: "bedside",
    blurb: "clock, weather, alarms",
    rows: [
      { type: "split", left: "clock", right: "weather" },
      { type: "dual", widget: "datetime" },
      { type: "split", left: "alarms", right: "moon" },
    ],
  },
  {
    name: "workday",
    blurb: "agenda, music, status",
    rows: [
      { type: "split", left: "calendar", right: "nowplaying" },
      { type: "dual", widget: "agenda" },
      { type: "dual", widget: "please_disturb" },
      { type: "dual", widget: "away_until" },
      { type: "split", left: "timer", right: "dnd" },
      { type: "split", left: "vibe", right: "lunch" },
    ],
  },
  {
    name: "ambient",
    blurb: "sky, quotes, forecast",
    rows: [
      { type: "split", left: "sun", right: "moon" },
      { type: "dual", widget: "quote" },
      { type: "dual", widget: "forecast" },
      { type: "split", left: "analog", right: "vibe" },
    ],
  },
  {
    name: "focus",
    blurb: "status-first and quiet",
    rows: [
      { type: "dual", widget: "dnd" },
      { type: "dual", widget: "please_disturb" },
      { type: "split", left: "timer", right: "calendar" },
      { type: "dual", widget: "away_until" },
    ],
  },
  {
    name: "accounts",
    blurb: "github, chess, wakatime",
    rows: [
      { type: "split", left: "github", right: "chess" },
      { type: "split", left: "wakatime", right: "stocks" },
      { type: "split", left: "jellyfin", right: "plex" },
      { type: "split", left: "septa", right: "anilist" },
    ],
  },
  {
    name: "transit",
    blurb: "weather, septa, flights",
    rows: [
      { type: "split", left: "weather", right: "septa" },
      { type: "split", left: "citybikes", right: "flights" },
      { type: "dual", widget: "forecast" },
      { type: "split", left: "clock", right: "alarms" },
    ],
  },
  {
    name: "selfhosted",
    blurb: "adguard, seerr, torrents, home",
    rows: [
      { type: "split", left: "qbittorrent", right: "seerr" },
      { type: "split", left: "adguard", right: "homeassistant" },
      { type: "dual", widget: "agenda" },
      { type: "split", left: "pihole", right: "epicgames" },
    ],
  },
];

export default function SettingsSheet({
  open,
  settings,
  username,
  saved,
  activePage,
  onClose,
  onChange,
}: {
  open: boolean;
  settings: Settings;
  username: string;
  saved: boolean;
  activePage?: number;
  onClose: () => void;
  onChange: (next: Settings) => void;
}) {
  const [tab, setTab] = useState<Tab>("layout");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <>
      <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`sheet${open ? " open" : ""}`}>
        <div className="sheet-head">
          <div className="sheet-title">settings</div>
          <span className={`sheet-saved${saved ? " show" : ""}`}>saved ✓</span>
          <button className="sheet-close" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={`tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {open && (
          <div className="sec">
            {tab === "layout" && (
              <LayoutSection settings={settings} onChange={onChange} initialPage={activePage} />
            )}
            {tab === "theme" && <ThemeSection settings={settings} onChange={onChange} />}
            {tab === "alarms" && <AlarmsSection settings={settings} onChange={onChange} />}
            {tab === "calendar" && <CalendarSection settings={settings} onChange={onChange} />}
            {tab === "location" && <LocationSection settings={settings} onChange={onChange} />}
            {tab === "accounts" && <AccountsSection settings={settings} onChange={onChange} />}
          </div>
        )}
        <div className="sheet-foot">
          <div className="sheet-foot-info">
            <span>signed in as {username}</span>
            <small>
              Bug or Feature?{" "}
              <a href="https://github.com/AD-Archer/archersdesk" target="_blank" rel="noreferrer">
                submit an issue on github
              </a>
            </small>
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={logout}>
            sign out
          </button>
        </div>
      </div>
    </>
  );
}

type SectionProps = { settings: Settings; onChange: (next: Settings) => void };

/* ── layout ──────────────────────────────────────────────────────── */

function LayoutSection({
  settings,
  onChange,
  initialPage,
}: SectionProps & { initialPage?: number }) {
  const [picking, setPicking] = useState<{ row: number; slot: "left" | "right" | "widget" } | null>(
    null
  );
  const [pageIndex, setPageIndex] = useState(() =>
    Math.min(Math.max(initialPage ?? 0, 0), WIDGET_PAGE_COUNT - 1)
  );
  const pages = Array.from({ length: WIDGET_PAGE_COUNT }, (_, i) => settings.layout.pages?.[i] ?? settings.layout.rows);
  const rows = pages[pageIndex] ?? pages[0] ?? settings.layout.rows;

  function setRows(next: LayoutRow[]) {
    const nextPages = pages.map((p, i) => (i === pageIndex ? next : p));
    onChange({ ...settings, layout: { ...settings.layout, rows: nextPages[0], pages: nextPages } });
  }

  function applyPreset(nextRows: LayoutRow[]) {
    setRows(nextRows.map((r) => ({ ...r })));
  }

  function savePersonalPreset(i: number) {
    const presets = Array.from({ length: 2 }, (_, j) => settings.layout.presets?.[j] ?? []);
    presets[i] = rows.map((r) => ({ ...r }));
    onChange({ ...settings, layout: { ...settings.layout, presets } });
  }

  function loadPersonalPreset(i: number) {
    const preset = settings.layout.presets?.[i] ?? [];
    if (preset.length) applyPreset(preset);
  }

  function patchRow(i: number, next: LayoutRow) {
    setRows(rows.map((r, j) => (j === i ? next : r)));
  }

  function setType(i: number, type: "split" | "dual") {
    const r = rows[i];
    if (r.type === type) return;
    patchRow(
      i,
      type === "dual"
        ? { type: "dual", widget: r.type === "split" ? r.left : "clock" }
        : { type: "split", left: r.type === "dual" ? r.widget : "clock", right: "calendar" }
    );
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  }

  function pick(w: WidgetName) {
    if (!picking) return;
    const r = rows[picking.row];
    if (r.type === "dual") patchRow(picking.row, { ...r, widget: w });
    else patchRow(picking.row, { ...r, [picking.slot]: w } as LayoutRow);
    setPicking(null);
  }

  if (picking) {
    const r = rows[picking.row];
    const current = r.type === "dual" ? r.widget : r[picking.slot as "left" | "right"];
    return (
      <>
        <p className="sec-note">
          row {picking.row + 1} · pick a widget for the{" "}
          <b>{picking.slot === "widget" ? "wide panel" : `${picking.slot} square`}</b>
        </p>
        {WIDGET_CATEGORIES.map((cat) => (
          <div key={cat.key} className="wgroup">
            <div className="wgroup-title">{cat.label}</div>
            <div className="wgrid">
              {WIDGETS.filter((w) => WIDGET_INFO[w].category === cat.key).map((w) => (
                <button
                  key={w}
                  className={`wcard${current === w ? " on" : ""}`}
                  onClick={() => pick(w)}
                >
                  <b>
                    <span className="mi wcard-mi" aria-hidden>
                      {WIDGET_INFO[w].icon}
                    </span>
                    {WIDGET_INFO[w].label}
                  </b>
                  <small>{WIDGET_INFO[w].blurb}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <p className="sec-note">
        standby is the first page. widget pages 1 and 2 each have their own vertical row stack.
        swipe <b>left / right</b> between pages and <b>up / down</b> through rows.
      </p>
      <div className="page-seg">
        {pages.map((_, i) => (
          <button key={i} className={pageIndex === i ? "on" : ""} onClick={() => setPageIndex(i)}>
            page {i + 1}
          </button>
        ))}
      </div>
      <div className="preset-row">
        {LAYOUT_PRESETS.map((preset) => (
          <button key={preset.name} className="preset-card" onClick={() => applyPreset(preset.rows)}>
            <b>{preset.name}</b>
            <small>{preset.blurb}</small>
          </button>
        ))}
      </div>
      <div className="preset-row personal">
        {[0, 1].map((i) => {
          const hasPreset = Boolean(settings.layout.presets?.[i]?.length);
          return (
            <div key={i} className="preset-card preset-save">
              <b>preset {i + 1}</b>
              <small>{hasPreset ? `${settings.layout.presets![i].length} rows saved` : "empty slot"}</small>
              <div className="preset-actions">
                <button onClick={() => savePersonalPreset(i)}>save</button>
                <button onClick={() => loadPersonalPreset(i)} disabled={!hasPreset}>
                  load
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="lrow-card">
          <div className="lrow-head">
            <span className="lrow-title">row {i + 1}</span>
            <div className="seg">
              <button className={r.type === "split" ? "on" : ""} onClick={() => setType(i, "split")}>
                split
              </button>
              <button className={r.type === "dual" ? "on" : ""} onClick={() => setType(i, "dual")}>
                dual
              </button>
            </div>
            <span style={{ flex: 1 }} />
            <button className="lrow-tool" onClick={() => move(i, -1)} disabled={i === 0} aria-label="move up">
              ↑
            </button>
            <button
              className="lrow-tool"
              onClick={() => move(i, 1)}
              disabled={i === rows.length - 1}
              aria-label="move down"
            >
              ↓
            </button>
            <button
              className="lrow-tool del"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              disabled={rows.length === 1}
              aria-label="delete row"
            >
              ×
            </button>
          </div>
          <div className="slot-row">
            {r.type === "split" ? (
              <>
                <button className="slot" onClick={() => setPicking({ row: i, slot: "left" })}>
                  <small>left square</small>
                  <b>{WIDGET_INFO[r.left].label}</b>
                  <span>tap to change</span>
                </button>
                <button className="slot" onClick={() => setPicking({ row: i, slot: "right" })}>
                  <small>right square</small>
                  <b>{WIDGET_INFO[r.right].label}</b>
                  <span>tap to change</span>
                </button>
              </>
            ) : (
              <button className="slot" onClick={() => setPicking({ row: i, slot: "widget" })}>
                <small>wide panel</small>
                <b>{WIDGET_INFO[r.widget].label}</b>
                <span>tap to change</span>
              </button>
            )}
          </div>
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <button
          className="add-btn"
          onClick={() => setRows([...rows, { type: "split", left: "clock", right: "calendar" }])}
        >
          + add row
        </button>
      )}
    </>
  );
}

/* ── theme ───────────────────────────────────────────────────────── */

function ThemeSection({ settings, onChange }: SectionProps) {
  return (
    <div className="theme-grid">
      {THEMES.map((t) => (
        <button
          key={t}
          className={`tcard${settings.theme === t ? " on" : ""}`}
          onClick={() => onChange({ ...settings, theme: t })}
        >
          <span
            className="sw"
            style={{ background: SWATCH[t].bg, boxShadow: `inset 0 0 0 5px ${SWATCH[t].accent}` }}
          />
          <span>
            <b>{THEME_INFO[t].label}</b>
            <small>{THEME_INFO[t].blurb}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── alarms ──────────────────────────────────────────────────────── */

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function AlarmsSection({ settings, onChange }: SectionProps) {
  const [editing, setEditing] = useState<number | null>(null);

  function patchAlarm(i: number, patch: Partial<Alarm>) {
    const alarms = settings.alarms.map((a, j) => (j === i ? { ...a, ...patch } : a));
    onChange({ ...settings, alarms });
  }

  function addAlarm() {
    const alarms = [...settings.alarms, { time: "07:00", label: "alarm", days: [], enabled: true }];
    onChange({ ...settings, alarms });
    setEditing(alarms.length - 1);
  }

  function removeAlarm(i: number) {
    onChange({ ...settings, alarms: settings.alarms.filter((_, j) => j !== i) });
    setEditing(null);
  }

  return (
    <>
      {settings.alarms.length === 0 && (
        <p className="sec-note">no alarms yet — they ring full-screen with a chime.</p>
      )}
      {settings.alarms.map((a, i) => (
        <div key={i}>
          <div className="al-set-row">
            <button
              className="al-set-time"
              onClick={() => setEditing(editing === i ? null : i)}
              style={{ opacity: a.enabled ? 1 : 0.45 }}
            >
              {fmt12(a.time).time}
              <em> {fmt12(a.time).ampm}</em>
            </button>
            <button className="al-set-info" onClick={() => setEditing(editing === i ? null : i)}>
              <b>{a.label}</b>
              <small>{dayChips(a.days)} · tap to edit</small>
            </button>
            <label className="switch">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={(e) => patchAlarm(i, { enabled: e.target.checked })}
              />
              <span className="knob" />
            </label>
          </div>
          {editing === i && (
            <div className="al-editor">
              <div className="al-editor-row">
                <input
                  type="time"
                  value={a.time}
                  onChange={(e) => e.target.value && patchAlarm(i, { time: e.target.value })}
                />
                <div className="day-chips">
                  {DAY_ORDER.map((d) => (
                    <button
                      key={d}
                      className={`day-chip${a.days.includes(d) ? " on" : ""}`}
                      onClick={() =>
                        patchAlarm(i, {
                          days: a.days.includes(d)
                            ? a.days.filter((x) => x !== d)
                            : [...a.days, d],
                        })
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>label</span>
                <input
                  value={a.label}
                  maxLength={40}
                  onChange={(e) => patchAlarm(i, { label: e.target.value })}
                />
              </label>
              <button className="del-btn" onClick={() => removeAlarm(i)}>
                delete alarm
              </button>
            </div>
          )}
        </div>
      ))}
      <button className="add-btn" onClick={addAlarm}>
        + add alarm
      </button>
    </>
  );
}

/* ── calendars (ical feeds for the agenda widget) ────────────────── */

function CalendarSection({ settings, onChange }: SectionProps) {
  const calendars = settings.calendars ?? [];
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  function setCalendars(next: typeof calendars) {
    onChange({ ...settings, calendars: next });
  }

  function addFeed() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setCalendars([
      ...calendars,
      { id: crypto.randomUUID(), name: name.trim() || "calendar", url: trimmedUrl, enabled: true },
    ]);
    setName("");
    setUrl("");
  }

  return (
    <>
      <p className="sec-note">
        add ical/ics feed urls (google, apple, outlook &ldquo;secret address&rdquo; links; webcal:// works).
        check the ones you want in the agenda widget.
      </p>

      <div className="cal-rows">
        {calendars.map((c, i) => (
          <div key={c.id} className="cal-row">
            <label className="cal-check">
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) => setCalendars(calendars.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
              />
              <span className="cal-row-body">
                <b>{c.name}</b>
                <small>{c.url.replace(/^https?:\/\//, "")}</small>
              </span>
            </label>
            <button className="cal-del" onClick={() => setCalendars(calendars.filter((_, j) => j !== i))} aria-label="remove">
              ×
            </button>
          </div>
        ))}

        <div className="cal-row">
          <label className="cal-check">
            <input
              type="checkbox"
              checked={settings.showEpicInAgenda}
              onChange={(e) => onChange({ ...settings, showEpicInAgenda: e.target.checked })}
            />
            <span className="cal-row-body">
              <b>Epic Free Games</b>
              <small>this week&rsquo;s free games, as agenda events</small>
            </span>
          </label>
        </div>
      </div>

      <div className="acct-group">
        <div className="acct-head">
          <b>add calendar</b>
          <small>name it, paste the ical url</small>
        </div>
        <label className="field">
          <span>name</span>
          <input value={name} maxLength={60} placeholder="Work" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>ical url</span>
          <input
            value={url}
            maxLength={400}
            placeholder="https://calendar.google.com/…/basic.ics"
            onChange={(e) => setUrl(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <button className="add-btn" onClick={addFeed}>
          + add calendar
        </button>
      </div>

      <p className="sec-note">tip: tap the agenda widget itself to switch between 3 / 5 / 7 days.</p>
    </>
  );
}

/* ── location ────────────────────────────────────────────────────── */

function LocationSection({ settings, onChange }: SectionProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .catch(() => setResults([]));
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function pick(r: GeocodeResult) {
    onChange({
      ...settings,
      location: { name: r.name, region: r.region, latitude: r.latitude, longitude: r.longitude },
    });
    setQ("");
    setResults([]);
  }

  return (
    <>
      <div className="loc-current">
        {settings.location.name}
        <small>{settings.location.region}</small>
      </div>
      <label className="field">
        <span>change city</span>
        <input
          value={q}
          placeholder="start typing a city…"
          onChange={(e) => setQ(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      {results.length > 0 && (
        <div className="loc-results">
          {results.map((r, i) => (
            <button key={i} className="loc-item" onClick={() => pick(r)}>
              {r.name}
              <small>{r.region}</small>
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <span className="row-label">units</span>
        <div className="seg">
          <button
            className={settings.units === "fahrenheit" ? "on" : ""}
            onClick={() => onChange({ ...settings, units: "fahrenheit" })}
          >
            °f
          </button>
          <button
            className={settings.units === "celsius" ? "on" : ""}
            onClick={() => onChange({ ...settings, units: "celsius" })}
          >
            °c
          </button>
        </div>
      </div>
      <div className="row">
        <span className="row-label">
          temperature on standby
          <small>the chip under the big clock</small>
        </span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.standby.showTemp}
            onChange={(e) =>
              onChange({ ...settings, standby: { ...settings.standby, showTemp: e.target.checked } })
            }
          />
          <span className="knob" />
        </label>
      </div>
      <div className="row">
        <span className="row-label">next alarm on standby</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.standby.showAlarm}
            onChange={(e) =>
              onChange({ ...settings, standby: { ...settings.standby, showAlarm: e.target.checked } })
            }
          />
          <span className="knob" />
        </label>
      </div>
    </>
  );
}

/* ── accounts (the only text-entry config left: usernames + keys) ── */

function AccountField({
  label,
  value,
  onValue,
  placeholder,
  secret,
  maxLength = 120,
}: {
  label: string;
  value: string | undefined; // stale client state can predate new fields
  onValue: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        type={secret ? "password" : "text"}
        onChange={(e) => onValue(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />
    </label>
  );
}

function AccountGroup({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="acct-group">
      <div className="acct-head">
        <b>{title}</b>
        <small>{blurb}</small>
      </div>
      {children}
    </div>
  );
}

function HomeAssistantEntityPicker({
  settings,
  patch,
}: {
  settings: Settings;
  patch: (next: Partial<Settings["integrations"]>) => void;
}) {
  const ig = settings.integrations;
  const listEntities = useIntegrationAction("homeassistant");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<Array<{ entityId: string; name: string; domain: string }> | null>(
    null
  );
  const [search, setSearch] = useState("");
  const selected = new Set(
    (ig.homeassistant?.entities ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  async function openPicker() {
    setOpen(true);
    if (available || loading) return;
    setLoading(true);
    setError(null);
    const res = await listEntities("list");
    setLoading(false);
    if (!res.configured || !res.data) {
      setError(res.reason ?? "set url + token above first");
      return;
    }
    setAvailable((res.data as { entities: Array<{ entityId: string; name: string; domain: string }> }).entities);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ homeassistant: { ...ig.homeassistant, entities: Array.from(next).join(", ") } });
  }

  const q = search.trim().toLowerCase();
  const filtered = (available ?? []).filter(
    (e) => !q || e.name.toLowerCase().includes(q) || e.entityId.toLowerCase().includes(q)
  );

  return (
    <div className="ha-picker">
      <button type="button" className="ha-picker-toggle" onClick={() => (open ? setOpen(false) : openPicker())}>
        {open ? "hide entity list" : `choose entities (${selected.size} selected)`}
      </button>
      {open && (
        <div className="ha-picker-body">
          {loading && <p className="sec-note">loading entities…</p>}
          {error && <p className="sec-note">{error}</p>}
          {available && (
            <>
              <input
                className="ha-picker-search"
                placeholder="search entities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <div className="ha-picker-list">
                {filtered.slice(0, 200).map((e) => (
                  <label key={e.entityId} className="ha-picker-row">
                    <input type="checkbox" checked={selected.has(e.entityId)} onChange={() => toggle(e.entityId)} />
                    <span className="ha-picker-name">{e.name}</span>
                    <small className="ha-picker-id">{e.entityId}</small>
                  </label>
                ))}
                {filtered.length === 0 && <p className="sec-note">no entities match</p>}
                {filtered.length > 200 && (
                  <p className="sec-note">showing first 200 of {filtered.length} — search to narrow it down</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AccountsSection({ settings, onChange }: SectionProps) {
  const ig = settings.integrations;
  const patch = (next: Partial<Settings["integrations"]>) =>
    onChange({ ...settings, integrations: { ...ig, ...next } });
  const [symbolsDraft, setSymbolsDraft] = useState(ig.stocks.symbols.join(", "));

  return (
    <>
      <p className="sec-note">
        usernames and keys for the widgets that talk to the outside world. keys live in your
        account&rsquo;s settings, never in the page.
      </p>

      <AccountGroup title="last.fm" blurb="now playing — navidrome scrobbles land here">
        <AccountField
          label="username"
          value={settings.lastfm.username}
          onValue={(v) => onChange({ ...settings, lastfm: { ...settings.lastfm, username: v } })}
        />
        <AccountField
          label="api key (optional — falls back to the server's LASTFM_API_KEY)"
          value={settings.lastfm.apiKey}
          secret
          onValue={(v) => onChange({ ...settings, lastfm: { ...settings.lastfm, apiKey: v } })}
        />
      </AccountGroup>

      <AccountGroup title="github" blurb="recent commits and activity">
        <AccountField
          label="username"
          value={ig.github.username}
          onValue={(v) => patch({ github: { ...ig.github, username: v } })}
        />
        <AccountField
          label="token (optional — higher rate limit)"
          value={ig.github.token}
          secret
          onValue={(v) => patch({ github: { ...ig.github, token: v } })}
        />
      </AccountGroup>

      <AccountGroup title="chess.com" blurb="blitz · rapid · bullet ratings">
        <AccountField
          label="username"
          value={ig.chess.username}
          onValue={(v) => patch({ chess: { username: v } })}
        />
      </AccountGroup>

      <AccountGroup title="stocks" blurb="tickers, comma separated (^GSPC works too)">
        <label className="field">
          <span>symbols</span>
          <input
            value={symbolsDraft}
            placeholder="AAPL, SPY, ^GSPC"
            onChange={(e) => {
              setSymbolsDraft(e.target.value);
              patch({
                stocks: {
                  symbols: e.target.value
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean)
                    .slice(0, 6),
                },
              });
            }}
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </label>
      </AccountGroup>

      <AccountGroup title="septa" blurb="regional rail arrivals from api.septa.org">
        <AccountField
          label="station"
          value={ig.septa?.station}
          placeholder="30th Street Station"
          onValue={(v) => patch({ septa: { station: v } })}
        />
      </AccountGroup>

      <AccountGroup title="jellyfin" blurb="api key, or username + password">
        <AccountField
          label="server url"
          value={ig.jellyfin?.url}
          placeholder="https://jellyfin.example.com"
          onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, url: v } })}
        />
        <AccountField
          label="api key (dashboard → api keys)"
          value={ig.jellyfin?.apiKey}
          secret
          onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, apiKey: v } })}
        />
        <AccountField
          label="username (optional if api key is set)"
          value={ig.jellyfin?.username}
          onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, username: v } })}
        />
        <AccountField
          label="password (optional if api key is set)"
          value={ig.jellyfin?.password}
          secret
          onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, password: v } })}
        />
      </AccountGroup>

      <AccountGroup title="plex" blurb="what's streaming on your server">
        <AccountField
          label="server url"
          value={ig.plex?.url}
          placeholder="http://192.168.1.10:32400"
          onValue={(v) => patch({ plex: { ...ig.plex, url: v } })}
        />
        <AccountField
          label="x-plex-token"
          value={ig.plex?.token}
          secret
          onValue={(v) => patch({ plex: { ...ig.plex, token: v } })}
        />
      </AccountGroup>

      <AccountGroup title="adguard home" blurb="dns queries blocked today">
        <AccountField
          label="server url"
          value={ig.adguard?.url}
          placeholder="http://192.168.1.10:3000"
          onValue={(v) => patch({ adguard: { ...ig.adguard, url: v } })}
        />
        <AccountField
          label="username"
          value={ig.adguard?.username}
          onValue={(v) => patch({ adguard: { ...ig.adguard, username: v } })}
        />
        <AccountField
          label="password"
          value={ig.adguard?.password}
          secret
          onValue={(v) => patch({ adguard: { ...ig.adguard, password: v } })}
        />
      </AccountGroup>

      <AccountGroup title="pi-hole" blurb="dns queries blocked today">
        <AccountField
          label="server url"
          value={ig.pihole?.url}
          placeholder="http://192.168.1.11"
          onValue={(v) => patch({ pihole: { ...ig.pihole, url: v } })}
        />
        <AccountField
          label="password"
          value={ig.pihole?.password}
          secret
          onValue={(v) => patch({ pihole: { ...ig.pihole, password: v } })}
        />
      </AccountGroup>

      <AccountGroup title="home assistant" blurb="entities you pick, tap to toggle">
        <AccountField
          label="server url"
          value={ig.homeassistant?.url}
          placeholder="http://192.168.1.12:8123"
          onValue={(v) => patch({ homeassistant: { ...ig.homeassistant, url: v } })}
        />
        <AccountField
          label="long-lived access token"
          value={ig.homeassistant?.token}
          secret
          maxLength={2000}
          onValue={(v) => patch({ homeassistant: { ...ig.homeassistant, token: v } })}
        />
        <HomeAssistantEntityPicker settings={settings} patch={patch} />
      </AccountGroup>

      <AccountGroup title="seerr" blurb="jellyseerr / overseerr media requests">
        <AccountField
          label="server url"
          value={ig.seerr?.url}
          placeholder="http://192.168.1.13:5055"
          onValue={(v) => patch({ seerr: { ...ig.seerr, url: v } })}
        />
        <AccountField
          label="api key (settings → general in seerr)"
          value={ig.seerr?.apiKey}
          secret
          onValue={(v) => patch({ seerr: { ...ig.seerr, apiKey: v } })}
        />
      </AccountGroup>

      <AccountGroup title="qbittorrent" blurb="api key (5.2+), username + password, or an already-authenticated url">
        <AccountField
          label="webui url"
          value={ig.qbittorrent?.url}
          placeholder="http://192.168.1.14:8080"
          onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, url: v } })}
        />
        <p className="sec-note">
          using <b>qui</b> (autobrr/qui)? create a client proxy key (settings → client proxy keys)
          and paste that url above — leave api key, username, and password blank, it&rsquo;s
          already authenticated.
        </p>
        <AccountField
          label="api key (webui settings → advanced, 5.2+)"
          value={ig.qbittorrent?.apiKey}
          secret
          onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, apiKey: v } })}
        />
        <AccountField
          label="username (optional)"
          value={ig.qbittorrent?.username}
          onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, username: v } })}
        />
        <AccountField
          label="password (optional)"
          value={ig.qbittorrent?.password}
          secret
          onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, password: v } })}
        />
      </AccountGroup>

      <AccountGroup title="transmission" blurb="torrents, speed & ratio">
        <AccountField
          label="rpc url"
          value={ig.transmission?.url}
          placeholder="http://192.168.1.15:9091"
          onValue={(v) => patch({ transmission: { ...ig.transmission, url: v } })}
        />
        <AccountField
          label="username (optional)"
          value={ig.transmission?.username}
          onValue={(v) => patch({ transmission: { ...ig.transmission, username: v } })}
        />
        <AccountField
          label="password (optional)"
          value={ig.transmission?.password}
          secret
          onValue={(v) => patch({ transmission: { ...ig.transmission, password: v } })}
        />
      </AccountGroup>

      <AccountGroup title="anilist" blurb="anime days watched + stats">
        <AccountField
          label="username"
          value={ig.anilist.username}
          onValue={(v) => patch({ anilist: { username: v } })}
        />
      </AccountGroup>

      <AccountGroup title="wakatime" blurb="today's coding time — also works with wakapi / hackatime">
        <AccountField
          label="api key"
          value={ig.wakatime.apiKey}
          secret
          onValue={(v) => patch({ wakatime: { ...ig.wakatime, apiKey: v } })}
        />
        <AccountField
          label="api url (optional — e.g. https://hackatime.hackclub.com/api/hackatime/v1)"
          value={ig.wakatime.apiUrl}
          placeholder="https://api.wakatime.com/api/v1"
          onValue={(v) => patch({ wakatime: { ...ig.wakatime, apiUrl: v } })}
        />
      </AccountGroup>
    </>
  );
}
