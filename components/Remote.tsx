"use client";

import { useState } from "react";
import type { Alarm, Presence, Settings } from "@/lib/types";
import { VIBES } from "@/lib/types";
import { alarmsForDevice, dayChips, fmt12, nextAlarm } from "./alarmUtil";
import { pushPresence } from "./presence";
import { useNow } from "./hooks";
import { MI } from "./widgets/kit";

// The phone control screen. A browser acting as "remote" renders this instead
// of a dashboard: pick target devices, push away / vibe, and manage alarms.

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function toInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function statusLine(presence: Presence, now: Date): string {
  if (presence.awayUntil) {
    const until = new Date(presence.awayUntil);
    if (until.getTime() > now.getTime()) {
      const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(until);
      return presence.awayLocation ? `away until ${t} · ${presence.awayLocation}` : `away until ${t}`;
    }
  }
  return `vibe · ${presence.vibe}`;
}

export default function Remote({
  settings,
  username,
  onChoose,
  onBecomeDisplay,
  onSaveSettings,
  onLogout,
  onPushed,
}: {
  settings: Settings;
  username: string;
  onChoose: (id: string) => void; // switch this browser to be a device
  onBecomeDisplay: () => void;
  onSaveSettings: (next: Settings) => void;
  onLogout: () => void;
  onPushed?: (snap: { version: number; devices: Array<{ id: string; presence: Presence }> }) => void;
}) {
  const now = useNow(1000);
  const devices = settings.devices;
  const [selected, setSelected] = useState<string[]>(() => devices.map((d) => d.id));
  const [awayTime, setAwayTime] = useState(() => toInputValue(new Date(Date.now() + 60 * 60_000)));
  const [awayLoc, setAwayLoc] = useState("");
  const [menu, setMenu] = useState<null | "alarms" | "devices">(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function apply(patch: Partial<Presence>) {
    if (!selected.length) return;
    const snap = await pushPresence(selected, patch);
    if (snap) onPushed?.(snap);
  }

  function setAway() {
    const d = new Date(awayTime);
    if (Number.isNaN(d.getTime())) return;
    void apply({ awayUntil: d.toISOString(), awayLocation: awayLoc });
  }

  return (
    <main className="remote">
      <header className="remote-head">
        <div className="remote-head-id">
          <h1>Remote</h1>
          <small>signed in as {username}</small>
        </div>
        <div className="remote-head-actions">
          <button className="remote-text-action remote-display-switch" onClick={onBecomeDisplay} disabled={!devices.length}>
            be display
          </button>
          <button className="remote-text-action remote-logout" onClick={onLogout}>
            sign out
          </button>
        </div>
      </header>

      {!menu && (
        <nav className="remote-nav" aria-label="remote sections">
          <button className="on" aria-current="page" aria-label="control" title="control">
            <MI name="keyboard" />
            <span className="remote-nav-label">control</span>
          </button>
          <button onClick={() => setMenu("alarms")} aria-label="alarms" title="alarms">
            <MI name="alarm" />
            <span className="remote-nav-label">alarms</span>
          </button>
          <button onClick={() => setMenu("devices")} aria-label="devices" title="devices">
            <MI name="live_tv" />
            <span className="remote-nav-label">devices</span>
          </button>
        </nav>
      )}

      <section className="remote-card">
        <div className="remote-card-head">
          <span>devices</span>
          <div className="remote-selall">
            <button onClick={() => setSelected(devices.map((d) => d.id))}>all</button>
            <button onClick={() => setSelected([])}>none</button>
          </div>
        </div>
        <div className="remote-devices">
          {devices.map((d) => {
            const next = nextAlarm(alarmsForDevice(settings.alarms, d.id), now);
            const on = selected.includes(d.id);
            const away = !!d.presence.awayUntil && new Date(d.presence.awayUntil).getTime() > now.getTime();
            return (
              <button key={d.id} className={`remote-device${on ? " on" : ""}`} onClick={() => toggle(d.id)}>
                <span className="rd-check" aria-hidden>
                  {on ? "✓" : ""}
                </span>
                <span className="rd-body">
                  <b>
                    {d.name}
                    {away && <i className="rd-dot" aria-hidden />}
                  </b>
                  <small>{statusLine(d.presence, now)}</small>
                  {next && (
                    <small className="rd-alarm">
                      <MI name="alarm" className="rd-alarm-icon" />
                      {fmt12(next.alarm.time).time}
                      {fmt12(next.alarm.time).ampm} · {next.alarm.label}
                    </small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="remote-hint">
          {selected.length ? `acting on ${selected.length} device(s)` : "select a device to control it"}
        </p>
      </section>

      <section className="remote-card">
        <div className="remote-card-head">
          <span>vibe check</span>
        </div>
        <div className="remote-vibes">
          {VIBES.map((v) => (
            <button key={v} onClick={() => apply({ vibe: v })} disabled={!selected.length}>
              {v}
            </button>
          ))}
        </div>
      </section>

      <section className="remote-card">
        <div className="remote-card-head">
          <span>away</span>
        </div>
        <label className="remote-field">
          <span>until</span>
          <input type="datetime-local" value={awayTime} onChange={(e) => setAwayTime(e.target.value)} />
        </label>
        <label className="remote-field">
          <span>where you are</span>
          <input
            type="text"
            placeholder="e.g. coffee shop"
            maxLength={80}
            value={awayLoc}
            onChange={(e) => setAwayLoc(e.target.value)}
          />
        </label>
        <div className="remote-row-actions">
          <button className="remote-primary" onClick={setAway} disabled={!selected.length}>
            set away
          </button>
          <button onClick={() => apply({ awayUntil: null })} disabled={!selected.length}>
            clear away
          </button>
        </div>
      </section>

      {menu === "alarms" && (
        <AlarmsMenu settings={settings} onSaveSettings={onSaveSettings} onClose={() => setMenu(null)} />
      )}
      {menu === "devices" && (
        <DevicesMenu
          settings={settings}
          onChoose={onChoose}
          onSaveSettings={onSaveSettings}
          onClose={() => setMenu(null)}
        />
      )}
    </main>
  );
}

/* ── alarms menu ─────────────────────────────────────────────────────── */

function AlarmsMenu({
  settings,
  onSaveSettings,
  onClose,
}: {
  settings: Settings;
  onSaveSettings: (next: Settings) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const alarms = settings.alarms;

  function save(next: Alarm[]) {
    onSaveSettings({ ...settings, alarms: next });
  }
  function patch(i: number, p: Partial<Alarm>) {
    save(alarms.map((a, j) => (j === i ? { ...a, ...p } : a)));
  }
  function add() {
    const next: Alarm[] = [...alarms, { time: "07:00", label: "alarm", days: [], enabled: true, devices: [] }];
    save(next);
    setEditing(next.length - 1);
  }
  function remove(i: number) {
    save(alarms.filter((_, j) => j !== i));
    setEditing(null);
  }

  return (
    <div className="remote-sheet" role="dialog" aria-modal="true">
      <div className="remote-sheet-head">
        <b>alarms</b>
        <button onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="remote-sheet-body">
        {alarms.length === 0 && <p className="remote-hint">no alarms yet — they ring on the devices you pick.</p>}
        {alarms.map((a, i) => (
          <div key={i} className="ram-item">
            <div className="ram-row">
              <button className="ram-time" onClick={() => setEditing(editing === i ? null : i)} style={{ opacity: a.enabled ? 1 : 0.45 }}>
                {fmt12(a.time).time}
                <em> {fmt12(a.time).ampm}</em>
              </button>
              <button className="ram-info" onClick={() => setEditing(editing === i ? null : i)}>
                <b>{a.label}</b>
                <small>
                  {dayChips(a.days)} ·{" "}
                  {a.devices.length === 0
                    ? "every device"
                    : a.devices
                        .map((id) => settings.devices.find((d) => d.id === id)?.name ?? "?")
                        .join(", ")}
                </small>
              </button>
              <label className="switch">
                <input type="checkbox" checked={a.enabled} onChange={(e) => patch(i, { enabled: e.target.checked })} />
                <span className="knob" />
              </label>
            </div>
            {editing === i && (
              <div className="ram-editor">
                <input type="time" value={a.time} onChange={(e) => e.target.value && patch(i, { time: e.target.value })} />
                <input
                  className="ram-label"
                  value={a.label}
                  maxLength={40}
                  placeholder="label"
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
                <div className="ram-chips">
                  {DAY_ORDER.map((d) => (
                    <button
                      key={d}
                      className={`day-chip${a.days.includes(d) ? " on" : ""}`}
                      onClick={() =>
                        patch(i, { days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d] })
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <span className="ram-chips-label">rings on</span>
                <div className="ram-chips">
                  {settings.devices.map((d) => (
                    <button
                      key={d.id}
                      className={`day-chip${a.devices.includes(d.id) ? " on" : ""}`}
                      onClick={() =>
                        patch(i, {
                          devices: a.devices.includes(d.id)
                            ? a.devices.filter((x) => x !== d.id)
                            : [...a.devices, d.id],
                        })
                      }
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
                <button className="ram-del" onClick={() => remove(i)}>
                  delete alarm
                </button>
              </div>
            )}
          </div>
        ))}
        <button className="remote-add" onClick={add}>
          + add alarm
        </button>
      </div>
    </div>
  );
}

/* ── devices menu ────────────────────────────────────────────────────── */

function DevicesMenu({
  settings,
  onChoose,
  onSaveSettings,
  onClose,
}: {
  settings: Settings;
  onChoose: (id: string) => void;
  onSaveSettings: (next: Settings) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const devices = settings.devices;

  function rename(id: string, next: string) {
    onSaveSettings({ ...settings, devices: devices.map((d) => (d.id === id ? { ...d, name: next } : d)) });
  }
  function remove(id: string) {
    if (devices.length <= 1) return;
    onSaveSettings({ ...settings, devices: devices.filter((d) => d.id !== id) });
  }
  function add() {
    const n = name.trim();
    if (!n) return;
    const base = devices[0];
    onSaveSettings({
      ...settings,
      devices: [
        ...devices,
        {
          id: crypto.randomUUID(),
          name: n,
          theme: base.theme,
          location: { ...base.location },
          layout: { rows: [...base.layout.rows], pages: base.layout.pages.map((p) => [...p]) },
          standby: { ...base.standby },
          presence: { awayUntil: null, awayLocation: "", vibe: "joyful" },
        },
      ],
    });
    setName("");
  }

  return (
    <div className="remote-sheet" role="dialog" aria-modal="true">
      <div className="remote-sheet-head">
        <b>devices</b>
        <button onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="remote-sheet-body">
        {devices.map((d) => (
          <div key={d.id} className="dev-card">
            <input className="dev-name" value={d.name} maxLength={40} onChange={(e) => rename(d.id, e.target.value)} />
            <div className="dev-actions">
              <button onClick={() => onChoose(d.id)}>be this</button>
              <button className="del" onClick={() => remove(d.id)} disabled={devices.length <= 1}>
                delete
              </button>
            </div>
          </div>
        ))}
        <div className="dev-add">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="new device name" maxLength={40} />
          <button onClick={add} disabled={!name.trim()}>
            add
          </button>
        </div>
      </div>
    </div>
  );
}
