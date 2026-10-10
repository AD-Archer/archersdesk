"use client";

// settings → macapad: the one place pads are edited. Pick a pad (small = the
// 4-slot square panel, big = the 8-slot dual row) and one of its pages, then
// tap a slot to set what it does. "arrange" picks a button up and drops it on
// any slot of any page — dropping on an empty slot leaves a gap where it was,
// which is how you space buttons out. "on this display" shows where the pads
// sit on the desk's own pages. Writes go through /api/macapad; the updated
// pads are pushed back up through onChange so the widget redraws right away.

import { useCallback, useEffect, useState } from "react";
import {
  MACAPAD_MAX_PAGES,
  MACAPAD_STEP_TYPES,
  MAX_ROWS,
  WIDGET_PAGE_COUNT,
  type IntegrationPayload,
  type LayoutRow,
  type MacapadAction,
  type MacapadApp,
  type MacapadButton,
  type MacapadCatalog,
  type MacapadPads,
  type MacapadSize,
  type MacapadStep,
  type SiteMeta,
  type ViewSettings,
} from "@/lib/types";
import EditablePopup from "./EditablePopup";
import { MI } from "./widgets/kit";

/** Where the widget asked the sheet to open (its size/page, and a slot to edit). */
export interface MacapadFocus {
  size: MacapadSize;
  page?: string;
  index?: number;
}

type StepType = MacapadStep["type"];

const STEP_INFO: Record<StepType, { label: string; placeholder?: string; hint?: string }> = {
  media: { label: "media key" },
  openApp: { label: "open app", placeholder: "Spotify — or a bundle id like com.spotify.client" },
  openURL: { label: "open website", placeholder: "https://example.com", hint: "opens in the mac's default browser" },
  keystroke: { label: "keyboard shortcut" },
  shortcut: { label: "run shortcut", placeholder: "name exactly as in the shortcuts app" },
  typeText: { label: "type text", placeholder: "text to type on the mac" },
  appleScript: { label: "applescript", placeholder: 'tell application "Finder" to activate' },
  wait: { label: "wait", hint: "milliseconds before the next step" },
  action: { label: "mac action", hint: "a built-in or custom action saved on your mac" },
};

const MEDIA_LABELS: Record<string, string> = {
  playPause: "play / pause",
  next: "next track",
  previous: "previous track",
  volumeUp: "volume up",
  volumeDown: "volume down",
  mute: "mute",
};

// the icon picker's set, roughly most-used first; every name must be in the
// font subset (tools/make-icon-font.mjs)
const ICONS = [
  "play_pause", "play_arrow", "pause", "stop", "skip_previous", "skip_next", "fast_rewind", "fast_forward",
  "replay", "shuffle", "repeat", "volume_up", "volume_down", "volume_off", "volume_mute", "headphones",
  "music_note", "library_music", "queue_music", "playlist_play", "album", "radio", "podcasts", "speaker",
  "graphic_eq", "equalizer", "mic", "mic_off", "mic_external_on", "keyboard_voice", "record_voice_over",
  "videocam", "videocam_off", "photo_camera", "photo", "image", "movie_filter", "tv", "cast",
  "screenshot_monitor", "screen_share", "stop_screen_share", "tab", "close", "add", "undo", "redo",
  "refresh", "sync", "open_in_new", "open_in_browser", "open_in_full", "close_fullscreen", "fullscreen",
  "fullscreen_exit", "minimize", "zoom_in", "zoom_out", "crop", "rotate_right", "language", "web",
  "web_asset", "link", "search", "apps", "grid_view", "dashboard", "widgets", "window", "dock", "menu",
  "more_horiz", "folder", "desktop_mac", "desktop_windows", "monitor", "computer", "laptop", "smartphone",
  "tablet", "watch", "mouse", "keyboard", "keyboard_command_key", "print", "headset_mic", "bluetooth",
  "usb", "wifi", "wifi_off", "lan", "router", "terminal", "code", "data_object", "api", "webhook",
  "bug_report", "dns", "storage", "database", "memory", "developer_board", "build", "construction",
  "handyman", "call_split", "merge", "content_copy", "content_paste", "content_cut", "select_all",
  "save_alt", "edit", "edit_note", "note", "sticky_note_2", "description", "article", "checklist",
  "task_alt", "list", "bookmark", "label", "flag", "push_pin", "bolt", "auto_awesome", "smart_toy",
  "rocket_launch", "psychology", "science", "calculate", "school", "palette", "format_paint", "brush",
  "draw", "architecture", "lock", "key", "fingerprint", "security", "shield", "visibility",
  "visibility_off", "power_settings_new", "power", "battery_full", "brightness_high", "brightness_low",
  "contrast", "dark_mode", "light_mode", "bedtime", "settings", "tune", "notifications",
  "notifications_off", "do_not_disturb_on", "timer", "alarm", "schedule", "hourglass_top",
  "hourglass_empty", "pending", "history", "update", "calendar_month", "event", "today", "mail", "inbox",
  "send", "share", "chat", "forum", "call", "group", "person", "account_circle", "face", "mood",
  "emoji_emotions", "celebration", "favorite", "star", "translate", "public", "cloud", "cloud_upload",
  "cloud_download", "upload", "download", "home", "cottage", "apartment", "garage", "door_front", "bed",
  "weekend", "chair", "kitchen", "light", "lightbulb", "floor_lamp", "thermostat", "ac_unit",
  "water_drop", "eco", "park", "pets", "sunny", "rainy", "thunderstorm", "work", "coffee", "local_cafe",
  "local_bar", "restaurant", "fastfood", "cake", "shopping_cart", "payments", "credit_card",
  "attach_money", "savings", "map", "place", "navigation", "directions_car", "directions_bike",
  "directions_walk", "flight", "train", "fitness_center", "sports_soccer", "sports_basketball", "pool",
  "spa", "self_improvement", "sports_esports", "casino", "extension", "toys", "login", "logout",
  "exit_to_app", "chevron_left", "chevron_right", "expand_more", "expand_less", "arrow_back",
  "arrow_forward", "arrow_upward", "arrow_downward",
];

