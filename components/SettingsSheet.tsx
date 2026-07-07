"use client";

import { useEffect, useRef, useState } from "react";
import type { Alarm, GeocodeResult, LayoutRow, Settings, ThemeName, WidgetName } from "@/lib/types";
import { MAX_ROWS, THEME_INFO, THEMES, WIDGET_INFO, WIDGETS } from "@/lib/types";
import { dayChips, fmt12 } from "./alarmUtil";

type Tab = "layout" | "theme" | "alarms" | "location" | "music";
const TABS: Tab[] = ["layout", "theme", "alarms", "location", "music"];

// swatch previews for the theme cards (mirrors globals.css palettes)
const SWATCH: Record<ThemeName, { bg: string; accent: string }> = {
  ember: { bg: "#0a0908", accent: "#e8a13c" },
  moonlight: { bg: "#060a10", accent: "#8fc3f2" },
  meadow: { bg: "#070a06", accent: "#b4d16a" },
  rose: { bg: "#0d070a", accent: "#ee94ac" },
  paper: { bg: "#f2ecdf", accent: "#bc5b22" },
};

export default function SettingsSheet({
  open,
  settings,
  username,
  saved,
  onClose,
  onChange,
}: {
  open: boolean;
  settings: Settings;
  username: string;
  saved: boolean;
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
            {tab === "layout" && <LayoutSection settings={settings} onChange={onChange} />}
            {tab === "theme" && <ThemeSection settings={settings} onChange={onChange} />}
            {tab === "alarms" && <AlarmsSection settings={settings} onChange={onChange} />}
            {tab === "location" && <LocationSection settings={settings} onChange={onChange} />}
            {tab === "music" && <MusicSection settings={settings} onChange={onChange} />}
          </div>
        )}
        <div className="sheet-foot">
          <span>signed in as {username}</span>
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

function LayoutSection({ settings, onChange }: SectionProps) {
  const [picking, setPicking] = useState<{ row: number; slot: "left" | "right" | "widget" } | null>(
    null
  );
  const rows = settings.layout.rows;

  function setRows(next: LayoutRow[]) {
    onChange({ ...settings, layout: { rows: next } });
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
        <div className="wgrid">
          {WIDGETS.map((w) => (
            <button key={w} className={`wcard${current === w ? " on" : ""}`} onClick={() => pick(w)}>
              <b>{WIDGET_INFO[w].label}</b>
              <small>{WIDGET_INFO[w].blurb}</small>
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <p className="sec-note">
        rows stack vertically — swipe <b>up / down</b> on the dashboard to move between them.
        dual rows give one widget the whole width.
      </p>
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

/* ── music (the only text-entry config left: secret overrides) ───── */

function MusicSection({ settings, onChange }: SectionProps) {
  return (
    <>
      <p className="sec-note">
        navidrome scrobbles to last.fm; the now-playing widget reads it back. the api key is
        optional — leave it empty to use the server&rsquo;s <b>LASTFM_API_KEY</b>.
      </p>
      <label className="field">
        <span>last.fm username</span>
        <input
          value={settings.lastfm.username}
          maxLength={64}
          onChange={(e) =>
            onChange({ ...settings, lastfm: { ...settings.lastfm, username: e.target.value } })
          }
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      <label className="field">
        <span>api key override (optional)</span>
        <input
          value={settings.lastfm.apiKey}
          maxLength={64}
          onChange={(e) =>
            onChange({ ...settings, lastfm: { ...settings.lastfm, apiKey: e.target.value } })
          }
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
    </>
  );
}
