"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Alarm, Device, GeocodeResult, LayoutRow, ViewSettings, WidgetName } from "@/lib/types";
import { MAX_ROWS, WIDGET_CATEGORIES, WIDGET_INFO, WIDGETS, WIDGET_PAGE_COUNT } from "@/lib/types";
import { dayChips, fmt12 } from "./alarmUtil";
import { useIntegrationAction } from "./widgets/kit";
import { useWeather } from "./widgets/Weather";
import { pausedTonight } from "./night";
import { useNow } from "./hooks";
import { MacapadSection, type MacapadFocus } from "./MacapadSettings";

/* iPhone Settings, dark. On a phone the sheet is a drill-in list (one
   section per screen); on a wide screen (the Echo) it is iPad Settings:
   a sidebar of sections with the chosen one scrolling on the right.
   Styles: app/styles/settings.css. */

export type Tab = "layout" | "macapad" | "alarms" | "calendar" | "location" | "night" | "devices" | "accounts";

const NAV: Tab[][] = [
  ["layout", "alarms", "calendar", "location", "night"],
  ["accounts", "macapad", "devices"],
];

const TAB_INFO: Record<Tab, { label: string; icon: string; color: string }> = {
  layout: { label: "Layout", icon: "dashboard", color: "var(--blue)" },
  alarms: { label: "Alarms", icon: "alarm", color: "var(--orange)" },
  calendar: { label: "Calendars", icon: "calendar_month", color: "var(--red)" },
  location: { label: "Location", icon: "location_on", color: "var(--green)" },
  night: { label: "Night mode", icon: "bedtime", color: "var(--indigo)" },
  accounts: { label: "Accounts", icon: "account_circle", color: "var(--gray)" },
  macapad: { label: "Macapad", icon: "keyboard_command_key", color: "var(--indigo)" },
  devices: { label: "Screens", icon: "tv", color: "var(--teal)" },
};

/* each widget's tint, the same one it wears on the board (board.css) */
const TINTS: Record<string, WidgetName[]> = {
  green: ["clock", "please_disturb", "github", "stocks", "citybikes", "adguard", "chess"],
  orange: ["analog", "worldclock", "alarms", "timer", "archerhours", "plex", "fox", "shibe"],
  red: ["date", "datetime", "calendar", "agenda", "f1", "pihole", "transmission", "embed"],
  cyan: ["weather", "forecast", "homeassistant"],
  yellow: ["sun", "quote", "away_until", "monkeytype", "catfact", "dogfact", "duck"],
  indigo: ["moon", "dnd", "seerr"],
  pink: ["nowplaying", "navidrome", "vibe"],
  purple: ["spacenews", "jellyfin"],
  blue: ["anilist", "wakatime", "flights", "septa", "macapad", "qbittorrent", "lichess"],
  mint: ["epicgames", "dog", "cat"],
};
const TINT_OF = new Map<string, string>(
  Object.entries(TINTS).flatMap(([c, ws]) => ws.map((w) => [w, `var(--${c})`] as [string, string]))
);
const tintOf = (w: WidgetName) => TINT_OF.get(w) ?? "var(--gray)";

/** first letter up: "date & time" → "Date & time" */
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function MI({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`mi${className ? ` ${className}` : ""}`} aria-hidden>
      {name}
    </span>
  );
}

/** an iOS-Settings style icon: white glyph on a rounded square of color */
function Tile({ icon, color, big }: { icon: string; color: string; big?: boolean }) {
  return (
    <span className={`tile${big ? " big" : ""}`} style={{ "--c": color } as CSSProperties} aria-hidden>
      <MI name={icon} />
    </span>
  );
}

function Chev({ dir = "right" }: { dir?: "right" | "left" | "down" }) {
  return <span className={`chev ${dir}`} aria-hidden />;
}