// extra words an icon answers to in search, beyond its own name
const ICON_WORDS: Record<string, string> = {
  play_pause: "media music song", skip_next: "media music song track", skip_previous: "media music song track",
  play_arrow: "media music start", pause: "media music", stop: "media music", shuffle: "music random",
  repeat: "music loop", headphones: "music audio listen", album: "music record vinyl", radio: "music",
  playlist_play: "music", queue_music: "playlist", library_music: "playlist", speaker: "music audio sound",
  equalizer: "music audio", podcasts: "audio", fast_forward: "media music skip", fast_rewind: "media music back",
  volume_up: "sound audio louder", volume_down: "sound audio quieter", volume_off: "sound audio mute",
  graphic_eq: "audio sound wave", mic: "microphone record", photo_camera: "screenshot picture",
  screenshot_monitor: "capture screen", tab: "browser", language: "browser internet globe website",
  web: "browser website", public: "globe world internet", terminal: "shell console command",
  code: "developer programming", smart_toy: "robot ai bot", auto_awesome: "magic sparkle ai",
  bolt: "lightning fast flash quick", lock: "secure password", key: "password", lightbulb: "idea light lamp",
  dark_mode: "night moon", light_mode: "day sun", sunny: "weather day", rainy: "weather",
  thunderstorm: "weather storm", bedtime: "sleep night moon", coffee: "drink break cafe", work: "job office briefcase",
  sports_esports: "game controller gaming", casino: "dice game", favorite: "heart love like", star: "favourite rate",
  mood: "emoji smile happy face", emoji_emotions: "smile happy", celebration: "party confetti",
  mail: "email inbox message", chat: "message talk", forum: "chat message discord slack",
  folder: "files finder directory", desktop_mac: "computer imac screen", palette: "design colour color art",
  brush: "paint design art", draw: "pen pencil sketch", edit: "pen pencil write", calculate: "math calculator",
  directions_car: "drive", home: "house", payments: "money cash", attach_money: "dollar money",
  thermostat: "temperature heat", fitness_center: "gym workout", self_improvement: "meditate yoga zen",
};

