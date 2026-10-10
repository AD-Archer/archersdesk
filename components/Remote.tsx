"use client";

import { useState } from "react";
import type { Alarm, Device, Presence, Settings, Vibe } from "@/lib/types";
import { VIBES } from "@/lib/types";
import { alarmsForDevice, clock12, fmt12, nextAlarm } from "./alarmUtil";
import { pushPresence } from "./presence";
import { useNow } from "./hooks";
import { PageHead, RemotePad, RIcon, Sheet, type RIconName } from "./MacapadRemote";

// The phone control screen — the remote for the desk. A browser acting as
// "remote" renders this instead of a dashboard. It reads like iOS Home and
// Control Center: the desk's screens as accessory tiles, vibes as lit tiles,
// away as a yellow card, and a tab bar at the bottom for the other sections.

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

type Menu = null | "pad" | "alarms" | "devices";
type AwayChoice = "30" | "60" | "120" | "later" | "exact";

function toInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function timeText(d: Date) {
  const { time, ampm } = clock12(d);
  return `${time} ${ampm}`;
}

function awayNow(p: Presence, now: Date) {
  return !!p.awayUntil && new Date(p.awayUntil).getTime() > now.getTime();
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Until tonight" means 7 pm; late in the evening or after midnight it becomes "until morning" (9 am). */
function laterTarget(now: Date): { label: string; at: Date } {
  const tonight = new Date(now);
  tonight.setHours(19, 0, 0, 0);
  const lateNight = now.getHours() < 5;
  if (!lateNight && tonight.getTime() - now.getTime() >= 45 * 60_000) return { label: "Until tonight", at: tonight };
  const morning = new Date(now);
  morning.setDate(morning.getDate() + (lateNight ? 0 : 1));
  morning.setHours(9, 0, 0, 0);
  return { label: "Until morning", at: morning };
}

function awayTarget(choice: AwayChoice, exact: string, now: Date): Date | null {
  if (choice === "exact") {
    const d = new Date(exact);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (choice === "later") return laterTarget(now).at;
  return new Date(now.getTime() + Number(choice) * 60_000);
}

function stateText(p: Presence, now: Date): string {
  if (awayNow(p, now)) return `Away until ${timeText(new Date(p.awayUntil as string))}`;
  return cap(p.vibe);
}

/** "mon tue wed thu fri" → "Weekdays"; nothing picked → "Every day". */
function repeatText(days: string[]): string {
  if (!days.length || days.length === 7) return "Every day";
  const weekdays = DAY_ORDER.slice(0, 5);
  if (days.length === 5 && weekdays.every((d) => days.includes(d))) return "Weekdays";
  if (days.length === 2 && days.includes("sat") && days.includes("sun")) return "Weekends";
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_NAMES[d])
    .join(", ");
}

const VIBE_ICON: Record<Vibe, RIconName> = {
  joyful: "joyful",
  sad: "sad",
  stressed: "stressed",
  calm: "calm",
  busy: "busy",
  mysterious: "mysterious",
};

const TABS: Array<{ id: Menu | "accounts"; label: string; icon: RIconName }> = [
  { id: null, label: "Control", icon: "control" },
  { id: "pad", label: "Pad", icon: "pad" },
  { id: "alarms", label: "Alarms", icon: "alarm" },
  { id: "devices", label: "Devices", icon: "tv" },
  { id: "accounts", label: "Accounts", icon: "person" },
];

export default function Remote({
  settings,
  username,
  onChoose,
  onBecomeDisplay,
  onOpenAccounts,
  onSaveSettings,
  onLogout,
  onPushed,
}: {
  settings: Settings;
  username: string;
  onChoose: (id: string) => void; // switch this browser to be a device
  onBecomeDisplay: () => void;
  onOpenAccounts: () => void;
  onSaveSettings: (next: Settings) => void;
  onLogout: () => void;
  onPushed?: (snap: { version: number; devices: Array<{ id: string; presence: Presence }> }) => void;
}) {
  const now = useNow(1000);
  const devices = settings.devices;
  const [selected, setSelected] = useState<string[]>(() => devices.map((d) => d.id));
  const [awayTime, setAwayTime] = useState(() => toInputValue(new Date(Date.now() + 60 * 60_000)));
  const [awayChoice, setAwayChoice] = useState<AwayChoice>("60");
  const [awayLoc, setAwayLoc] = useState("");
  const [changingAway, setChangingAway] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);

  const targets = devices.filter((d) => selected.includes(d.id));
  // the Pad tab only shows once macapad is set up (settings → accounts)
  const padOn = Boolean(settings.integrations.macapad?.url && settings.integrations.macapad?.token);
  const allOn = devices.length > 0 && targets.length === devices.length;
  const vibes = new Set(targets.map((d) => d.presence.vibe));
  const currentVibe = vibes.size === 1 ? [...vibes][0] : null;
  const awayTargets = targets.filter((d) => awayNow(d.presence, now));
  const later = laterTarget(now);
  const backAt = awayTarget(awayChoice, awayTime, now);
  const showAwaySetter = awayTargets.length === 0 || changingAway;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function apply(patch: Partial<Presence>) {
    if (!selected.length) return;
    const snap = await pushPresence(selected, patch);
    if (snap) onPushed?.(snap);
  }

  function setAway() {
    const d = awayTarget(awayChoice, awayTime, new Date());
    if (!d) return;
    setChangingAway(false);
    void apply({ awayUntil: d.toISOString(), awayLocation: awayLoc });
  }

  const awayChoices: Array<[AwayChoice, string]> = [
    ["30", "30 min"],
    ["60", "1 hour"],
    ["120", "2 hours"],
    ["later", later.label],
    ["exact", "Pick a time"],
  ];

  return (
    <main className="remote">
      {menu === null && (
        <div className="rm-page" aria-label="Control">
          <PageHead
            title="Control"
            right={
              <button className="rm-navbtn" onClick={onBecomeDisplay} disabled={!devices.length}>
                <RIcon name="tv" />
                Show the desk here
              </button>
            }
          />

          {/* the desk's screens, as Home-app accessory tiles: lit = being controlled */}
          <section className="rm-sec">
            <div className="rm-sec-head">
              <h2>Screens</h2>
              {devices.length > 1 && (
                <button className="rm-navbtn small" onClick={() => setSelected(allOn ? [] : devices.map((d) => d.id))}>
                  {allOn ? "Clear" : "Select all"}
                </button>
              )}
            </div>
            <div className={`rm-tiles${devices.length === 1 ? " one" : ""}`}>
              {devices.map((d) => {
                const on = selected.includes(d.id);
                const away = awayNow(d.presence, now);
                const next = nextAlarm(alarmsForDevice(settings.alarms, d.id), now);
                return (
                  <button
                    key={d.id}
                    className={`rm-tile${on ? " on" : ""}${away ? " away" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggle(d.id)}
                  >
                    <span className="rm-tile-top">
                      <span className="rm-tile-icon">
                        <RIcon name={away ? "walk" : "tv"} />
                      </span>
                      {next && (
                        <span className="rm-tile-alarm">
                          <RIcon name="alarm" />
                          {fmt12(next.alarm.time).time} {fmt12(next.alarm.time).ampm}
                        </span>
                      )}
                    </span>
                    <span className="rm-tile-name">{d.name}</span>
                    <span className="rm-tile-state">{stateText(d.presence, now)}</span>
                  </button>
                );
              })}
            </div>
            <p className="rm-foot-note">
              {!selected.length
                ? "Tap a screen to control it."
                : allOn && devices.length > 1
                  ? "Changes go to every screen."
                  : `Changes go to ${targets.map((d) => d.name).join(", ")} only.`}
            </p>
          </section>

          {/* vibe: Control Center tiles, the current one lit in its own color */}
          <section className="rm-sec">
            <div className="rm-sec-head">
              <h2>Vibe</h2>
            </div>
            <div className="rm-vibes">
              {VIBES.map((v) => (
                <button
                  key={v}
                  className={`rm-vibe v-${v}${currentVibe === v ? " on" : ""}`}
                  aria-pressed={currentVibe === v}
                  onClick={() => apply({ vibe: v })}
                  disabled={!selected.length}
                >
                  <RIcon name={VIBE_ICON[v]} />
                  <span>{cap(v)}</span>
                </button>
              ))}
            </div>
          </section>

          {/* away: a yellow card while away, the quick choices otherwise */}
          <section className="rm-sec">
            <div className="rm-sec-head">
              <h2>Away</h2>
            </div>

            {!showAwaySetter ? (
              <div className="rm-away-lit">
                <div className="rm-away-top">
                  <span className="rm-away-icon">
                    <RIcon name="walk" />
                  </span>
                  <p className="rm-away-kicker">
                    {awayTargets.length === targets.length
                      ? "Away"
                      : `${awayTargets.length} of ${targets.length} away`}
                  </p>
                </div>
                <p className="rm-away-until">
                  Until {timeText(new Date(awayTargets[0].presence.awayUntil as string))}
                </p>
                {awayTargets[0].presence.awayLocation && (
                  <p className="rm-away-where">{awayTargets[0].presence.awayLocation}</p>
                )}
                <div className="rm-away-keys">
                  <button className="rm-away-change" onClick={() => setChangingAway(true)}>
                    Change
                  </button>
                  <button className="rm-away-back" onClick={() => apply({ awayUntil: null })}>
                    I&apos;m back
                  </button>
                </div>
              </div>
            ) : (
              <div className="rm-card">
                <p className="rm-card-q">How long will you be gone?</p>
                <div className="rm-pills">
                  {awayChoices.map(([id, label]) => (
                    <button
                      key={id}
                      className={`rm-pill yellow${awayChoice === id ? " on" : ""}`}
                      aria-pressed={awayChoice === id}
                      onClick={() => setAwayChoice(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {awayChoice === "exact" && (
                  <input
                    className="field rm-exact"
                    type="datetime-local"
                    aria-label="Back at"
                    value={awayTime}
                    onChange={(e) => setAwayTime(e.target.value)}
                  />
                )}
                <p className="rm-back-at">
                  <RIcon name="clock" />
                  {backAt ? `Back at ${timeText(backAt)}` : "Pick when you'll be back"}
                </p>
                <input
                  className="field rm-where"
                  type="text"
                  aria-label="Where will you be? (optional)"
                  placeholder="Where? (optional)"
                  maxLength={80}
                  value={awayLoc}
                  onChange={(e) => setAwayLoc(e.target.value)}
                />
                <div className="rm-card-keys">
                  {changingAway && (
                    <button className="btn" onClick={() => setChangingAway(false)}>
                      Cancel
                    </button>
                  )}
                  <button className="rm-set-away" onClick={setAway} disabled={!selected.length || !backAt}>
                    Set away
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rm-sec">
            <div className="group">
              <div className="group-row rm-signed">
                <span>Signed in as {username}</span>
                <button className="rm-navbtn small red" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {menu === "pad" && padOn && <RemotePad settings={settings} onClose={() => setMenu(null)} />}
      {menu === "alarms" && <AlarmsPage settings={settings} onSaveSettings={onSaveSettings} />}
      {menu === "devices" && <DevicesPage settings={settings} onChoose={onChoose} onSaveSettings={onSaveSettings} />}

      {/* the iOS tab bar */}
      <nav className="rm-tabbar" aria-label="Remote sections">
        {TABS.filter((t) => t.id !== "pad" || padOn).map((t) => {
          const on = t.id !== "accounts" && t.id === menu;
          return (
            <button
              key={t.label}
              className={`rm-tab${on ? " on" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={() => (t.id === "accounts" ? onOpenAccounts() : setMenu(t.id))}
            >
              <RIcon name={t.icon} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

/* ── alarms: the iOS Clock list ─────────────────────────────────────── */

function deviceNames(devices: Device[], ids: string[]) {
  return ids.map((id) => devices.find((d) => d.id === id)?.name ?? "?").join(", ");
}

function AlarmsPage({
  settings,
  onSaveSettings,
}: {
  settings: Settings;
  onSaveSettings: (next: Settings) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const alarms = settings.alarms;
  const open = editing !== null ? alarms[editing] : undefined;

  function save(next: Alarm[]) {
    onSaveSettings({ ...settings, alarms: next });
  }
  function patch(i: number, p: Partial<Alarm>) {
    save(alarms.map((a, j) => (j === i ? { ...a, ...p } : a)));
  }
  function add() {
    const next: Alarm[] = [...alarms, { time: "07:00", label: "alarm", days: [], enabled: true, devices: [] }];
    save(next);
    setEditMode(false);
    setEditing(next.length - 1);
  }
  function remove(i: number) {
    save(alarms.filter((_, j) => j !== i));
    setEditing(null);
    setConfirm(null);
  }

  return (
    <div className="rm-page" aria-label="Alarms">
      <PageHead
        title="Alarms"
        left={
          alarms.length > 0 && (
            <button
              className={`rm-navbtn${editMode ? " strong" : ""}`}
              onClick={() => {
                setEditMode((m) => !m);
                setConfirm(null);
              }}
            >
              {editMode ? "Done" : "Edit"}
            </button>
          )
        }
        right={
          <button className="rm-navbtn icon" onClick={add} aria-label="Add an alarm">
            <RIcon name="plus" />
          </button>
        }
      />

      {alarms.length === 0 ? (
        <div className="rm-empty">
          <p>No alarms</p>
          <span>Tap + to add one. It rings on the screens you pick.</span>
        </div>
      ) : (
        <ul className="ral-list">
          {alarms.map((a, i) => {
            const t = fmt12(a.time);
            const meta = [a.label || "alarm", repeatText(a.days)];
            if (a.devices.length) meta.push(deviceNames(settings.devices, a.devices));
            return (
              <li key={i} className={`ral${a.enabled ? "" : " off"}${editMode ? " editing" : ""}`}>
                {editMode && (
                  <button
                    className="rm-minus"
                    aria-label={`Delete ${a.label || "alarm"}`}
                    onClick={() => setConfirm(confirm === i ? null : i)}
                  >
                    <i aria-hidden />
                  </button>
                )}
                <button className="ral-main" onClick={() => setEditing(i)}>
                  <span className="ral-time">
                    {t.time}
                    <small>{t.ampm}</small>
                  </span>
                  <span className="ral-meta">{meta.join(" · ")}</span>
                </button>
                {editMode ? (
                  confirm === i ? (
                    <button className="rm-delete" onClick={() => remove(i)}>
                      Delete
                    </button>
                  ) : (
                    <RIcon name="chevron" className="ral-chev" />
                  )
                ) : (
                  <label className="ios-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={a.enabled}
                      aria-label={`${a.label || "alarm"} at ${t.time} ${t.ampm}`}
                      onChange={() => patch(i, { enabled: !a.enabled })}
                    />
                    <span />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && editing !== null && (
        <Sheet title="Edit alarm" onDone={() => setEditing(null)}>
          <input
            className="ral-time-field"
            type="time"
            aria-label="Time"
            value={open.time}
            onChange={(e) => e.target.value && patch(editing, { time: e.target.value })}
          />

          <div className="group">
            <label className="group-row rm-field-row">
              <span>Name</span>
              <input
                value={open.label}
                maxLength={40}
                placeholder="alarm"
                onChange={(e) => patch(editing, { label: e.target.value })}
              />
            </label>
          </div>

          <p className="group-head">Repeat</p>
          <div className="ral-days">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                className={`rm-day${open.days.includes(d) ? " on" : ""}`}
                aria-pressed={open.days.includes(d)}
                aria-label={DAY_NAMES[d]}
                onClick={() =>
                  patch(editing, {
                    days: open.days.includes(d) ? open.days.filter((x) => x !== d) : [...open.days, d],
                  })
                }
              >
                {DAY_NAMES[d].slice(0, 2)}
              </button>
            ))}
          </div>
          <p className="group-foot">{repeatText(open.days)}</p>

          <p className="group-head">Rings on</p>
          <div className="rm-pills">
            {settings.devices.map((d) => (
              <button
                key={d.id}
                className={`rm-pill${open.devices.includes(d.id) ? " on" : ""}`}
                aria-pressed={open.devices.includes(d.id)}
                onClick={() =>
                  patch(editing, {
                    devices: open.devices.includes(d.id)
                      ? open.devices.filter((x) => x !== d.id)
                      : [...open.devices, d.id],
                  })
                }
              >
                {d.name}
              </button>
            ))}
          </div>
          <p className="group-foot">
            {open.devices.length ? "Only the screens you picked." : "Every screen, until you pick some."}
          </p>

          <div className="group rm-danger">
            <button className="group-row" onClick={() => remove(editing)}>
              Delete alarm
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ── devices: a grouped list ────────────────────────────────────────── */

function DevicesPage({
  settings,
  onChoose,
  onSaveSettings,
}: {
  settings: Settings;
  onChoose: (id: string) => void;
  onSaveSettings: (next: Settings) => void;
}) {
  const [name, setName] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const devices = settings.devices;
  const canRemove = devices.length > 1;

  function rename(id: string, next: string) {
    onSaveSettings({ ...settings, devices: devices.map((d) => (d.id === id ? { ...d, name: next } : d)) });
  }
  function remove(id: string) {
    if (devices.length <= 1) return;
    onSaveSettings({ ...settings, devices: devices.filter((d) => d.id !== id) });
    setConfirm(null);
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
          location: { ...base.location },
          layout: { rows: [...base.layout.rows], pages: base.layout.pages.map((p) => [...p]) },
          standby: { ...base.standby },
          night: { enabled: base?.night?.enabled ?? true, pausedAt: null },
          presence: { awayUntil: null, awayLocation: "", vibe: "joyful" },
        },
      ],
    });
    setName("");
  }

  return (
    <div className="rm-page" aria-label="Devices">
      <PageHead
        title="Devices"
        left={
          canRemove && (
            <button
              className={`rm-navbtn${editMode ? " strong" : ""}`}
              onClick={() => {
                setEditMode((m) => !m);
                setConfirm(null);
              }}
            >
              {editMode ? "Done" : "Edit"}
            </button>
          )
        }
      />

      <p className="group-head">Screens showing the desk</p>
      <div className="group">
        {devices.map((d) => (
          <div key={d.id} className="group-row rdev">
            {editMode && canRemove && (
              <button
                className="rm-minus"
                aria-label={`Remove ${d.name}`}
                onClick={() => setConfirm(confirm === d.id ? null : d.id)}
              >
                <i aria-hidden />
              </button>
            )}
            <span className="rdev-icon">
              <RIcon name="tv" />
            </span>
            <input
              className="rdev-name"
              aria-label="Device name"
              value={d.name}
              maxLength={40}
              onChange={(e) => rename(d.id, e.target.value)}
            />
            {editMode && confirm === d.id ? (
              <button className="rm-delete" onClick={() => remove(d.id)}>
                Remove
              </button>
            ) : (
              !editMode && (
                <button className="rm-navbtn small" onClick={() => onChoose(d.id)}>
                  Show here
                </button>
              )
            )}
          </div>
        ))}
      </div>
      <p className="group-foot">Tap a name to change it. &ldquo;Show here&rdquo; turns this phone into that screen.</p>

      <p className="group-head">Add a screen</p>
      <form
        className="group"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="group-row rdev-add">
          <input
            aria-label="New screen name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, like kitchen"
            maxLength={40}
          />
          <button type="submit" className="rm-navbtn strong small" disabled={!name.trim()}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