/** iOS segmented control with a sliding raised thumb */
function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  return (
    <div
      className={`seg${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={label}
      style={{ "--n": options.length, "--i": i } as CSSProperties}
    >
      <span className="seg-thumb" aria-hidden />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={o.value === value ? "on" : ""}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** the green switch; sits inside a <label> row so the whole row toggles */
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="ios-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

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
      { type: "split", left: "vibe", right: "away_until" },
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
    blurb: "github, chess, monkeytype",
    rows: [
      { type: "split", left: "github", right: "chess" },
      { type: "split", left: "wakatime", right: "monkeytype" },
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
  {
    name: "homelab",
    blurb: "mac pad, media servers, home",
    rows: [
      { type: "dual", widget: "macapad" },
      { type: "split", left: "macapad", right: "navidrome" },
      { type: "split", left: "jellyfin", right: "plex" },
      { type: "split", left: "homeassistant", right: "transmission" },
    ],
  },
];

export default function SettingsSheet({
  open,
  settings,
  username,
  saved,
  initialTab = "layout",
  direct = false,
  activePage,
  macapadFocus,
  deviceId,
  padScreen,
  onChooseDevice,
  onClose,
  onChange,
}: {
  open: boolean;
  settings: ViewSettings;
  username: string;
  saved: boolean;
  initialTab?: Tab;
  /** opened for one section (a deep link) rather than from the settings button */
  direct?: boolean;
  activePage?: number;
  macapadFocus?: MacapadFocus | null;
  deviceId: string;
  /** whose pad page settings → macapad opens on: this screen, or "remote" */
  padScreen?: string;
  onChooseDevice: (id: string) => void;
  onClose: () => void;
  onChange: (next: ViewSettings) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // phone only: showing a section (true) or the list of sections (false).
  // The settings button lands on the list; a deep link (the macapad gear, the
  // remote's accounts button) opens its section directly.
  const [drilled, setDrilled] = useState(direct);
  const secRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setDrilled(direct);
  }, [initialTab, direct, open]);

  // start each section from the top
  useEffect(() => {
    secRef.current?.scrollTo({ top: 0 });
  }, [tab, open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  function go(t: Tab) {
    setTab(t);
    setDrilled(true);
  }

  const alarmsOn = settings.alarms.filter((a) => a.enabled).length;
  const calendarsOn = (settings.calendars ?? []).filter((c) => c.enabled).length;
  const navValue: Partial<Record<Tab, string>> = {
    alarms: settings.alarms.length ? (alarmsOn ? `${alarmsOn} on` : "Off") : "",
    calendar: calendarsOn ? `${calendarsOn} on` : "",
    location: settings.location.name,
    night: nightValue(settings.devices),
    devices: settings.deviceName,
  };

  return (
    <>
      <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div
        className={`sheet${open ? " open" : ""}${drilled ? " drilled" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <nav className="set-side" aria-label="Settings sections">
          <div className="set-bar set-side-bar">
            <span />
            <span />
            <button className="set-done" onClick={onClose}>
              Done
            </button>
          </div>
          <div className="set-side-scroll">
            <h1 className="large-title set-big">Settings</h1>
            {NAV.map((group, gi) => (
              <div key={gi} className="group set-nav">
                {group.map((t) => (
                  <button
                    key={t}
                    className={`group-row set-nav-row${tab === t ? " on" : ""}`}
                    aria-current={tab === t ? "page" : undefined}
                    data-tab={t}
                    onClick={() => go(t)}
                  >
                    <Tile icon={TAB_INFO[t].icon} color={TAB_INFO[t].color} />
                    <span className="row-label">{TAB_INFO[t].label}</span>
                    {navValue[t] && <span className="row-value">{navValue[t]}</span>}
                    <Chev />
                  </button>
                ))}
              </div>
            ))}
            <div className="group set-nav set-account">
              <div className="group-row">
                <span className="row-label">Signed in as</span>
                <span className="row-value">{username}</span>
              </div>
              <a
                className="group-row set-link"
                href="https://github.com/AD-Archer/archersdesk/issues"
                target="_blank"
                rel="noreferrer"
              >
                <span className="row-label">Report a problem or ask for a feature</span>
              </a>
              <button className="group-row set-signout" onClick={logout}>
                <span className="row-label">Sign out</span>
              </button>
            </div>
            <p className="group-foot set-side-foot">Changes save on their own as you go.</p>
          </div>
        </nav>

        <section className="set-main" aria-label={TAB_INFO[tab].label}>
          <div className="set-bar">
            <button className="set-back" onClick={() => setDrilled(false)}>
              <Chev dir="left" />
              Settings
            </button>
            <h2 className="set-bar-title">{TAB_INFO[tab].label}</h2>
            <span className="set-bar-end">
              <span className={`set-saved${saved ? " show" : ""}`} aria-live="polite">
                <MI name="check" />
                Saved
              </span>
              <button className="set-done" onClick={onClose}>
                Done
              </button>
            </span>
          </div>
          {open && (
            <div className="sec" ref={secRef} data-tab={tab}>
              {tab === "layout" && (
                <LayoutSection settings={settings} onChange={onChange} initialPage={activePage} />
              )}
              {tab === "macapad" && <MacapadSection settings={settings} onChange={onChange} focus={macapadFocus} screen={padScreen ?? deviceId} />}
              {tab === "alarms" && <AlarmsSection settings={settings} onChange={onChange} />}
              {tab === "calendar" && <CalendarSection settings={settings} onChange={onChange} />}
              {tab === "location" && <LocationSection settings={settings} onChange={onChange} />}
              {tab === "night" && <NightSection settings={settings} onChange={onChange} />}
              {tab === "devices" && (
                <DevicesSection
                  settings={settings}
                  onChange={onChange}
                  deviceId={deviceId}
                  onChooseDevice={onChooseDevice}
                />
              )}
              {tab === "accounts" && <AccountsSection settings={settings} onChange={onChange} />}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

type SectionProps = { settings: ViewSettings; onChange: (next: ViewSettings) => void };

/* ── layout ──────────────────────────────────────────────────────── */

const SLOT_NAME = { left: "Left side", right: "Right side", widget: "Whole row" } as const;

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
  const topRef = useRef<HTMLDivElement | null>(null);
  const pages = Array.from({ length: WIDGET_PAGE_COUNT }, (_, i) => settings.layout.pages?.[i] ?? settings.layout.rows);
  const rows = pages[pageIndex] ?? pages[0] ?? settings.layout.rows;

  // the widget picker starts at the top
  useEffect(() => {
    if (picking) topRef.current?.closest(".sec")?.scrollTo({ top: 0 });
  }, [picking]);

  function setRows(next: LayoutRow[]) {
    const nextPages = pages.map((p, i) => (i === pageIndex ? next : p));
    onChange({ ...settings, layout: { ...settings.layout, rows: nextPages[0], pages: nextPages } });
  }

  function applyPreset(nextRows: LayoutRow[]) {
    setRows(nextRows.map((r) => ({ ...r })));
  }

  function savePersonalPreset(i: number) {
    const presets = Array.from({ length: 2 }, (_, j) => settings.presets?.[j] ?? []);
    presets[i] = rows.map((r) => ({ ...r }));
    onChange({ ...settings, presets });
  }

  function loadPersonalPreset(i: number) {
    const preset = settings.presets?.[i] ?? [];
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
    const where = picking.slot === "widget" ? "whole row" : `${picking.slot} side`;
    return (
      <div ref={topRef}>
        <button className="sub-back" onClick={() => setPicking(null)}>
          <Chev dir="left" />
          Page {pageIndex + 1}
        </button>
        <h3 className="pick-title">
          Row {picking.row + 1}, {where}
        </h3>
        <p className="pick-sub">Pick what shows here.</p>
        {WIDGET_CATEGORIES.map((cat) => (
          <section key={cat.key} className="wgroup">
            <h4 className="group-head">{cap(cat.label)}</h4>
            <div className="wgrid">
              {WIDGETS.filter((w) => WIDGET_INFO[w].category === cat.key).map((w) => (
                <button
                  key={w}
                  className={`wcard${current === w ? " on" : ""}`}
                  aria-pressed={current === w}
                  onClick={() => pick(w)}
                >
                  <Tile icon={WIDGET_INFO[w].icon} color={tintOf(w)} big />
                  <span className="wcard-text">
                    <b>{cap(WIDGET_INFO[w].label)}</b>
                    <small>{cap(WIDGET_INFO[w].blurb)}</small>
                  </span>
                  {current === w && <MI name="check" className="wcard-check" />}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const slotRow = (i: number, slot: "left" | "right" | "widget", w: WidgetName) => (
    <button
      className="group-row tile-row slot"
      onClick={() => setPicking({ row: i, slot })}
      aria-label={`${SLOT_NAME[slot]}: ${WIDGET_INFO[w].label}. Change`}
    >
      <Tile icon={WIDGET_INFO[w].icon} color={tintOf(w)} />
      <span className="row-label">{cap(WIDGET_INFO[w].label)}</span>
      <span className="row-value">{SLOT_NAME[slot]}</span>
      <Chev />
    </button>
  );

  return (
    <div ref={topRef}>
      <Seg
        className="seg-full"
        label="Page"
        value={pageIndex}
        options={pages.map((_, i) => ({ value: i, label: `Page ${i + 1}` }))}
        onChange={setPageIndex}
      />
      <p className="group-foot set-lead">
        Standby comes first. Swipe sideways to reach pages 1 and 2, then up or down through each
        page&rsquo;s rows.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="lrow">
          <div className="group-head lrow-head">
            <span>Row {i + 1}</span>
            <span className="lrow-tools">
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move row ${i + 1} up`}>
                <MI name="arrow_upward" />
              </button>
              <button
                className="icon-btn"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                aria-label={`Move row ${i + 1} down`}
              >
                <MI name="arrow_downward" />
              </button>
              <button
                className="icon-btn red"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                disabled={rows.length === 1}
                aria-label={`Remove row ${i + 1}`}
              >
                <MI name="delete" />
              </button>
            </span>
          </div>
          <div className="group">
            <div className="group-row">
              <span className="row-label">Shape</span>
              <Seg
                className="seg-row"
                label={`Row ${i + 1} shape`}
                value={r.type}
                options={[
                  { value: "split", label: "Two squares" },
                  { value: "dual", label: "One wide" },
                ]}
                onChange={(v) => setType(i, v)}
              />
            </div>
            {r.type === "split" ? (
              <>
                {slotRow(i, "left", r.left)}
                {slotRow(i, "right", r.right)}
              </>
            ) : (
              slotRow(i, "widget", r.widget)
            )}
          </div>
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <div className="group set-gap">
          <button
            className="group-row row-action"
            onClick={() => setRows([...rows, { type: "split", left: "clock", right: "calendar" }])}
          >
            <MI name="add" />
            Add a row
          </button>
        </div>
      )}

      <h3 className="group-head">Start from a ready-made layout</h3>
      <div className="preset-grid">
        {LAYOUT_PRESETS.map((preset) => (
          <button key={preset.name} className="preset" onClick={() => applyPreset(preset.rows)}>
            <b>{cap(preset.name)}</b>
            <small>{cap(preset.blurb)}</small>
          </button>
        ))}
      </div>
      <p className="group-foot">Tapping one replaces the rows on page {pageIndex + 1}.</p>

      <h3 className="group-head">Your saved layouts</h3>
      <div className="group">
        {[0, 1].map((i) => {
          const count = settings.presets?.[i]?.length ?? 0;
          return (
            <div key={i} className="group-row saved-row">
              <span className="row-text">
                <b>Saved layout {i + 1}</b>
                <small>{count ? `${count} row${count === 1 ? "" : "s"}` : "Empty"}</small>
              </span>
              <button className="btn btn-sm" onClick={() => savePersonalPreset(i)}>
                Save page {pageIndex + 1}
              </button>
              <button className="btn btn-sm blue" onClick={() => loadPersonalPreset(i)} disabled={!count}>
                Use
              </button>
            </div>
          );
        })}
      </div>
      <p className="group-foot">Save keeps a copy of this page&rsquo;s rows so you can bring them back later.</p>
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
    const alarms: Alarm[] = [
      ...settings.alarms,
      { time: "07:00", label: "alarm", days: [], enabled: true, devices: [] },
    ];
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
        <p className="set-empty">No alarms yet. They ring full-screen with a chime.</p>
      )}
      <div className="alarm-list">
        {settings.alarms.map((a, i) => {
          const t = fmt12(a.time);
          const isOpen = editing === i;
          return (
            <div key={i} className={`group alarm${isOpen ? " open" : ""}${a.enabled ? "" : " off"}`}>
              <div className="alarm-row">
                <button className="alarm-main" aria-expanded={isOpen} onClick={() => setEditing(isOpen ? null : i)}>
                  <span className="alarm-time">
                    {t.time}
                    <small>{t.ampm.toUpperCase()}</small>
                  </span>
                  <span className="alarm-sub">
                    {a.label}, {dayChips(a.days)}
                  </span>
                </button>
                <label className="ios-switch" aria-label={`${a.label} ${a.enabled ? "on" : "off"}`}>
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    onChange={(e) => patchAlarm(i, { enabled: e.target.checked })}
                  />
                  <span />
                </label>
              </div>
              {isOpen && (
                <div className="alarm-edit">
                  <label className="group-row in-row">
                    <span className="row-label">Time</span>
                    <input
                      className="in in-time"
                      type="time"
                      value={a.time}
                      onChange={(e) => e.target.value && patchAlarm(i, { time: e.target.value })}
                    />
                  </label>
                  <label className="group-row in-row">
                    <span className="row-label">Name</span>
                    <input
                      className="in"
                      value={a.label}
                      maxLength={40}
                      onChange={(e) => patchAlarm(i, { label: e.target.value })}
                    />
                  </label>
                  <div className="group-row chips-row">
                    <span className="chips-label">
                      Repeat
                      <span className="row-value">{cap(dayChips(a.days))}</span>
                    </span>
                    <div className="chips days">
                      {DAY_ORDER.map((d) => (
                        <button
                          key={d}
                          className={`chip${a.days.includes(d) ? " on" : ""}`}
                          aria-pressed={a.days.includes(d)}
                          onClick={() =>
                            patchAlarm(i, {
                              days: a.days.includes(d)
                                ? a.days.filter((x) => x !== d)
                                : [...a.days, d],
                            })
                          }
                        >
                          {cap(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="group-row chips-row">
                    <span className="chips-label">
                      Rings on
                      <span className="row-value">
                        {a.devices.length === 0
                          ? "Every screen"
                          : `${a.devices.length} screen${a.devices.length === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    <div className="chips">
                      {settings.devices.map((d) => (
                        <button
                          key={d.id}
                          className={`chip${a.devices.includes(d.id) ? " on" : ""}`}
                          aria-pressed={a.devices.includes(d.id)}
                          onClick={() =>
                            patchAlarm(i, {
                              devices: a.devices.includes(d.id)
                                ? a.devices.filter((x) => x !== d.id)
                                : [...a.devices, d.id],
                            })
                          }
                        >
                          {cap(d.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="group-row alarm-foot">
                    <button className="text-btn red" onClick={() => removeAlarm(i)}>
                      Delete alarm
                    </button>
                    <button className="btn btn-sm blue" onClick={() => setEditing(null)}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="group set-gap">
        <button className="group-row row-action" onClick={addAlarm}>
          <MI name="add" />
          Add an alarm
        </button>
      </div>
      <p className="group-foot">Alarms ring full-screen with a chime. Pick no screens and it rings on all of them.</p>
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
      <h3 className="group-head set-first">Show in the agenda</h3>
      <div className="group">
        {calendars.map((c, i) => (
          <div key={c.id} className="group-row check-row">
            <label className="check-hit">
              <input
                type="checkbox"
                className="vh"
                checked={c.enabled}
                onChange={(e) => setCalendars(calendars.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
              />
              <span className="tick" aria-hidden />
              <span className="row-text">
                <b>{c.name}</b>
                <small>{c.url.replace(/^(https?|webcal):\/\//, "")}</small>
              </span>
            </label>
            <button
              className="icon-btn red"
              onClick={() => setCalendars(calendars.filter((_, j) => j !== i))}
              aria-label={`Remove ${c.name}`}
            >
              <MI name="delete" />
            </button>
          </div>
        ))}
        <div className="group-row check-row">
          <label className="check-hit">
            <input
              type="checkbox"
              className="vh"
              checked={settings.showEpicInAgenda}
              onChange={(e) => onChange({ ...settings, showEpicInAgenda: e.target.checked })}
            />
            <span className="tick" aria-hidden />
            <span className="row-text">
              <b>Epic free games</b>
              <small>This week&rsquo;s free games, as agenda events</small>
            </span>
          </label>
        </div>
      </div>
      <p className="group-foot">Tap the agenda widget itself to switch between 3, 5 and 7 days.</p>

      <h3 className="group-head">Add a calendar</h3>
      <div className="group">
        <label className="group-row in-row">
          <span className="row-label">Name</span>
          <input className="in" value={name} maxLength={60} placeholder="Work" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="group-row in-row">
          <span className="row-label">Link</span>
          <input
            className="in"
            value={url}
            maxLength={400}
            placeholder="https://…/basic.ics"
            onChange={(e) => setUrl(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <button className="group-row row-action" onClick={addFeed} disabled={!url.trim()}>
          <MI name="add" />
          Add calendar
        </button>
      </div>
      <p className="group-foot">
        Paste the calendar&rsquo;s private link. Google, Apple and Outlook all have one, often called
        the &ldquo;secret address&rdquo;. Links starting with webcal:// work too.
      </p>
    </>
  );
}

/* ── location ────────────────────────────────────────────────────── */

/* ── night mode ──────────────────────────────────────────────────── */

function nightValue(devices: Device[]): string {
  const on = devices.filter((d) => d.night.enabled).length;
  if (on === devices.length) return "On";
  if (on === 0) return "Off";
  return `${on} of ${devices.length}`;
}

function NightSection({ settings, onChange }: SectionProps) {
  const wx = useWeather(settings);
  const now = useNow(60_000);
  const devices = settings.devices;
  const sunset = wx && !wx.error && wx.sunset ? fmt12(new Date(wx.sunset).toTimeString().slice(0, 5)) : null;
  const sunrise = wx && !wx.error && wx.sunrise ? fmt12(new Date(wx.sunrise).toTimeString().slice(0, 5)) : null;

  function patch(id: string, night: Partial<Device["night"]>) {
    onChange({
      ...settings,
      devices: devices.map((d) => (d.id === id ? { ...d, night: { ...d.night, ...night } } : d)),
    });
  }

  function isPaused(d: Device) {
    if (wx && !wx.error && wx.sunrise) return pausedTonight(d.night, wx.sunrise, now);
    // no sun times yet: treat a press from the last 16 hours as tonight's
    return !!d.night.pausedAt && now.getTime() - new Date(d.night.pausedAt).getTime() < 16 * 3600_000;
  }

  const enabled = devices.filter((d) => d.night.enabled);

  return (
    <>
      <p className="group-foot set-first set-lede">
        Between sunset and sunrise the screen turns red, so it doesn&apos;t light up the room.
        {sunset && sunrise && (
          <>
            {" "}
            Tonight that&apos;s {sunset.time} {sunset.ampm} to {sunrise.time} {sunrise.ampm}.
          </>
        )}
      </p>

      {enabled.length > 0 && (
        <>
          <h3 className="group-head">Tonight</h3>
          <div className="group">
            {enabled.map((d) => {
              const paused = isPaused(d);
              return (
                <div key={d.id} className="group-row two-line">
                  <span className="row-text">
                    <b>{d.name}</b>
                    <small>{paused ? "Normal colors until sunrise" : "Turns red at sunset"}</small>
                  </span>
                  <button
                    className={`btn set-night-btn${paused ? " blue" : ""}`}
                    onClick={() => patch(d.id, { pausedAt: paused ? null : new Date().toISOString() })}
                  >
                    {paused ? "Turn back on" : "Not tonight"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="group-foot">&ldquo;Not tonight&rdquo; lasts until the next sunrise, then night mode is back.</p>
        </>
      )}

      <h3 className="group-head">Use night mode on</h3>
      <div className="group">
        {devices.map((d) => (
          <label key={d.id} className="group-row">
            <span className="row-label">{d.name}</span>
            <Switch checked={d.night.enabled} onChange={(v) => patch(d.id, { enabled: v, pausedAt: null })} />
          </label>
        ))}
      </div>
      <p className="group-foot">Switch a screen off to keep its normal colors every night.</p>
    </>
  );
}

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
      <h3 className="group-head set-first">Weather and sun times are for</h3>
      <div className="group">
        <div className="group-row tile-row two-line">
          <Tile icon="location_on" color="var(--blue)" />
          <span className="row-text">
            <b>{settings.location.name}</b>
            <small>{settings.location.region}</small>
          </span>
        </div>
      </div>

      <h3 className="group-head">Change city</h3>
      <label className="search">
        <MI name="search" />
        <input
          value={q}
          placeholder="Search for a city"
          onChange={(e) => setQ(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Search for a city"
        />
      </label>
      {results.length > 0 && (
        <div className="group set-results">
          {results.map((r, i) => (
            <button key={i} className="group-row two-line" onClick={() => pick(r)}>
              <span className="row-text">
                <b>{r.name}</b>
                <small>{r.region}</small>
              </span>
              <Chev />
            </button>
          ))}
        </div>
      )}

      <h3 className="group-head">Show</h3>
      <div className="group">
        <div className="group-row">
          <span className="row-label">Temperature in</span>
          <Seg
            className="seg-row seg-units"
            label="Temperature units"
            value={settings.units}
            options={[
              { value: "fahrenheit", label: "°F" },
              { value: "celsius", label: "°C" },
            ]}
            onChange={(units) => onChange({ ...settings, units })}
          />
        </div>
        <label className="group-row">
          <span className="row-label">Temperature on standby</span>
          <Switch
            checked={settings.standby.showTemp}
            onChange={(v) => onChange({ ...settings, standby: { ...settings.standby, showTemp: v } })}
          />
        </label>
        <label className="group-row">
          <span className="row-label">Next alarm on standby</span>
          <Switch
            checked={settings.standby.showAlarm}
            onChange={(v) => onChange({ ...settings, standby: { ...settings.standby, showAlarm: v } })}
          />
        </label>
      </div>
      <p className="group-foot">Standby shows these in small type above the big clock.</p>
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
  // "API key (optional, …)" → a short legend plus a quieter hint
  const cut = label.indexOf(" (");
  const legend = cut > 0 && label.endsWith(")") ? label.slice(0, cut) : label;
  const hint = legend === label ? null : label.slice(cut + 2, -1);
  return (
    <label className="stack-field">
      <span className="stack-label">
        {legend}
        {hint && <small>{cap(hint)}</small>}
      </span>
      <input
        className="in"
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

function AccountGroup({
  title,
  blurb,
  icon,
  color,
  done,
  children,
}: {
  title: string;
  blurb: string;
  icon: string;
  color: string;
  done?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`acct${open ? " open" : ""}`}>
      <button className="group-row tile-row two-line acct-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Tile icon={icon} color={color} />
        <span className="row-text">
          <b>{title}</b>
          <small>{blurb}</small>
        </span>
        {done && <span className="row-value">On</span>}
        <Chev dir={open ? "down" : "right"} />
      </button>
      {open && <div className="acct-body">{children}</div>}
    </div>
  );
}

function HomeAssistantEntityPicker({
  settings,
  patch,
}: {
  settings: ViewSettings;
  patch: (next: Partial<ViewSettings["integrations"]>) => void;
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
    if (!res.configured) {
      setError("Add the server address and token above first.");
      return;
    }
    if (!res.data) {
      setError(res.reason ?? "Home Assistant didn't answer. Check the address and token.");
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
      <button
        type="button"
        className={`ha-toggle${open ? " open" : ""}`}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className="row-label">Choose what to show</span>
        <span className="row-value">{selected.size} picked</span>
        <Chev dir={open ? "down" : "right"} />
      </button>
      {open && (
        <div className="ha-body">
          {loading && <p className="acct-note">Asking Home Assistant…</p>}
          {error && <p className="acct-note">{error}</p>}
          {available && (
            <>
              <label className="search">
                <MI name="search" />
                <input
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Search things in Home Assistant"
                />
              </label>
              <div className="ha-list">
                {filtered.slice(0, 200).map((e) => (
                  <label key={e.entityId} className="check-hit ha-row">
                    <input
                      type="checkbox"
                      className="vh"
                      checked={selected.has(e.entityId)}
                      onChange={() => toggle(e.entityId)}
                    />
                    <span className="tick" aria-hidden />
                    <span className="row-text">
                      <b>{e.name}</b>
                      <small>{e.entityId}</small>
                    </span>
                  </label>
                ))}
                {filtered.length === 0 && <p className="acct-note">Nothing matches.</p>}
                {filtered.length > 200 && (
                  <p className="acct-note">Showing the first 200 of {filtered.length}. Search to narrow it down.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── devices ─────────────────────────────────────────────────────── */

function DevicesSection({
  settings,
  onChange,
  deviceId,
  onChooseDevice,
}: SectionProps & { deviceId: string; onChooseDevice: (id: string) => void }) {
  const [name, setName] = useState("");
  const devices = settings.devices;

  function rename(id: string, next: string) {
    onChange({ ...settings, devices: devices.map((d) => (d.id === id ? { ...d, name: next } : d)) });
  }

  function remove(id: string) {
    if (devices.length <= 1) return;
    const nextDevices = devices.filter((d) => d.id !== id);
    onChange({ ...settings, devices: nextDevices });
    if (id === deviceId) onChooseDevice(nextDevices[0].id);
  }

  function add() {
    const n = name.trim();
    if (!n) return;
    const base = devices[0];
    const device: Device = {
      id: crypto.randomUUID(),
      name: n,
      location: { ...base.location },
      layout: { rows: [...base.layout.rows], pages: base.layout.pages.map((p) => [...p]) },
      standby: { ...base.standby },
      night: { enabled: base?.night?.enabled ?? true, pausedAt: null },
      presence: { awayUntil: null, awayLocation: "", vibe: "joyful" },
    };
    onChange({ ...settings, devices: [...devices, device] });
    setName("");
  }

  return (
    <>
      <h3 className="group-head set-first">Your screens</h3>
      <div className="group">
        {devices.map((d) => {
          const here = d.id === deviceId;
          return (
            <div key={d.id} className={`group-row tile-row dev-row${here ? " here" : ""}`}>
              <Tile icon="tv" color={here ? "var(--green)" : "var(--gray)"} />
              <input
                className="in dev-name"
                value={d.name}
                maxLength={40}
                onChange={(e) => rename(d.id, e.target.value)}
                aria-label={`Name of ${here ? "this screen" : d.name}`}
              />
              {here ? (
                <span className="dev-here">This screen</span>
              ) : (
                <button className="btn btn-sm" onClick={() => onChooseDevice(d.id)}>
                  Show here
                </button>
              )}
              <button
                className="icon-btn red"
                onClick={() => remove(d.id)}
                disabled={devices.length <= 1}
                aria-label={`Delete ${d.name}`}
              >
                <MI name="delete" />
              </button>
            </div>
          );
        })}
      </div>
      <p className="group-foot">
        Tap a name to rename it. Each screen has its own layout, city and away status; accounts,
        alarms and calendars are shared by all of them.
      </p>

      <h3 className="group-head">Add a screen</h3>
      <div className="group">
        <div className="group-row in-row">
          <input
            className="in in-left"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, like kitchen"
            maxLength={40}
            aria-label="New screen name"
          />
          <button className="text-btn blue" onClick={add} disabled={!name.trim()}>
            Add
          </button>
        </div>
      </div>
      <p className="group-foot">A new screen starts as a copy of your first one.</p>

      <div className="group set-gap">
        <button className="group-row row-action" onClick={() => onChooseDevice("remote")}>
          <MI name="smartphone" />
          Use this browser as a remote instead
        </button>
      </div>
    </>
  );
}

/* ── accounts ────────────────────────────────────────────────────── */

function AccountsSection({ settings, onChange }: SectionProps) {
  const ig = settings.integrations;
  const patch = (next: Partial<ViewSettings["integrations"]>) =>
    onChange({ ...settings, integrations: { ...ig, ...next } });
  const [symbolsDraft, setSymbolsDraft] = useState((ig.stocks?.symbols ?? []).join(", "));
  const w = (name: WidgetName) => ({ icon: WIDGET_INFO[name].icon, color: tintOf(name) });

  return (
    <>
      <p className="group-foot set-lead">
        Sign-ins for the widgets that show your own stuff. Keys stay in your account&rsquo;s
        settings on the server, never in the page.
      </p>

      <div className="group acct-list">
        <AccountGroup title="Last.fm" blurb="What you're listening to" {...w("nowplaying")} done={!!settings.lastfm.username}>
          <AccountField
            label="Username"
            value={settings.lastfm.username}
            onValue={(v) => onChange({ ...settings, lastfm: { ...settings.lastfm, username: v } })}
          />
          <AccountField
            label="API key (optional, the server's own key is used if blank)"
            value={settings.lastfm.apiKey}
            secret
            onValue={(v) => onChange({ ...settings, lastfm: { ...settings.lastfm, apiKey: v } })}
          />
        </AccountGroup>

        <AccountGroup title="GitHub" blurb="Recent commits and activity" {...w("github")} done={!!ig.github?.username}>
          <AccountField
            label="Username"
            value={ig.github?.username}
            onValue={(v) => patch({ github: { ...ig.github, username: v } })}
          />
          <AccountField
            label="Token (optional, lets it check more often)"
            value={ig.github?.token}
            secret
            onValue={(v) => patch({ github: { ...ig.github, token: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Chess.com" blurb="Blitz, rapid and bullet ratings" {...w("chess")} done={!!ig.chess?.username}>
          <AccountField
            label="Username"
            value={ig.chess?.username}
            onValue={(v) => patch({ chess: { username: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Lichess" blurb="Rapid, blitz, bullet and puzzle ratings" {...w("lichess")} done={!!ig.lichess?.username}>
          <AccountField
            label="Username"
            value={ig.lichess?.username}
            onValue={(v) => patch({ lichess: { username: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Monkeytype" blurb="Personal bests, streak and last test" {...w("monkeytype")} done={!!ig.monkeytype?.apeKey}>
          <AccountField
            label="Ape key"
            value={ig.monkeytype?.apeKey}
            secret
            maxLength={512}
            onValue={(v) => patch({ monkeytype: { apeKey: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Stocks" blurb="Tickers you watch" {...w("stocks")} done={(ig.stocks?.symbols ?? []).length > 0}>
          <label className="stack-field">
            <span className="stack-label">
              Symbols
              <small>Up to six, separated by commas. ^GSPC works too.</small>
            </span>
            <input
              className="in"
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

        <AccountGroup title="SEPTA" blurb="Next regional rail trains" {...w("septa")} done={!!ig.septa?.station}>
          <AccountField
            label="Station"
            value={ig.septa?.station}
            placeholder="30th Street Station"
            onValue={(v) => patch({ septa: { station: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Jellyfin" blurb="What's streaming on your server" {...w("jellyfin")} done={!!ig.jellyfin?.url}>
          <AccountField
            label="Server address"
            value={ig.jellyfin?.url}
            placeholder="https://jellyfin.example.com"
            onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, url: v } })}
          />
          <AccountField
            label="API key (Dashboard → API Keys)"
            value={ig.jellyfin?.apiKey}
            secret
            onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, apiKey: v } })}
          />
          <AccountField
            label="Username (not needed with an API key)"
            value={ig.jellyfin?.username}
            onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, username: v } })}
          />
          <AccountField
            label="Password (not needed with an API key)"
            value={ig.jellyfin?.password}
            secret
            onValue={(v) => patch({ jellyfin: { ...ig.jellyfin, password: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Plex" blurb="What's streaming on your server" {...w("plex")} done={!!ig.plex?.url}>
          <AccountField
            label="Server address"
            value={ig.plex?.url}
            placeholder="http://192.168.1.10:32400"
            onValue={(v) => patch({ plex: { ...ig.plex, url: v } })}
          />
          <AccountField
            label="Plex token"
            value={ig.plex?.token}
            secret
            onValue={(v) => patch({ plex: { ...ig.plex, token: v } })}
          />
        </AccountGroup>

        <AccountGroup title="AdGuard Home" blurb="Ads and trackers blocked today" {...w("adguard")} done={!!ig.adguard?.url}>
          <AccountField
            label="Server address"
            value={ig.adguard?.url}
            placeholder="http://192.168.1.10:3000"
            onValue={(v) => patch({ adguard: { ...ig.adguard, url: v } })}
          />
          <AccountField
            label="Username"
            value={ig.adguard?.username}
            onValue={(v) => patch({ adguard: { ...ig.adguard, username: v } })}
          />
          <AccountField
            label="Password"
            value={ig.adguard?.password}
            secret
            onValue={(v) => patch({ adguard: { ...ig.adguard, password: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Pi-hole" blurb="Ads and trackers blocked today" {...w("pihole")} done={!!ig.pihole?.url}>
          <AccountField
            label="Server address"
            value={ig.pihole?.url}
            placeholder="http://192.168.1.11"
            onValue={(v) => patch({ pihole: { ...ig.pihole, url: v } })}
          />
          <AccountField
            label="Password"
            value={ig.pihole?.password}
            secret
            onValue={(v) => patch({ pihole: { ...ig.pihole, password: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Home Assistant" blurb="Lights and switches you can tap" {...w("homeassistant")} done={!!ig.homeassistant?.url}>
          <AccountField
            label="Server address"
            value={ig.homeassistant?.url}
            placeholder="http://192.168.1.12:8123"
            onValue={(v) => patch({ homeassistant: { ...ig.homeassistant, url: v } })}
          />
          <AccountField
            label="Long-lived access token"
            value={ig.homeassistant?.token}
            secret
            maxLength={2000}
            onValue={(v) => patch({ homeassistant: { ...ig.homeassistant, token: v } })}
          />
          <HomeAssistantEntityPicker settings={settings} patch={patch} />
        </AccountGroup>

        <AccountGroup title="Macapad" blurb="Buttons that control your Mac" {...w("macapad")} done={!!ig.macapad?.url}>
          <AccountField
            label="Macapad address (menu bar → Copy API URL)"
            value={ig.macapad?.url}
            placeholder="http://100.70.88.101:7317"
            onValue={(v) => patch({ macapad: { ...ig.macapad, url: v } })}
          />
          <AccountField
            label="API token (menu bar → Copy API Token)"
            value={ig.macapad?.token}
            secret
            maxLength={200}
            onValue={(v) => patch({ macapad: { ...ig.macapad, token: v } })}
          />
          <p className="acct-note">
            The desk&rsquo;s server calls this address, not this screen, so use one the server can
            reach: localhost if they&rsquo;re on the same Mac, otherwise its Tailscale address.
          </p>
          <p className="acct-note">
            Each screen shows up under its own name in Macapad&rsquo;s settings on the Mac, where you can
            give it a schedule, like work hours for the office screen.
          </p>
        </AccountGroup>

        <AccountGroup title="Seerr" blurb="Jellyseerr or Overseerr requests" {...w("seerr")} done={!!ig.seerr?.url}>
          <AccountField
            label="Server address"
            value={ig.seerr?.url}
            placeholder="http://192.168.1.13:5055"
            onValue={(v) => patch({ seerr: { ...ig.seerr, url: v } })}
          />
          <AccountField
            label="API key (Settings → General in Seerr)"
            value={ig.seerr?.apiKey}
            secret
            onValue={(v) => patch({ seerr: { ...ig.seerr, apiKey: v } })}
          />
        </AccountGroup>

        <AccountGroup title="qBittorrent" blurb="Torrents, speed and ratio" {...w("qbittorrent")} done={!!ig.qbittorrent?.url}>
          <AccountField
            label="Web UI address"
            value={ig.qbittorrent?.url}
            placeholder="http://192.168.1.14:8080"
            onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, url: v } })}
          />
          <p className="acct-note">
            Using qui? Make a client proxy key (Settings → Client Proxy Keys), paste that address
            above and leave the rest blank. It&rsquo;s already signed in.
          </p>
          <AccountField
            label="API key (Web UI settings → Advanced, version 5.2 and up)"
            value={ig.qbittorrent?.apiKey}
            secret
            onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, apiKey: v } })}
          />
          <AccountField
            label="Username (optional)"
            value={ig.qbittorrent?.username}
            onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, username: v } })}
          />
          <AccountField
            label="Password (optional)"
            value={ig.qbittorrent?.password}
            secret
            onValue={(v) => patch({ qbittorrent: { ...ig.qbittorrent, password: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Transmission" blurb="Torrents, speed and ratio" {...w("transmission")} done={!!ig.transmission?.url}>
          <AccountField
            label="RPC address"
            value={ig.transmission?.url}
            placeholder="http://192.168.1.15:9091"
            onValue={(v) => patch({ transmission: { ...ig.transmission, url: v } })}
          />
          <AccountField
            label="Username (optional)"
            value={ig.transmission?.username}
            onValue={(v) => patch({ transmission: { ...ig.transmission, username: v } })}
          />
          <AccountField
            label="Password (optional)"
            value={ig.transmission?.password}
            secret
            onValue={(v) => patch({ transmission: { ...ig.transmission, password: v } })}
          />
        </AccountGroup>

        <AccountGroup title="Navidrome" blurb="Search your music and play anything" {...w("navidrome")} done={!!ig.navidrome?.url}>
          <AccountField
            label="Server address"
            value={ig.navidrome?.url}
            placeholder="https://navidrome.example.com"
            onValue={(v) => patch({ navidrome: { ...ig.navidrome, url: v } })}
          />
          <AccountField
            label="Username"
            value={ig.navidrome?.username}
            onValue={(v) => patch({ navidrome: { ...ig.navidrome, username: v } })}
          />
          <AccountField
            label="Password"
            value={ig.navidrome?.password}
            secret
            onValue={(v) => patch({ navidrome: { ...ig.navidrome, password: v } })}
          />
        </AccountGroup>

        <AccountGroup title="AniList" blurb="Days of anime watched and other stats" {...w("anilist")} done={!!ig.anilist.username}>
          <AccountField
            label="Username"
            value={ig.anilist.username}
            onValue={(v) => patch({ anilist: { username: v } })}
          />
        </AccountGroup>

        <AccountGroup title="WakaTime" blurb="Today's coding time. Wakapi and Hackatime work too" {...w("wakatime")} done={!!ig.wakatime.apiKey}>
          <AccountField
            label="API key"
            value={ig.wakatime.apiKey}
            secret
            onValue={(v) => patch({ wakatime: { ...ig.wakatime, apiKey: v } })}
          />
          <AccountField
            label="API address (optional, e.g. https://hackatime.hackclub.com/api/hackatime/v1)"
            value={ig.wakatime.apiUrl}
            placeholder="https://api.wakatime.com/api/v1"
            onValue={(v) => patch({ wakatime: { ...ig.wakatime, apiUrl: v } })}
          />
        </AccountGroup>
      </div>
    </>
  );
}