function iconMatches(name: string, q: string) {
  const hay = `${name.replace(/_/g, " ")} ${ICON_WORDS[name] ?? ""}`;
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function defaultStep(type: StepType): MacapadStep {
  switch (type) {
    case "media": return { type, key: "playPause" };
    case "keystroke": return { type, keys: "" };
    case "typeText": return { type, text: "" };
    case "openURL": return { type, url: "" };
    case "openApp": return { type, app: "" };
    case "shortcut": return { type, name: "" };
    case "appleScript": return { type, source: "" };
    case "wait": return { type, ms: 500 };
    case "action": return { type, id: "" };
  }
}

/** The text a step is configured with ("" when unset); media/wait never are. */
function stepValue(st: MacapadStep): string | null {
  switch (st.type) {
    case "keystroke": return st.keys;
    case "typeText": return st.text;
    case "openURL": return st.url;
    case "openApp": return st.app;
    case "shortcut": return st.name;
    case "appleScript": return st.source;
    case "action": return st.id;
    default: return null;
  }
}

function withValue(st: MacapadStep, v: string): MacapadStep {
  switch (st.type) {
    case "keystroke": return { ...st, keys: v };
    case "typeText": return { ...st, text: v };
    case "openURL": return { ...st, url: v };
    case "openApp": return { ...st, app: v };
    case "shortcut": return { ...st, name: v };
    case "appleScript": return { ...st, source: v };
    case "action": return { ...st, id: v };
    default: return st;
  }
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `btn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function callMacapad(
  action: string,
  payload: unknown
): Promise<{ macapad?: MacapadPads; page?: string; error?: string }> {
  try {
    const res = await fetch("/api/macapad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    return await res.json().catch(() => ({ error: `error ${res.status}` }));
  } catch {
    return { error: "couldn't reach the desk" };
  }
}

const SIZE_INFO: Record<MacapadSize, { label: string; blurb: string }> = {
  small: { label: "small pad · 4", blurb: "square panel" },
  big: { label: "big pad · 8", blurb: "dual row" },
};

export function MacapadSection({
  settings,
  onChange,
  focus,
}: {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
  focus?: MacapadFocus | null;
}) {
  const pads = settings.macapad;
  const [size, setSize] = useState<MacapadSize>(focus?.size ?? "small");
  const [pageId, setPageId] = useState<string | null>(focus?.page ?? null);
  const [editing, setEditing] = useState<number | null>(focus?.index ?? null);
  // arrange mode: a picked-up button waits for a slot to drop onto
  const [arranging, setArranging] = useState(false);
  const [held, setHeld] = useState<{ page: string; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // the widget can reopen the sheet pointed at a different pad/page/slot
  useEffect(() => {
    if (!focus) return;
    setSize(focus.size);
    setPageId(focus.page ?? null);
    setEditing(focus.index ?? null);
  }, [focus]);

  const pages = pads[size];
  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  const pageIndex = pages.indexOf(page);

  async function write(action: string, payload: Record<string, unknown>) {
    setError(null);
    const res = await callMacapad(action, { size, ...payload });
    if (res.macapad) onChange({ ...settings, macapad: res.macapad });
    if (res.error) setError(res.error);
    return res;
  }

  function chooseSize(next: MacapadSize) {
    setSize(next);
    setPageId(null);
    setHeld(null);
  }

  async function addPage() {
    const res = await write("addPage", {});
    if (res.page) setPageId(res.page);
  }

  async function removePage() {
    const name = page.name || `page ${pageIndex + 1}`;
    if (!confirm(`delete "${name}" and its buttons?`)) return;
    await write("removePage", { page: page.id });
    setPageId(null);
  }

  async function tapSlot(index: number) {
    if (!arranging) return setEditing(index);
    if (!held) {
      if (page.buttons[index]) setHeld({ page: page.id, index });
      return;
    }
    if (held.page !== page.id || held.index !== index) {
      await write("move", { from: held, to: { page: page.id, index } });
    }
    setHeld(null);
  }

  const slots = page.buttons;
  const editingButton = editing !== null ? slots[editing] ?? null : null;

  return (
    <>
      <p className="sec-note">
        the <b>small pad</b> fills a square panel, the <b>big pad</b> a dual row. each has its own pages
        — swipe between them on the widget, or tap its dots.
      </p>

      <div className="page-seg">
        {(Object.keys(SIZE_INFO) as MacapadSize[]).map((s) => (
          <button key={s} className={s === size ? "on" : ""} onClick={() => chooseSize(s)}>
            {SIZE_INFO[s].label}
          </button>
        ))}
      </div>

      <div className="mps-pages">
        {pages.map((p, i) => (
          <button key={p.id} className={p.id === page.id ? "on" : ""} onClick={() => setPageId(p.id)}>
            {p.name || `page ${i + 1}`}
          </button>
        ))}
        {pages.length < MACAPAD_MAX_PAGES && (
          <button className="add" onClick={addPage}>
            <MI name="add" /> page
          </button>
        )}
      </div>

      <div className="mps-page-bar">
        <input
          key={page.id}
          defaultValue={page.name}
          maxLength={30}
          placeholder={`page ${pageIndex + 1}`}
          aria-label="page name"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name !== page.name) write("renamePage", { page: page.id, name });
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <button onClick={() => write("movePage", { page: page.id, by: -1 })} disabled={pageIndex === 0} aria-label="move page earlier">
          <MI name="arrow_back" />
        </button>
        <button
          onClick={() => write("movePage", { page: page.id, by: 1 })}
          disabled={pageIndex === pages.length - 1}
          aria-label="move page later"
        >
          <MI name="arrow_forward" />
        </button>
        <button onClick={removePage} disabled={pages.length === 1} aria-label="delete page">
          <MI name="delete" />
        </button>
      </div>

      <div className={`mps-grid ${size}${arranging ? " arranging" : ""}`}>
        {slots.map((b, i) => {
          const isHeld = held?.page === page.id && held.index === i;
          return (
            <button
              key={b?.id ?? `empty-${i}`}
              className={`mps-key${b ? "" : " empty"}${isHeld ? " held" : ""}`}
              onClick={() => tapSlot(i)}
              aria-label={b ? `${arranging ? "move" : "edit"} ${b.label || "button"}` : arranging ? "drop here" : "add a button"}
            >
              {b ? <KeyFace button={b} /> : <MI name={arranging && held ? "arrow_downward" : "add"} />}
              {b?.label && <span>{b.label}</span>}
            </button>
          );
        })}
      </div>

      <div className="mps-tools">
        <button
          className={`mps-arrange${arranging ? " on" : ""}`}
          onClick={() => {
            setArranging((a) => !a);
            setHeld(null);
          }}
          aria-pressed={arranging}
        >
          <MI name={arranging ? "check" : "grid_view"} /> {arranging ? "done arranging" : "arrange"}
        </button>
        <small>
          {arranging
            ? held
              ? "now tap where it goes — any page, any slot. an empty slot leaves a gap."
              : "tap a button to pick it up."
            : "tap a slot to set what it does."}
        </small>
      </div>
      {error && <p className="embed-error">{error}</p>}

      <MacActions />

      <DeskPlacements settings={settings} onChange={onChange} />

      {editing !== null && (
        <ButtonEditor
          key={`${size}-${page.id}-${editing}`}
          button={editingButton}
          onClose={() => setEditing(null)}
          onSave={async (button) => {
            const res = await write("set", { page: page.id, index: editing, button });
            if (res.macapad) setEditing(null);
          }}
          onClear={async () => {
            const res = await write("set", { page: page.id, index: editing, button: null });
            if (res.macapad) setEditing(null);
          }}
        />
      )}
    </>
  );
}

/** Where pads sit on this display's desk pages, with quick add/remove. Edits
 *  the layout itself (normal settings autosave), same as the layout tab. */
function DeskPlacements({ settings, onChange }: { settings: ViewSettings; onChange: (next: ViewSettings) => void }) {
  const pages = Array.from({ length: WIDGET_PAGE_COUNT }, (_, i) => settings.layout.pages[i] ?? []);
  type Spot = { p: number; r: number; side: "left" | "right" | null; label: string };
  const spots: Spot[] = pages.flatMap((rows, p) =>
    rows.flatMap((row, r): Spot[] => {
      if (row.type === "dual") return row.widget === "macapad" ? [{ p, r, side: null, label: "big pad" }] : [];
      return (["left", "right"] as const)
        .filter((side) => row[side] === "macapad")
        .map((side) => ({ p, r, side, label: `small pad (${side})` }));
    })
  );

  function setRows(p: number, rows: LayoutRow[]) {
    const next = pages.map((r, i) => (i === p ? rows : r));
    onChange({ ...settings, layout: { ...settings.layout, pages: next, rows: next[0] } });
  }

  function add(p: number, row: LayoutRow) {
    if (pages[p].length >= MAX_ROWS) return;
    setRows(p, [...pages[p], row]);
  }

  function remove(spot: Spot) {
    const rows = [...pages[spot.p]];
    const row = rows[spot.r];
    // a dual row goes away; a split keeps its other square (macapad → clock)
    if (row.type === "dual") rows.splice(spot.r, 1);
    else rows[spot.r] = { ...row, [spot.side!]: "clock" };
    setRows(spot.p, rows);
  }

  return (
    <div className="mps-desk">
      <div className="mpad-section">on this display ({settings.deviceName})</div>
      {spots.length === 0 ? (
        <p className="sec-note">no pads on the desk yet.</p>
      ) : (
        <div className="mps-spots">
          {spots.map((s) => (
            <div key={`${s.p}-${s.r}-${s.side}`} className="mps-spot">
              <span>
                page {s.p + 1} · row {s.r + 1} · {s.label}
              </span>
              <button onClick={() => remove(s)} aria-label="remove from desk">
                <MI name="close" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mps-add">
        {pages.map((rows, p) => (
          <div key={p} className="mps-add-row">
            <span>page {p + 1}</span>
            <button onClick={() => add(p, { type: "dual", widget: "macapad" })} disabled={rows.length >= MAX_ROWS}>
              <MI name="add" /> big pad
            </button>
            <button
              onClick={() => add(p, { type: "split", left: "macapad", right: "clock" })}
              disabled={rows.length >= MAX_ROWS}
            >
              <MI name="add" /> small pad
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dark artwork (flagged "-d" when stored) and remote logos — often drawn for
 *  light pages — sit on a light plate; app icons bring their own background. */
function needsPlate(image: string) {
  return /^https?:/.test(image) || /-d\.webp$/.test(image);
}

/** A button's face: its image (app icon / site logo) when it has one and it
 *  loads, otherwise its material icon. */
export function KeyFace({ button, className }: { button: Pick<MacapadButton, "icon" | "image">; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [button.image]);
  if (button.image && !broken)
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote logos, no next/image config
    return (
      <img
        src={button.image}
        alt=""
        className={`mpad-img${needsPlate(button.image) ? " site" : ""}${className ? ` ${className}` : ""}`}
        onError={() => setBroken(true)}
      />
    );
  return <MI name={button.icon} className={className} />;
}

// ── what the mac offers (actions, apps, shortcuts), cached for the session ──

let catalogCache: { at: number; data: MacapadCatalog } | null = null;

async function macapadAction<T>(action: string, payload?: unknown): Promise<{ data?: T; reason?: string }> {
  try {
    const res = await fetch("/api/integrations/macapad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const body = (await res.json().catch(() => ({}))) as IntegrationPayload<T>;
    return body.data !== undefined ? { data: body.data } : { reason: body.reason ?? `error ${res.status}` };
  } catch {
    return { reason: "couldn't reach the desk" };
  }
}

function useMacapadCatalog() {
  const [catalog, setCatalog] = useState<MacapadCatalog | null>(catalogCache?.data ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!force && catalogCache && Date.now() - catalogCache.at < 5 * 60 * 1000) {
      setCatalog(catalogCache.data);
      return;
    }
    const res = await macapadAction<MacapadCatalog>("catalog");
    if (res.data) {
      catalogCache = { at: Date.now(), data: res.data };
      setCatalog(res.data);
      setError(null);
    } else setError(res.reason ?? "couldn't load your mac's apps and actions");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { catalog, error, reload: () => load(true) };
}

const appIcon = (bundleId: string) => `/api/macapad/app-icon?bundleId=${encodeURIComponent(bundleId)}`;
const iconOrBolt = (name: string) => (ICONS.includes(name) ? name : "bolt");

const CATEGORY_ORDER = ["media", "system", "windows", "browser", "editing", "custom"];
function byCategory(actions: MacapadAction[]) {
  const groups = new Map<string, MacapadAction[]>();
  for (const a of actions) groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  return [...groups.entries()].sort(
    ([x], [y]) => (CATEGORY_ORDER.indexOf(x) + 1 || 99) - (CATEGORY_ORDER.indexOf(y) + 1 || 99)
  );
}

// ── button editor ────────────────────────────────────────────────────

type PickTab = "actions" | "apps" | "keys" | "shortcuts" | "website";

// steps the pickers can't make — a button using these opens in advanced mode
const ADVANCED_ONLY: StepType[] = ["typeText", "appleScript", "wait"];

function ButtonEditor({
  button,
  onClose,
  onSave,
  onClear,
}: {
  button: MacapadButton | null;
  onClose: () => void;
  onSave: (b: MacapadButton) => void;
  onClear: () => void;
}) {
  const { catalog, error: catalogError, reload } = useMacapadCatalog();
  const [label, setLabel] = useState(button?.label ?? "");
  const [icon, setIcon] = useState(button?.icon ?? "bolt");
  const [image, setImage] = useState(button?.image ?? "");
  const [steps, setSteps] = useState<MacapadStep[]>(button?.steps ?? []);
  const [tab, setTab] = useState<PickTab>(() => tabFor(button?.steps));
  const [advanced, setAdvanced] = useState(
    () => (button?.steps.length ?? 0) > 1 || Boolean(button?.steps.some((st) => ADVANCED_ONLY.includes(st.type)))
  );
  const [iconsOpen, setIconsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fill(next: { label: string; icon?: string; image?: string; steps: MacapadStep[] }) {
    setLabel(next.label);
    setIcon(next.icon ?? "bolt");
    setImage(next.image ?? "");
    setSteps(next.steps);
    setError(null);
  }

  function updateStep(i: number, st: MacapadStep) {
    setSteps((cur) => cur.map((x, j) => (j === i ? st : x)));
    setError(null);
  }

  function moveStep(i: number, d: number) {
    setSteps((cur) => {
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  }

  function save() {
    if (!steps.length) return setError("pick something for it to do");
    const cleaned = steps.map((st) =>
      // macapad needs a full url; assume https for bare hosts
      st.type === "openURL" && st.url.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(st.url.trim())
        ? { ...st, url: `https://${st.url.trim()}` }
        : st
    );
    // a shortcut needs a key, not just modifiers
    const blank = cleaned.findIndex((st) => stepValue(st)?.trim() === "" || (st.type === "keystroke" && !parseCombo(st.keys).key));
    if (blank >= 0) return setError(steps.length > 1 ? `step ${blank + 1} isn't finished` : "finish setting it up first");
    onSave({ id: button?.id ?? newId(), label: label.trim(), icon, ...(image ? { image } : {}), steps: cleaned });
  }

  const keysStep = steps.length === 1 && steps[0].type === "keystroke" ? steps[0] : null;

  return (
    <EditablePopup
      open
      title={button ? "edit button" : "new button"}
      onClose={onClose}
      footer={
        <>
          {button && (
            <button className="edit-pop-muted" onClick={onClear}>
              clear
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="edit-pop-primary" onClick={save}>
            save
          </button>
        </>
      }
    >
      <div className="mpe-head">
        <div className="mps-key">
          <KeyFace button={{ icon, image }} />
          {label && <span>{label}</span>}
        </div>
        <div className="mpe-head-fields">
          <label className="edit-field">
            <span>label</span>
            <input value={label} maxLength={40} placeholder="optional" onChange={(e) => setLabel(e.target.value)} />
          </label>
          <button className="mpe-disclose" onClick={() => setIconsOpen((o) => !o)} aria-expanded={iconsOpen}>
            <MI name={iconsOpen ? "arrow_upward" : "palette"} /> {iconsOpen ? "done" : "change icon or image"}
          </button>
        </div>
      </div>
      {iconsOpen && (
        <Appearance
          icon={icon}
          image={image}
          onIcon={(name) => {
            setIcon(name);
            setImage("");
          }}
          onImage={setImage}
        />
      )}

      <div className={`mpe-summary${steps.length ? "" : " empty"}`}>
        <MI name={steps.length ? "bolt" : "add"} />
        <span>{summarize(steps, catalog)}</span>
      </div>

      {steps.length > 1 ? (
        // a chain: the pickers would replace every step, so keep them out of reach
        <div className="mpe-chained">
          <span>this button chains steps — edit them under advanced.</span>
          <button
            className="mpe-link"
            onClick={() => {
              setSteps([]);
              setAdvanced(false);
            }}
          >
            start over
          </button>
        </div>
      ) : (
        <>
          <div className="mpe-tabs" role="tablist">
            {(["actions", "apps", "keys", "shortcuts", "website"] as PickTab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className={`mpe-pane${tab === "keys" ? " fit" : ""}`}>
            {tab === "website" ? (
              <WebsitePicker onPick={fill} />
            ) : tab === "keys" ? (
              <div className="mpe-keys-pane">
                <KeyCombo
                  value={keysStep?.keys ?? ""}
                  onChange={(keys) =>
                    fill({ label: keysStep || !label ? prettyCombo(keys) : label, icon: "keyboard", steps: [{ type: "keystroke", keys }] })
                  }
                />
                <small>tap any modifiers (⌃ ⌥ ⇧ ⌘ fn, together if you like), then tap the key — or press the real shortcut on a keyboard.</small>
              </div>
            ) : !catalog ? (
              <div className="mpe-empty">
                {catalogError ? (
                  <>
                    {catalogError}{" "}
                    <button className="mpe-link" onClick={reload}>
                      try again
                    </button>
                  </>
                ) : (
                  "asking your mac…"
                )}
              </div>
            ) : tab === "actions" ? (
              <ActionPicker
                actions={catalog.actions}
                onPick={(a) => fill({ label: a.name.toLowerCase(), icon: iconOrBolt(a.icon), steps: [{ type: "action", id: a.id }] })}
              />
            ) : tab === "apps" ? (
              <AppPicker
                apps={catalog.apps}
                onPick={(app) =>
                  fill({ label: app.name.toLowerCase(), icon: "apps", image: appIcon(app.bundleId), steps: [{ type: "openApp", app: app.bundleId }] })
                }
              />
            ) : (
              <ShortcutPicker
                shortcuts={catalog.shortcuts}
                onPick={(name) => fill({ label: name.toLowerCase(), icon: "bolt", steps: [{ type: "shortcut", name }] })}
              />
            )}
          </div>
        </>
      )}

      <button className="mpe-advanced-toggle" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
        <span>
          <b>advanced</b>
          <small>chain steps, type text, applescript, waits</small>
        </span>
        <MI name={advanced ? "arrow_upward" : "arrow_downward"} />
      </button>
      {advanced && (
        <div className="mpe-advanced">
          {steps.length > 0 && (
            <ol className="mpad-steps">
              {steps.map((st, i) => (
                <StepRow
                  key={i}
                  step={st}
                  number={i + 1}
                  actions={catalog?.actions}
                  canUp={i > 0}
                  canDown={i < steps.length - 1}
                  onChange={(next) => updateStep(i, next)}
                  onUp={() => moveStep(i, -1)}
                  onDown={() => moveStep(i, 1)}
                  onRemove={() => setSteps((cur) => cur.filter((_, j) => j !== i))}
                />
              ))}
            </ol>
          )}
          <button className="mpad-add-step" onClick={() => setSteps((cur) => [...cur, defaultStep(cur.length ? "wait" : "action")])}>
            <MI name="add" /> {steps.length ? "then do another thing" : "add a step"}
          </button>
        </div>
      )}

      {error && <p className="embed-error">{error}</p>}
    </EditablePopup>
  );
}

/** Open the picker tab that matches what a button already does. */
function tabFor(steps: MacapadStep[] | undefined): PickTab {
  const first = steps?.length === 1 ? steps[0] : null;
  if (first?.type === "openApp") return "apps";
  if (first?.type === "keystroke") return "keys";
  if (first?.type === "shortcut") return "shortcuts";
  if (first?.type === "openURL") return "website";
  return "actions";
}

/** One plain sentence for what a button does. */
function summarize(steps: MacapadStep[], catalog: MacapadCatalog | null): string {
  if (!steps.length) return "pick what it does below";
  const parts = steps.map((st) => describeStep(st, catalog));
  if (parts.length === 1) return parts[0];
  return `${parts.length} steps: ${parts.join(", then ")}`;
}

function describeStep(st: MacapadStep, catalog: MacapadCatalog | null): string {
  switch (st.type) {
    case "action": {
      const a = catalog?.actions.find((x) => x.id === st.id);
      return st.id ? `runs ${a ? a.name.toLowerCase() : st.id}` : "runs an action (not chosen yet)";
    }
    case "openApp": {
      const app = catalog?.apps.find((x) => x.bundleId === st.app || x.name.toLowerCase() === st.app.toLowerCase());
      return st.app ? `opens ${app?.name ?? st.app}` : "opens an app (not chosen yet)";
    }
    case "openURL": {
      try {
        return `opens ${new URL(/^[a-z][a-z0-9+.-]*:/i.test(st.url) ? st.url : `https://${st.url}`).hostname.replace(/^www\./, "")}`;
      } catch {
        return "opens a website (not set yet)";
      }
    }
    case "keystroke": return st.keys ? `presses ${prettyCombo(st.keys)}` : "presses a shortcut (not set yet)";
    case "shortcut": return st.name ? `runs the shortcut “${st.name}”` : "runs a shortcut (not chosen yet)";
    case "media": return MEDIA_LABELS[st.key] ?? st.key;
    case "typeText": return st.text ? `types “${st.text.length > 24 ? `${st.text.slice(0, 24)}…` : st.text}”` : "types text";
    case "appleScript": return "runs applescript";
    case "wait": return `waits ${st.ms} ms`;
  }
}

// ── keyboard shortcut builder ────────────────────────────────────────

const MODIFIERS = [
  { key: "ctrl", symbol: "⌃" },
  { key: "opt", symbol: "⌥" },
  { key: "shift", symbol: "⇧" },
  { key: "cmd", symbol: "⌘" },
] as const;

const KEY_SYMBOLS: Record<string, string> = {
  space: "Space", return: "↩", tab: "⇥", esc: "⎋", delete: "⌫", forwarddelete: "⌦",
  up: "↑", down: "↓", left: "←", right: "→", home: "↖", end: "↘", pageup: "⇞", pagedown: "⇟",
};

const MOD_ALIASES: Record<string, string> = { command: "cmd", option: "opt", alt: "opt", control: "ctrl" };

function parseCombo(combo: string): { mods: Set<string>; key: string } {
  const mods = new Set<string>();
  let key = "";
  for (const raw of combo.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean)) {
    const part = MOD_ALIASES[raw] ?? raw;
    if (["ctrl", "opt", "shift", "cmd", "fn"].includes(part)) mods.add(part);
    else key = part;
  }
  return { mods, key };
}

function buildCombo(mods: Set<string>, key: string): string {
  return [...MODIFIERS.map((m) => m.key).filter((m) => mods.has(m)), ...(mods.has("fn") ? ["fn"] : []), key]
    .filter(Boolean)
    .join("+");
}

function prettyCombo(combo: string): string {
  const { mods, key } = parseCombo(combo);
  const symbols = MODIFIERS.filter((m) => mods.has(m.key)).map((m) => m.symbol).join("");
  return `${mods.has("fn") ? "fn " : ""}${symbols}${KEY_SYMBOLS[key] ?? key.toUpperCase()}`;
}

// browser KeyboardEvent.key → macapad key names
const BROWSER_KEYS: Record<string, string> = {
  " ": "space", Enter: "return", Tab: "tab", Escape: "esc", Backspace: "delete", Delete: "forwarddelete",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown",
};

// the on-screen keyboard: every key macapad knows, tappable (no typing on a tablet)
const SPECIAL_KEYS = [
  "space", "return", "tab", "esc", "delete", "forwarddelete",
  "left", "up", "down", "right", "home", "end", "pageup", "pagedown",
];
const KEY_ROWS = [
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];
const F_KEYS = Array.from({ length: 12 }, (_, i) => `f${i + 1}`);
const KEY_CAPTIONS: Record<string, string> = { forwarddelete: "fwd del", pageup: "pg up", pagedown: "pg dn" };

function KeyCombo({ value, onChange }: { value: string; onChange: (combo: string) => void }) {
  const { mods, key } = parseCombo(value);
  const [showKeyboard, setShowKeyboard] = useState(false);

  function toggle(mod: string) {
    const next = new Set(mods);
    if (next.has(mod)) next.delete(mod);
    else next.add(mod);
    onChange(buildCombo(next, key));
  }

  const setKey = (k: string) => onChange(buildCombo(mods, k));

  // a physical keyboard: take the whole combo from one keypress
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Shift", "Meta", "Control", "Alt", "CapsLock", "Fn"].includes(e.key)) return;
    const name = BROWSER_KEYS[e.key] ?? (/^F\d{1,2}$/.test(e.key) ? e.key.toLowerCase() : e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : e.code.startsWith("Digit") ? e.code.slice(5) : e.key.length === 1 ? e.key.toLowerCase() : "");
    if (!name) return;
    // a bare letter typed on a soft keyboard falls through to onChange instead
    if (!e.metaKey && !e.ctrlKey && !e.altKey && name.length === 1 && !BROWSER_KEYS[e.key]) return;
    e.preventDefault();
    const next = new Set<string>();
    if (e.metaKey) next.add("cmd");
    if (e.shiftKey) next.add("shift");
    if (e.altKey) next.add("opt");
    if (e.ctrlKey) next.add("ctrl");
    onChange(buildCombo(next.size ? next : mods, name));
  }

  const keyButton = (k: string, wide = false) => (
    <button
      key={k}
      className={`${k === key ? "on" : ""}${wide ? " wide" : ""}`}
      onClick={() => setKey(k === key ? "" : k)}
      aria-pressed={k === key}
      aria-label={k}
    >
      {KEY_SYMBOLS[k] ? (
        <>
          <b>{KEY_SYMBOLS[k]}</b>
          {k.length > 2 && KEY_SYMBOLS[k].length <= 2 ? <small>{KEY_CAPTIONS[k] ?? k}</small> : null}
        </>
      ) : (
        k.toUpperCase()
      )}
    </button>
  );

  return (
    <div className="mpe-combo">
      <div className="mpe-mods">
        {MODIFIERS.map((m) => (
          <button key={m.key} className={mods.has(m.key) ? "on" : ""} onClick={() => toggle(m.key)} aria-pressed={mods.has(m.key)}>
            <b>{m.symbol}</b>
            {m.key}
          </button>
        ))}
        <button className={mods.has("fn") ? "on" : ""} onClick={() => toggle("fn")} aria-pressed={mods.has("fn")}>
          <b>🌐</b>fn
        </button>
      </div>

      <div className="mpe-keyrow">{SPECIAL_KEYS.map((k) => keyButton(k, k === "space"))}</div>

      {showKeyboard ? (
        <div className="mpe-keyboard">
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="mpe-keyrow tight">
              {row.map((k) => keyButton(k))}
            </div>
          ))}
          <div className="mpe-keyrow tight">{F_KEYS.map((k) => keyButton(k))}</div>
        </div>
      ) : (
        <div className="mpe-keyline">
          <input
            className="mpe-keyinput"
            value={key}
            maxLength={13}
            placeholder="key"
            aria-label="key"
            autoCapitalize="off"
            autoCorrect="off"
            onKeyDown={onKeyDown}
            onChange={(e) => {
              const typed = e.target.value;
              setKey(typed === " " ? "space" : typed.trim().toLowerCase());
            }}
          />
          <button className="mpe-link" onClick={() => setShowKeyboard(true)}>
            or tap it on a keyboard
          </button>
        </div>
      )}

      {value && (
        <div className="mpe-combo-show">
          {prettyCombo(value)} <small>{value}</small>
        </div>
      )}
    </div>
  );
}

interface SavedImage {
  url?: string;
  bytes?: number;
  originalBytes?: number;
  error?: string;
}

/** Store an image on the desk (compressed, see lib/images): a file or a link. */
async function saveImage(input: File | string): Promise<SavedImage> {
  let init: RequestInit;
  if (typeof input === "string") {
    init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: input }) };
  } else {
    const form = new FormData();
    form.append("file", input);
    init = { method: "POST", body: form };
  }
  try {
    const res = await fetch("/api/macapad/images", init);
    return await res.json().catch(() => ({ error: `error ${res.status}` }));
  } catch {
    return { error: "couldn't reach the desk" };
  }
}

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);

function Appearance({
  icon,
  image,
  onIcon,
  onImage,
}: {
  icon: string;
  image: string;
  onIcon: (name: string) => void;
  onImage: (url: string) => void;
}) {
  const [mode, setMode] = useState<"icon" | "image">(image ? "image" : "icon");
  return (
    <div className="mpe-appearance">
      <div className="mpe-tabs small" role="tablist">
        {(["icon", "image"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </div>
      {mode === "icon" ? <IconGrid value={image ? null : icon} onPick={onIcon} /> : <ImagePicker image={image} onImage={onImage} />}
    </div>
  );
}

function ImagePicker({ image, onImage }: { image: string; onImage: (url: string) => void }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function use(input: File | string) {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await saveImage(input);
    setBusy(false);
    if (!res.url) return setError(res.error ?? "couldn't use that image");
    onImage(res.url);
    if (res.originalBytes && res.bytes) setNote(`compressed ${kb(res.originalBytes)} → ${kb(res.bytes)}, transparency kept`);
  }

  return (
    <div className="mpe-site">
      <div className="mpe-site-row">
        <input
          className="mpe-search"
          value={link}
          placeholder="paste an image link"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && link.trim() && use(link.trim())}
        />
        <button className="edit-pop-primary" onClick={() => use(link.trim())} disabled={busy || !link.trim()}>
          use link
        </button>
      </div>
      <label className={`mpe-upload${busy ? " busy" : ""}`}>
        <MI name="upload" /> {busy ? "compressing…" : "upload an image"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) use(file);
          }}
        />
      </label>
      <small>png, jpg, webp, gif or svg. it&rsquo;s shrunk to 256px webp and kept on the desk.</small>
      {note && <small className="mpe-ok">{note}</small>}
      {image && (
        <button className="mpe-link" onClick={() => onImage("")}>
          remove the image
        </button>
      )}
      {error && <p className="embed-error">{error}</p>}
    </div>
  );
}

function IconGrid({ value, onPick }: { value: string | null; onPick: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? ICONS.filter((name) => iconMatches(name, q)) : ICONS;
  return (
    <div className="mpe-iconpick">
      <input
        className="mpe-search"
        value={query}
        placeholder={`search ${ICONS.length} icons — music, browser, robot…`}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <div className="mpad-icons">
        {shown.map((name) => (
          <button
            key={name}
            className={name === value ? "on" : ""}
            onClick={() => onPick(name)}
            aria-label={name.replace(/_/g, " ")}
            aria-pressed={name === value}
            title={name.replace(/_/g, " ")}
          >
            <MI name={name} />
          </button>
        ))}
      </div>
      {shown.length === 0 && <div className="mpe-empty">no icons match “{query}”</div>}
    </div>
  );
}

function ActionPicker({ actions, onPick }: { actions: MacapadAction[]; onPick: (a: MacapadAction) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? actions.filter((a) => `${a.name} ${a.id} ${a.category}`.toLowerCase().includes(q))
    : actions;
  return (
    <>
      <input
        className="mpe-search"
        value={query}
        placeholder={`search ${actions.length} actions`}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <div className="mpe-groups">
        {byCategory(shown).map(([category, list]) => (
          <div key={category}>
            <div className="mpe-group-name">{category}</div>
            <div className="mpad-picks">
              {list.map((a) => (
                <button key={a.id} onClick={() => onPick(a)}>
                  <MI name={iconOrBolt(a.icon)} />
                  {a.name.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="mpe-empty">no actions match</div>}
      </div>
    </>
  );
}

function AppPicker({ apps, onPick }: { apps: MacapadApp[]; onPick: (app: MacapadApp) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? apps.filter((a) => a.name.toLowerCase().includes(q) || a.bundleId.toLowerCase().includes(q)) : apps;
  return (
    <>
      <input
        className="mpe-search"
        value={query}
        placeholder={`search ${apps.length} apps`}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <div className="mpe-apps">
        {shown.map((app) => (
          <button key={app.bundleId} onClick={() => onPick(app)} title={app.bundleId}>
            <KeyFace button={{ icon: "apps", image: appIcon(app.bundleId) }} />
            <span>{app.name}</span>
          </button>
        ))}
        {shown.length === 0 && <div className="mpe-empty">no apps match</div>}
      </div>
    </>
  );
}

function ShortcutPicker({ shortcuts, onPick }: { shortcuts: string[]; onPick: (name: string) => void }) {
  const [query, setQuery] = useState("");
  if (!shortcuts.length) return <div className="mpe-empty">no shortcuts found in the shortcuts app.</div>;
  const q = query.trim().toLowerCase();
  const shown = q ? shortcuts.filter((name) => name.toLowerCase().includes(q)) : shortcuts;
  return (
    <>
      <input
        className="mpe-search"
        value={query}
        placeholder={`search ${shortcuts.length} shortcuts`}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <div className="mpad-picks">
        {shown.map((name) => (
          <button key={name} onClick={() => onPick(name)}>
            <MI name="bolt" />
            {name}
          </button>
        ))}
      </div>
      {shown.length === 0 && <div className="mpe-empty">no shortcuts match</div>}
    </>
  );
}

function WebsitePicker({ onPick }: { onPick: (b: { label: string; image?: string; icon?: string; steps: MacapadStep[] }) => void }) {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<SiteMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await macapadAction<SiteMeta>("siteMeta", { url });
    if (!res.data) {
      setBusy(false);
      return setError(res.reason ?? "couldn't read that site");
    }
    setMeta(res.data);
    await use(res.data, res.data.image);
    setBusy(false);
  }

  // logos are stored compressed on the desk; one the compressor can't read
  // (an .ico, say) is used straight from the site instead
  async function use(m: SiteMeta, logo: string) {
    let image = "";
    for (const candidate of [logo, ...m.images.filter((u) => u !== logo)]) {
      if (!candidate) continue;
      const saved = await saveImage(candidate);
      if (saved.url) {
        image = saved.url;
        break;
      }
      if (candidate === logo && !/\.ico(\?|$)/i.test(candidate)) break; // the one they picked failed for a real reason
    }
    onPick({ label: m.title.toLowerCase(), icon: "language", image: image || logo, steps: [{ type: "openURL", url: m.url }] });
  }

  return (
    <div className="mpe-site">
      <div className="mpe-site-row">
        <input
          className="mpe-search"
          value={url}
          placeholder="hackclub.com"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && find()}
        />
        <button className="edit-pop-primary" onClick={find} disabled={busy || !url.trim()}>
          {busy ? "looking…" : "use site"}
        </button>
      </div>
      <small>opens in the mac&rsquo;s default browser. the logo comes from the site itself.</small>
      {meta && meta.images.length > 1 && (
        <>
          <div className="mpe-group-name">other logos on {new URL(meta.url).hostname}</div>
          <div className="mpe-logos">
            {meta.images.slice(0, 8).map((src) => (
              <button key={src} onClick={() => use(meta, src)} aria-label="use this logo" disabled={busy}>
                <KeyFace button={{ icon: "language", image: src }} />
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="embed-error">{error}</p>}
    </div>
  );
}

function StepRow({
  step,
  number,
  actions,
  canUp,
  canDown,
  onChange,
  onUp,
  onDown,
  onRemove,
}: {
  step: MacapadStep;
  number: number;
  actions?: MacapadAction[];
  canUp: boolean;
  canDown: boolean;
  onChange: (st: MacapadStep) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const info = STEP_INFO[step.type];
  const value = stepValue(step);

  return (
    <li className="mpad-step">
      <div className="mpad-step-head">
        <b>{number}</b>
        <select value={step.type} onChange={(e) => onChange(defaultStep(e.target.value as StepType))} aria-label="step type">
          {MACAPAD_STEP_TYPES.map((t) => (
            <option key={t} value={t}>
              {STEP_INFO[t].label}
            </option>
          ))}
        </select>
        <button onClick={onUp} disabled={!canUp} aria-label="move step up">
          <MI name="arrow_upward" />
        </button>
        <button onClick={onDown} disabled={!canDown} aria-label="move step down">
          <MI name="arrow_downward" />
        </button>
        <button onClick={onRemove} aria-label="remove step">
          <MI name="close" />
        </button>
      </div>

      {step.type === "media" && (
        <select value={step.key} onChange={(e) => onChange({ ...step, key: e.target.value as typeof step.key })} aria-label="media key">
          {Object.entries(MEDIA_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      )}
      {step.type === "wait" && (
        <input
          type="number"
          min={0}
          max={60000}
          step={100}
          value={step.ms}
          onChange={(e) => onChange({ ...step, ms: Number(e.target.value) })}
          aria-label="milliseconds"
        />
      )}
      {step.type === "action" && actions && (
        <select value={step.id} onChange={(e) => onChange({ ...step, id: e.target.value })} aria-label="mac action">
          <option value="">choose an action…</option>
          {byCategory(actions).map(([category, list]) => (
            <optgroup key={category} label={category}>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name.toLowerCase()}
                </option>
              ))}
            </optgroup>
          ))}
          {step.id && !actions.some((a) => a.id === step.id) && <option value={step.id}>{step.id} (missing)</option>}
        </select>
      )}
      {step.type === "keystroke" && <KeyCombo value={step.keys} onChange={(keys) => onChange({ ...step, keys })} />}
      {step.type === "appleScript" && (
        <textarea
          value={step.source}
          placeholder={info.placeholder}
          onChange={(e) => onChange(withValue(step, e.target.value))}
          aria-label="applescript"
        />
      )}
      {value !== null && step.type !== "appleScript" && step.type !== "keystroke" && !(step.type === "action" && actions) && (
        <input
          value={value}
          placeholder={step.type === "action" ? "action id, e.g. reload" : info.placeholder}
          onChange={(e) => onChange(withValue(step, e.target.value))}
          inputMode={step.type === "openURL" ? "url" : undefined}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={info.label}
        />
      )}
      {info.hint && <small>{info.hint}</small>}
    </li>
  );
}

// ── your own actions, saved on the mac ───────────────────────────────

function MacActions() {
  const { catalog, error, reload } = useMacapadCatalog();
  const [editing, setEditing] = useState<MacapadAction | "new" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const mine = catalog?.actions.filter((a) => a.custom) ?? [];

  async function remove(a: MacapadAction) {
    if (!confirm(`delete "${a.name}" from your mac? buttons that run it will stop working.`)) return;
    const res = await macapadAction("deleteAction", { id: a.id });
    if (res.reason) setProblem(res.reason);
    reload();
  }

  return (
    <div className="mps-desk">
      <div className="mpad-section">your actions (saved on your mac)</div>
      <p className="sec-note">
        named sequences any button can run with the <b>mac action</b> step — and any other app using macapad
        can too.
      </p>
      {!catalog && <p className="sec-note">{error ?? "asking your mac…"}</p>}
      {mine.length > 0 && (
        <div className="mps-spots">
          {mine.map((a) => (
            <div key={a.id} className="mps-spot">
              <MI name={iconOrBolt(a.icon)} />
              <span>
                {a.name} <small>· {a.steps.length} step{a.steps.length === 1 ? "" : "s"}</small>
              </span>
              <button onClick={() => setEditing(a)} aria-label={`edit ${a.name}`}>
                <MI name="edit" />
              </button>
              <button onClick={() => remove(a)} aria-label={`delete ${a.name}`}>
                <MI name="delete" />
              </button>
            </div>
          ))}
        </div>
      )}
      {catalog && (
        <button className="mpad-add-step" onClick={() => setEditing("new")}>
          <MI name="add" /> new action
        </button>
      )}
      {problem && <p className="embed-error">{problem}</p>}
      {editing && catalog && (
        <ActionEditor
          action={editing === "new" ? null : editing}
          actions={catalog.actions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ActionEditor({
  action,
  actions,
  onClose,
  onSaved,
}: {
  action: MacapadAction | null;
  actions: MacapadAction[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(action?.name ?? "");
  const [icon, setIcon] = useState(action?.icon ?? "bolt");
  const [steps, setSteps] = useState<MacapadStep[]>(action?.steps ?? [defaultStep("keystroke")]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return setError("give it a name");
    if (!steps.length) return setError("add at least one step");
    const blank = steps.findIndex((st) => stepValue(st)?.trim() === "" || (st.type === "keystroke" && !parseCombo(st.keys).key));
    if (blank >= 0) return setError(`step ${blank + 1} isn't finished`);
    setSaving(true);
    const res = await macapadAction("saveAction", {
      action: { id: action?.id ?? "", name: name.trim(), icon, category: action?.category ?? "custom", steps },
    });
    setSaving(false);
    if (res.reason) return setError(res.reason);
    onSaved();
  }

  return (
    <EditablePopup
      open
      title={action ? "edit action" : "new action"}
      onClose={onClose}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button className="edit-pop-primary" onClick={save} disabled={saving}>
            {saving ? "saving…" : "save to mac"}
          </button>
        </>
      }
    >
      <label className="edit-field">
        <span>name</span>
        <input value={name} maxLength={40} placeholder="e.g. start focus" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="mpad-section">steps</div>
      <ol className="mpad-steps">
        {steps.map((st, i) => (
          <StepRow
            key={i}
            step={st}
            number={i + 1}
            actions={actions.filter((a) => a.id !== action?.id)}
            canUp={i > 0}
            canDown={i < steps.length - 1}
            onChange={(next) => setSteps((cur) => cur.map((x, j) => (j === i ? next : x)))}
            onUp={() => setSteps((cur) => { const n = [...cur]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
            onDown={() => setSteps((cur) => { const n = [...cur]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}
            onRemove={() => setSteps((cur) => cur.filter((_, j) => j !== i))}
          />
        ))}
      </ol>
      <button className="mpad-add-step" onClick={() => setSteps((cur) => [...cur, defaultStep("keystroke")])}>
        <MI name="add" /> add a step
      </button>
      <div className="mpad-section">icon</div>
      <IconGrid value={icon} onPick={setIcon} />
      {error && <p className="embed-error">{error}</p>}
    </EditablePopup>
  );
}
