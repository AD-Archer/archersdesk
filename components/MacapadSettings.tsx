"use client";

// settings → macapad: the one place pads are edited. Pick a pad (page = a
// screen's own pad page, each screen and the phone remote with its own grid
// and keys; small = the 4-slot square panel; big = the 8-slot dual row) and
// one of its pages, then tap a slot to set what it does. A template adds a
// ready-made page (volume, developer, browser…). "arrange" picks a button up and drops it on
// any slot of any page — dropping on an empty slot leaves a gap where it was,
// which is how you space buttons out. "on this display" shows where the pads
// sit on the desk's own pages. Writes go through /api/macapad; the updated
// pads are pushed back up through onChange so the widget redraws right away.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MACAPAD_GRID,
  MACAPAD_MAX_PAGES,
  MACAPAD_REMOTE,
  MACAPAD_STEP_TYPES,
  type IntegrationPayload,
  type MacapadAction,
  type MacapadApp,
  type MacapadButton,
  type MacapadCatalog,
  type MacapadPadId,
  type MacapadPage,
  type MacapadPads,
  type MacapadSize,
  type MacapadStep,
  type SiteMeta,
  type ViewSettings,
} from "@/lib/types";
import { gridLabel, padOf, padScreens, screenKey, screenPad } from "@/lib/macapad";
import { MACAPAD_TEMPLATES, type MacapadTemplate } from "@/lib/macapadTemplates";
import EditablePopup from "./EditablePopup";
import { MI } from "./widgets/kit";

/** Where the widget asked the sheet to open (its pad/page, and a slot to edit). */
export interface MacapadFocus {
  pad: MacapadPadId;
  page?: string;
  index?: number;
}

type StepType = MacapadStep["type"];

const STEP_INFO: Record<StepType, { label: string; placeholder?: string; hint?: string }> = {
  media: { label: "Play, skip or change volume" },
  openApp: { label: "Open an app", placeholder: "The app's name, like Spotify" },
  openURL: { label: "Open a website", placeholder: "example.com", hint: "Opens in your Mac's default browser." },
  keystroke: { label: "Press a keyboard shortcut" },
  shortcut: { label: "Run a shortcut", placeholder: "Its name, exactly as in the Shortcuts app" },
  typeText: { label: "Type some text", placeholder: "What to type on your Mac" },
  appleScript: { label: "Run AppleScript", placeholder: 'tell application "Finder" to activate' },
  wait: { label: "Wait a moment", hint: "Seconds to wait before the next step." },
  action: { label: "Do a Mac action", hint: "One of your Mac's actions, built in or your own." },
};

const MEDIA_LABELS: Record<string, string> = {
  playPause: "play or pause",
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

/** Messages from the server start lowercase; on a screen they read as sentences. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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

type PadKind = "page" | MacapadSize;

/** How a pad is named and described everywhere in the editor, so "which pad,
 *  on which screen" is never a guess. */
function describePad(
  pad: MacapadPadId,
  pads: MacapadPads,
  screens: Array<{ key: string; name: string }>
): { icon: string; color: string; title: string; detail: string } {
  if (pad === "big")
    return { icon: "web_asset", color: "orange", title: "Big pad widget", detail: "8 keys, fills a row of a screen's layout. Same keys on every screen." };
  if (pad === "small")
    return { icon: "grid_view", color: "teal", title: "Small pad widget", detail: "4 keys, half a row of a screen's layout. Same keys on every screen." };
  const key = screenKey(pad);
  const found = padOf(pads, pad);
  const grid = found ? gridLabel(found.cols, found.rows) : "";
  if (key === MACAPAD_REMOTE)
    return { icon: "smartphone", color: "green", title: "Phone remote's pad", detail: `${grid} · the Pad tab on your phone` };
  const name = screens.find((sc) => sc.key === key)?.name ?? "this screen";
  return { icon: "desktop_mac", color: "blue", title: `${name}'s pad page`, detail: `${grid} · the last page on ${name}` };
}

export function MacapadSection({
  settings,
  onChange,
  focus,
  screen,
}: {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
  focus?: MacapadFocus | null;
  /** the screen this sheet is open on: a device id, or "remote" */
  screen: string;
}) {
  const pads = settings.macapad;
  const [padChoice, setPad] = useState<MacapadPadId>(focus?.pad ?? screenPad(screen));
  const [pageId, setPageId] = useState<string | null>(focus?.page ?? null);
  const [editing, setEditing] = useState<number | null>(focus?.index ?? null);
  const [picking, setPicking] = useState<"pad" | "page" | null>(null);
  // arrange mode: a picked-up button waits for a slot to drop onto
  const [arranging, setArranging] = useState(false);
  const [held, setHeld] = useState<{ page: string; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // the widget can reopen the sheet pointed at a different pad/page/slot
  useEffect(() => {
    if (!focus) return;
    setPad(focus.pad);
    setPageId(focus.page ?? null);
    setEditing(focus.index ?? null);
  }, [focus]);

  // a screen deleted elsewhere takes its pad with it: fall back to this one
  const pad: MacapadPadId = padOf(pads, padChoice) ? padChoice : screenPad(screen);
  const found = padOf(pads, pad) ?? padOf(pads, "small")!;
  const kind: PadKind = pad === "small" || pad === "big" ? pad : "page";
  const screens = padScreens(settings.devices);
  const about = describePad(pad, pads, screens);
  const padScreenName = screens.find((sc) => sc.key === screenKey(pad))?.name ?? "this screen";
  const { cols, rows } = found;
  const pages = found.pages;
  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  const pageIndex = pages.indexOf(page);
  const pageName = (p: { name: string }, i: number) => p.name || `page ${i + 1}`;

  async function write(action: string, payload: Record<string, unknown>) {
    setError(null);
    const res = await callMacapad(action, { pad, ...payload });
    if (res.macapad) onChange({ ...settings, macapad: res.macapad });
    if (res.error) setError(res.error);
    return res;
  }

  function choosePad(next: MacapadPadId) {
    setPad(next);
    setPageId(null);
    setHeld(null);
    setArranging(false);
    setPicking(null);
  }

  async function setGrid(nextCols: number, nextRows: number) {
    setHeld(null);
    setEditing(null);
    await write("setGrid", { cols: nextCols, rows: nextRows });
  }

  async function addPage(template?: MacapadTemplate) {
    setPicking(null);
    const res = await write("addPage", template ? { template: template.id } : {});
    if (res.page) {
      setPageId(res.page);
      setArranging(false);
      setHeld(null);
    }
  }

  async function applyTemplate(t: MacapadTemplate) {
    const keys = page.buttons.filter(Boolean).length;
    if (keys && !confirm(`replace the ${keys} key${keys === 1 ? "" : "s"} on "${pageName(page, pageIndex)}" with ${t.name}?`)) return;
    setArranging(false);
    setHeld(null);
    await write("applyTemplate", { page: page.id, template: t.id });
  }

  async function removePage(id: string) {
    const i = pages.findIndex((p) => p.id === id);
    if (i < 0 || !confirm(`delete "${pageName(pages[i], i)}" and its keys?`)) return;
    await write("removePage", { page: id });
    if (id === page.id) setPageId(null);
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
    <div className="mps">
      {/* the pad itself: a live preview you tap to edit. Beside the lists on
          short landscape screens (Echo Show), above them on phones. */}
      <div className="mps-pad">
        {/* which pad, for which screen: always spelled out, one tap to change */}
        <button className="mps-which" onClick={() => setPicking("pad")} aria-label={`Editing ${about.title}. Change pad`}>
          <span className={`mps-ico ${about.color}`}>
            <MI name={about.icon} />
          </span>
          <span className="mps-row-text">
            <small>Editing</small>
            {about.title}
          </span>
          <span className="mps-pill">Change</span>
        </button>
        <p className="mps-sub">
          {about.detail}
          {pages.length > 1 ? ` · showing “${pageName(page, pageIndex)}”` : ""}
        </p>

        <div
          className={`mps-grid ${kind}${arranging ? " arranging" : ""}`}
          style={kind === "page" ? ({ "--cols": cols } as React.CSSProperties) : undefined}
        >
          {slots.map((b, i) => {
            const isHeld = held?.page === page.id && held.index === i;
            return (
              <button
                key={b?.id ?? `empty-${i}`}
                className={`mps-key${b ? "" : " empty"}${isHeld ? " held" : ""}`}
                onClick={() => tapSlot(i)}
                aria-label={b ? `${arranging ? "Move" : "Edit"} ${b.label || "key"}` : arranging ? "Drop here" : "Add a key"}
              >
                {b ? (
                  <KeyTile button={b} />
                ) : (
                  <span className="mtile socket">
                    <MI name={arranging && held ? "arrow_downward" : "add"} />
                  </span>
                )}
                <span className="mps-key-label">{b?.label ?? ""}</span>
              </button>
            );
          })}
        </div>

        <div className="mps-tools">
          <p>
            {arranging
              ? held
                ? "Now tap where it goes, on any page. An empty spot leaves a gap."
                : "Tap a key to pick it up."
              : "Tap a key to choose what it does."}
          </p>
          <button
            className={`btn mps-arrange${arranging ? " on" : ""}`}
            onClick={() => {
              setArranging((a) => !a);
              setHeld(null);
            }}
            aria-pressed={arranging}
          >
            {arranging ? "Done" : "Move keys"}
          </button>
        </div>
        {error && <p className="mps-error">{error}</p>}
      </div>

      <div className="mps-lists">
        {kind === "page" && (
          <>
            <h3 className="group-head">Size</h3>
            <div className="group">
              <GridStepper
                label="Columns"
                value={cols}
                min={MACAPAD_GRID.minCols}
                max={MACAPAD_GRID.maxCols}
                onChange={(v) => setGrid(v, rows)}
              />
              <GridStepper
                label="Rows"
                value={rows}
                min={MACAPAD_GRID.minRows}
                max={MACAPAD_GRID.maxRows}
                onChange={(v) => setGrid(cols, v)}
              />
            </div>
            <p className="group-foot">
              {screenKey(pad) === MACAPAD_REMOTE
                ? "Only your phone remote uses this size and these keys."
                : `Only ${padScreenName} uses this size and these keys; it's always ${padScreenName}'s last page.`}{" "}
              Keys stay put when the size changes; any that no longer fit move to empty slots, then onto a new page.
            </p>
          </>
        )}

        <PageList
          pages={pages}
          current={page.id}
          onSelect={setPageId}
          onRename={(id, name) => write("renamePage", { page: id, name })}
          onMove={(id, to) => write("movePage", { page: id, to })}
          onDelete={removePage}
          onAdd={() => setPicking("page")}
        />

        <h3 className="group-head">Start from a ready-made page</h3>
        <div className="preset-grid">
          {MACAPAD_TEMPLATES.map((t) => (
            <button key={t.id} className="preset" onClick={() => applyTemplate(t)}>
              <b>{t.name}</b>
              <small>{t.blurb}</small>
            </button>
          ))}
        </div>
        <p className="group-foot">
          Tapping one replaces the keys on &ldquo;{pageName(page, pageIndex)}&rdquo;
          {kind === "page" ? `, fitted to its ${gridLabel(cols, rows)} grid` : ""}. Add a page first to keep these.
        </p>

        <MacActions />
      </div>

      {picking === "pad" && (
        <PadPicker
          current={pad}
          screen={screen}
          pads={pads}
          screens={screens}
          onPick={choosePad}
          onClose={() => setPicking(null)}
        />
      )}

      {picking === "page" && (
        <EditablePopup open title="Add a page" onClose={() => setPicking(null)} className="mps-pick-pop">
          <p className="mps-pick-note">
            Adds a page to <b>{about.title.toLowerCase()}</b>. Change any key after.
          </p>
          <div className="group">
            <button className="group-row bed-item" onClick={() => addPage()}>
              <span className="mps-ico gray">
                <MI name="add" />
              </span>
              <span className="mps-row-text">
                Blank page
                <small>Empty slots to fill yourself</small>
              </span>
            </button>
          </div>
          <h4 className="group-head">From a template</h4>
          <div className="group">
            {MACAPAD_TEMPLATES.map((t) => (
              <button key={t.id} className="group-row bed-item" onClick={() => addPage(t)}>
                <span className={`mps-ico ${t.color}`}>
                  <MI name={t.icon} />
                </span>
                <span className="mps-row-text">
                  {t.name}
                  <small>{t.blurb}</small>
                </span>
              </button>
            ))}
          </div>
        </EditablePopup>
      )}

      {editing !== null && (
        <ButtonEditor
          key={`${pad}-${page.id}-${editing}`}
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
    </div>
  );
}

/** Which pad to edit: each screen's own pad page (this screen first), the
 *  phone remote's, then the two widget pads every screen shares. */
function PadPicker({
  current,
  screen,
  pads,
  screens,
  onPick,
  onClose,
}: {
  current: MacapadPadId;
  screen: string;
  pads: MacapadPads;
  screens: Array<{ key: string; name: string }>;
  onPick: (pad: MacapadPadId) => void;
  onClose: () => void;
}) {
  const ordered = [...screens].sort((a, b) => Number(b.key === screen) - Number(a.key === screen));
  const row = (id: MacapadPadId, tag?: string) => {
    const d = describePad(id, pads, screens);
    return (
      <button key={id} className="group-row bed-item" onClick={() => onPick(id)} aria-pressed={id === current}>
        <span className={`mps-ico ${d.color}`}>
          <MI name={d.icon} />
        </span>
        <span className="mps-row-text">
          <span>
            {d.title}
            {tag && <em className="mps-tag">{tag}</em>}
          </span>
          <small>{d.detail}</small>
        </span>
        {id === current && <MI name="check" className="mps-check" />}
      </button>
    );
  };
  return (
    <EditablePopup open title="Which pad?" onClose={onClose} className="mps-pick-pop">
      <h4 className="group-head">Each screen's own pad</h4>
      <div className="group">
        {ordered.map((sc) => row(screenPad(sc.key), sc.key === screen ? (sc.key === MACAPAD_REMOTE ? "this phone" : "this screen") : undefined))}
      </div>
      <p className="group-foot">Its own keys and size. On a screen it's the last page; on the remote it's the Pad tab.</p>
      <h4 className="group-head">Pad widgets</h4>
      <div className="group">
        {row("big")}
        {row("small")}
      </div>
      <p className="group-foot">Put in a screen's layout like any widget. Every screen showing one shows the same keys.</p>
    </EditablePopup>
  );
}

/** A pad's pages: tap one to show it. "Edit" (on a row when you hover it,
 *  always there on touch screens) turns the list into the page editor — each
 *  row gets a grip to drag it up or down, its position (type a number), its
 *  name, and delete; "Done" at the bottom ends it. */
function PageList({
  pages,
  current,
  onSelect,
  onRename,
  onMove,
  onDelete,
  onAdd,
}: {
  pages: MacapadPage[];
  current: string;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, to: number) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // the row whose Edit was tapped gets its name field focused
  const [focusId, setFocusId] = useState<string | null>(null);
  // a drag in progress: which row, how far it has moved, where it would land
  const [drag, setDrag] = useState<{ from: number; dy: number; to: number; h: number } | null>(null);
  const dragStart = useRef<{ y: number; id: number } | null>(null);
  // the order a drop asked for, shown until the saved pages come back
  const [pending, setPending] = useState<string[] | null>(null);
  useEffect(() => setPending(null), [pages]);

  const shown = pending
    ? pending.map((id) => pages.find((p) => p.id === id)).filter((p): p is MacapadPage => Boolean(p))
    : pages;
  const name = (p: MacapadPage, i: number) => p.name || `page ${i + 1}`;

  function move(id: string, to: number) {
    const from = shown.findIndex((p) => p.id === id);
    const target = Math.min(shown.length - 1, Math.max(0, to));
    if (from < 0 || target === from) return;
    const ids = shown.map((p) => p.id);
    ids.splice(target, 0, ...ids.splice(from, 1));
    setPending(ids);
    onMove(id, target);
  }

  function gripDown(e: React.PointerEvent<HTMLElement>, from: number) {
    const row = e.currentTarget.closest<HTMLElement>(".mps-page-row");
    if (!row) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { y: e.clientY, id: e.pointerId };
    setDrag({ from, dy: 0, to: from, h: row.offsetHeight });
  }

  function gripMove(e: React.PointerEvent) {
    const st = dragStart.current;
    if (!st || !drag || e.pointerId !== st.id) return;
    const dy = e.clientY - st.y;
    const to = Math.min(shown.length - 1, Math.max(0, drag.from + Math.round(dy / drag.h)));
    setDrag({ ...drag, dy, to });
  }

  function gripUp(e: React.PointerEvent) {
    const st = dragStart.current;
    if (!st || !drag || e.pointerId !== st.id) return;
    dragStart.current = null;
    setDrag(null);
    if (drag.to !== drag.from) move(shown[drag.from].id, drag.to);
  }

  /** where a row sits while another is being dragged past it */
  function rowStyle(i: number): React.CSSProperties | undefined {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: "none", zIndex: 2 };
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-drag.h}px)` };
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return { transform: `translateY(${drag.h}px)` };
    return { transform: "none" };
  }

  return (
    <>
      <h3 className="group-head">Pages in this pad</h3>
      <div className={`group mps-pages${editing ? " editing" : ""}${drag ? " dragging" : ""}`}>
        {shown.map((p, i) =>
          editing ? (
            <div
              key={p.id}
              className={`group-row mps-page-row${drag?.from === i ? " lifted" : ""}`}
              style={rowStyle(i)}
            >
              <span
                className="mps-grip"
                role="button"
                tabIndex={0}
                aria-label={`Drag ${name(p, i)} up or down`}
                onPointerDown={(e) => gripDown(e, i)}
                onPointerMove={gripMove}
                onPointerUp={gripUp}
                onPointerCancel={gripUp}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") move(p.id, i - 1);
                  if (e.key === "ArrowDown") move(p.id, i + 1);
                }}
              >
                <MI name="menu" />
              </span>
              <input
                key={`${p.id}-${i}`}
                className="mps-pos"
                inputMode="numeric"
                defaultValue={i + 1}
                aria-label={`Position of ${name(p, i)} (1 to ${shown.length})`}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isInteger(n) && n - 1 !== i) move(p.id, n - 1);
                  else e.target.value = String(i + 1);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
              <input
                key={p.id}
                className="mps-page-name"
                defaultValue={p.name}
                maxLength={30}
                placeholder={`page ${i + 1}`}
                aria-label={`Name of page ${i + 1}`}
                autoFocus={p.id === focusId}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== p.name) onRename(p.id, next);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
              <button
                className="mps-page-del"
                onClick={() => onDelete(p.id)}
                disabled={shown.length === 1}
                aria-label={`Delete ${name(p, i)}`}
              >
                <MI name="remove_circle" />
              </button>
            </div>
          ) : (
            <div key={p.id} className="group-row mps-page-pick">
              <button className="mps-page-select" onClick={() => onSelect(p.id)} aria-pressed={p.id === current}>
                <span className="mps-row-text">{name(p, i)}</span>
                {p.id === current && <MI name="check" className="mps-check" />}
              </button>
              <button
                className="mps-pill mps-page-edit"
                onClick={() => {
                  setFocusId(p.id);
                  setEditing(true);
                }}
                aria-label={`Edit pages (rename, reorder, delete), starting with ${name(p, i)}`}
              >
                Edit
              </button>
            </div>
          )
        )}
        {editing ? (
          <button
            className="group-row mps-blue mps-pages-done"
            onClick={() => {
              setEditing(false);
              setFocusId(null);
            }}
          >
            Done
          </button>
        ) : (
          <button className="group-row mps-blue" onClick={onAdd} disabled={shown.length >= MACAPAD_MAX_PAGES}>
            <MI name="add" /> Add a page…
          </button>
        )}
      </div>
      <p className="group-foot">
        {editing
          ? "Drag ≡ or type a number to change the order. The name shows at the top of the pad."
          : shown.length >= MACAPAD_MAX_PAGES
            ? `A pad holds up to ${MACAPAD_MAX_PAGES} pages. Delete one to add another.`
            : "Swipe sideways on the pad to flip between its pages. Edit on a page renames, reorders or deletes."}
      </p>
    </>
  );
}

/** − n + for a grid's columns or rows. */
function GridStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="group-row">
      <span className="mps-row-text">{label}</span>
      <button className="mps-round" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
        −
      </button>
      <b className="mps-count" aria-live="polite">
        {value}
      </b>
      <button className="mps-round" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
        +
      </button>
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

/** What an image makes of a tile: an app icon fills it like a home-screen
 *  icon, a dark logo sits on the light plate, a picture fills it edge to edge. */
function imageKind(image: string): "app" | "plate" | "pic" {
  if (image.startsWith("/api/macapad/app-icon")) return "app";
  return needsPlate(image) ? "plate" : "pic";
}

/** A key as a home-screen tile: a rounded square with a white glyph, or the
 *  key's image filling it. The board, the pad preview and the editor share it. */
/** A full url from what was typed: "localhost:3000" is a host and port, not
 *  a scheme, so only `x://` or a known scheme counts; local hosts get http. */
function fullUrl(input: string): string {
  const v = input.trim();
  if (/^([a-z][a-z0-9+.-]*:\/\/|(mailto|tel|sms|facetime|file|data):)/i.test(v)) return v;
  const local = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|\[::1\]|[^/:]+\.local)(?=[:/?#]|$)/i.test(v);
  return `${local ? "http" : "https"}://${v}`;
}

export function KeyTile({ button, className }: { button: Pick<MacapadButton, "icon" | "image">; className?: string }) {
  const [broken, setBroken] = useState(false);
  // the picture's own width: a small logo is never drawn past 1.5× it (css
  // --nat), so it stays crisp in the middle of a big key instead of blurring
  const [nat, setNat] = useState<number | null>(null);
  useEffect(() => {
    setBroken(false);
    setNat(null);
  }, [button.image]);
  const kind = button.image && !broken ? imageKind(button.image) : "glyph";
  return (
    <span className={`mtile ${kind}${className ? ` ${className}` : ""}`}>
      {kind === "glyph" ? (
        <MI name={button.icon} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote logos, no next/image config
        <img
          src={button.image}
          alt=""
          draggable={false}
          style={nat ? ({ "--nat": `${nat}px` } as React.CSSProperties) : undefined}
          onLoad={(e) => setNat(e.currentTarget.naturalWidth || null)}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
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
// actions made in the Mac app can carry SF Symbol names ("speaker.wave.2.fill"):
// the nearest icon in our set, so they don't all turn into a bolt
const SF_ICONS: Record<string, string> = {
  play: "play_arrow", "play.circle": "play_arrow", "playpause": "play_pause", forward: "fast_forward",
  backward: "fast_rewind", "forward.end": "skip_next", "backward.end": "skip_previous",
  "speaker.wave.1": "volume_down", "speaker.wave.2": "volume_up", "speaker.wave.3": "volume_up",
  "speaker.slash": "volume_off", speaker: "volume_mute", "music.note": "music_note", "music.note.list": "queue_music",
  gearshape: "settings", gear: "settings", globe: "language", magnifyingglass: "search", envelope: "mail",
  moon: "dark_mode", sun: "light_mode", "sun.max": "light_mode", camera: "photo_camera", photo: "photo",
  doc: "description", "doc.on.doc": "content_copy", "doc.on.clipboard": "content_paste", scissors: "content_cut",
  trash: "delete", folder: "folder", house: "home", lightbulb: "lightbulb", keyboard: "keyboard",
  command: "keyboard_command_key", terminal: "terminal", lock: "lock", "lock.open": "lock", bell: "notifications",
  "bell.slash": "notifications_off", mic: "mic", "mic.slash": "mic_off", video: "videocam", "video.slash": "videocam_off",
  "arrow.clockwise": "refresh", "arrow.uturn.backward": "undo", "arrow.uturn.forward": "redo", star: "star",
  heart: "favorite", bolt: "bolt", sparkles: "auto_awesome", "macwindow": "window", "rectangle.split.2x1": "dashboard",
  "square.grid.2x2": "grid_view", "desktopcomputer": "desktop_mac", laptopcomputer: "laptop", printer: "print",
  wifi: "wifi", calendar: "calendar_month", clock: "schedule", timer: "timer", person: "person", message: "chat",
};
function iconOrBolt(name: string) {
  if (ICONS.includes(name)) return name;
  const sf = name.replace(/\.(fill|circle|square)$/g, "").replace(/\.(fill|circle|square)$/g, "");
  const guess = SF_ICONS[sf] ?? SF_ICONS[name] ?? sf.replace(/\./g, "_");
  return ICONS.includes(guess) ? guess : "bolt";
}

/** An action's icon the way it looks on a key: a small dark tile, white glyph. */
function ActionIcon({ icon }: { icon: string }) {
  return (
    <span className="mtile glyph mps-keyicon" aria-hidden>
      <MI name={iconOrBolt(icon)} />
    </span>
  );
}

const CATEGORY_ORDER = ["media", "system", "windows", "browser", "editing", "custom"];
function byCategory(actions: MacapadAction[]) {
  const groups = new Map<string, MacapadAction[]>();
  for (const a of actions) groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  return [...groups.entries()].sort(
    ([x], [y]) => (CATEGORY_ORDER.indexOf(x) + 1 || 99) - (CATEGORY_ORDER.indexOf(y) + 1 || 99)
  );
}

// ── button editor ────────────────────────────────────────────────────
// One question at a time. The key itself is the hero: its preview sits on
// top and changes as you go. Below it, "what it does" asks for a kind first
// (a list of plain choices), then shows only that kind's panel; "how it
// looks" is icon or picture. Every key opens on the full list of choices,
// with what it does now checked, so all the options stay in view.

type Kind = "mac" | "custom" | "app" | "web" | "keys" | "shortcut" | "sequence";

const KINDS: Array<{ kind: Kind; icon: string; color: string; title: string; hint: string }> = [
  { kind: "app", icon: "apps", color: "blue", title: "Open an app", hint: "Any app installed on your Mac" },
  { kind: "web", icon: "language", color: "teal", title: "Open a website", hint: "In your default browser, with its logo" },
  { kind: "keys", icon: "keyboard", color: "gray", title: "Press a keyboard shortcut", hint: "Like ⌘W or ⌃⌘Space" },
  { kind: "shortcut", icon: "bolt", color: "indigo", title: "Run a shortcut", hint: "From the Shortcuts app" },
  { kind: "mac", icon: "keyboard_command_key", color: "orange", title: "Control your Mac", hint: "Music, volume, windows, screenshots, emoji" },
  { kind: "custom", icon: "auto_awesome", color: "pink", title: "Your actions", hint: "Ones you've saved on your Mac, or make a new one" },
  { kind: "sequence", icon: "checklist", color: "purple", title: "Do several things", hint: "Steps in a row: type, wait, AppleScript" },
];

/** Which panel a button belongs to, from what it already does (one of your
 *  own saved actions → "Your actions"). */
function kindOf(steps: MacapadStep[] | undefined, actions?: MacapadAction[]): Kind | null {
  if (!steps?.length) return null;
  if (steps.length > 1) return "sequence";
  const first = steps[0];
  switch (first.type) {
    case "action":
      return actions?.some((a) => a.custom && a.id === first.id) ? "custom" : "mac";
    case "media":
      return "mac";
    case "openApp": return "app";
    case "openURL": return "web";
    case "keystroke": return "keys";
    case "shortcut": return "shortcut";
    default: return "sequence";
  }
}

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
  const [view, setView] = useState<"does" | "looks">("does");
  const [kind, setKind] = useState<Kind | null>(null);
  const currentKind = kindOf(steps, catalog?.actions);
  const [error, setError] = useState<string | null>(null);
  // the label follows each pick until you type your own
  const autoLabel = useRef(button?.label ?? "");
  // a small press on the preview whenever its face changes
  const [pressed, setPressed] = useState(false);
  const press = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 160);
  };

  function choose(next: { label: string; icon?: string; image?: string; steps: MacapadStep[] }) {
    if (!label.trim() || label === autoLabel.current) {
      setLabel(next.label);
      autoLabel.current = next.label;
    }
    setIcon(next.icon ?? "bolt");
    setImage(next.image ?? "");
    setSteps(next.steps);
    setError(null);
    press();
  }

  function save() {
    if (!steps.length) return setError("Choose what this key does first.");
    const cleaned = steps.map((st) =>
      // macapad needs a full url; assume https for bare hosts
      st.type === "openURL" && st.url.trim() ? { ...st, url: fullUrl(st.url) } : st
    );
    const unfinished = cleaned.findIndex(
      (st) => stepValue(st)?.trim() === "" || (st.type === "keystroke" && !parseCombo(st.keys).key)
    );
    if (unfinished >= 0)
      return setError(cleaned.length > 1 ? `Step ${unfinished + 1} isn't finished yet.` : "Finish setting this up first.");
    onSave({ id: button?.id ?? newId(), label: label.trim(), icon, ...(image ? { image } : {}), steps: cleaned });
  }

  const kindInfo = KINDS.find((k) => k.kind === kind);

  return (
    <EditablePopup
      open
      title={button ? "Edit key" : "New key"}
      onClose={onClose}
      className="bed-pop"
      footer={
        <>
          {button && (
            <button className="btn red bed-remove" onClick={onClear}>
              Remove key
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn-primary bed-save" onClick={save}>
            Save
          </button>
        </>
      }
    >
      {/* side: the key and the toggle. main: the current question. Stacked on
          phones; side by side on short landscape screens (Echo Show). */}
      <div className="bed-side">
        <div className="bed-hero">
          <div className={`bed-key${pressed ? " pressed" : ""}`} aria-hidden>
            <KeyTile button={{ icon, image }} />
            <span>{label || " "}</span>
          </div>
          <div className="bed-hero-text">
            <input
              className="field bed-label"
              value={label}
              maxLength={40}
              placeholder="Name this key"
              aria-label="Key label"
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className={`bed-does${steps.length ? "" : " empty"}`}>{summarize(steps, catalog)}</p>
          </div>
        </div>

        <div className="bed-seg" role="tablist">
          <button role="tab" aria-selected={view === "does"} className={view === "does" ? "on" : ""} onClick={() => setView("does")}>
            What it does
          </button>
          <button role="tab" aria-selected={view === "looks"} className={view === "looks" ? "on" : ""} onClick={() => setView("looks")}>
            How it looks
          </button>
        </div>
      </div>

      <div className="bed-main">
        {view === "looks" ? (
          <Appearance
            icon={icon}
            image={image}
            onIcon={(name) => {
              setIcon(name);
              setImage("");
              press();
            }}
            onImage={(url) => {
              setImage(url);
              press();
            }}
          />
        ) : !kindInfo ? (
          <div className="bed-panel">
            <h3 className="bed-q">What should this key do?</h3>
            <div className="group">
              {KINDS.filter((k) => k.kind !== "sequence").map((k) => (
                <KindRow key={k.kind} info={k} current={currentKind === k.kind} onPick={() => setKind(k.kind)} />
              ))}
            </div>
            <h4 className="group-head">For more control</h4>
            <div className="group">
              {KINDS.filter((k) => k.kind === "sequence").map((k) => (
                <KindRow key={k.kind} info={k} current={currentKind === k.kind} onPick={() => setKind(k.kind)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="bed-panel">
            <button className="bed-back" onClick={() => setKind(null)} aria-label="Choose something else">
              <MI name="chevron_left" /> All choices
            </button>
            <h3 className="bed-q">{kindInfo.title}</h3>

            {kind === "keys" ? (
              <ShortcutComposer
                value={steps.length === 1 && steps[0].type === "keystroke" ? steps[0].keys : ""}
                onChange={(keys) => choose({ label: prettyCombo(keys), icon: "keyboard", steps: [{ type: "keystroke", keys }] })}
              />
            ) : kind === "web" ? (
              <WebsitePicker
                current={steps.length === 1 && steps[0].type === "openURL" ? steps[0].url : ""}
                onPick={choose}
              />
            ) : kind === "sequence" ? (
              <SequenceEditor steps={steps} actions={catalog?.actions} onChange={setSteps} />
            ) : !catalog ? (
              <div className="mpe-empty">
                {catalogError ? (
                  <>
                    <span>{sentence(catalogError)}</span>
                    <button className="btn" onClick={reload}>
                      Try again
                    </button>
                  </>
                ) : (
                  "Asking your Mac…"
                )}
              </div>
            ) : kind === "custom" ? (
              <CustomActionPicker
                actions={catalog.actions}
                selected={steps.length === 1 && steps[0].type === "action" ? steps[0].id : ""}
                onPick={(a) => choose({ label: a.name.toLowerCase(), icon: iconOrBolt(a.icon), steps: [{ type: "action", id: a.id }] })}
                onChanged={reload}
              />
            ) : kind === "mac" ? (
              <ActionPicker
                actions={catalog.actions.filter((a) => !a.custom)}
                selected={steps.length === 1 && steps[0].type === "action" ? steps[0].id : ""}
                onPick={(a) => choose({ label: a.name.toLowerCase(), icon: iconOrBolt(a.icon), steps: [{ type: "action", id: a.id }] })}
              />
            ) : kind === "app" ? (
              <AppPicker
                apps={catalog.apps}
                selected={steps.length === 1 && steps[0].type === "openApp" ? steps[0].app : ""}
                onPick={(app) =>
                  choose({ label: app.name.toLowerCase(), icon: "apps", image: appIcon(app.bundleId), steps: [{ type: "openApp", app: app.bundleId }] })
                }
              />
            ) : (
              <ShortcutPicker
                shortcuts={catalog.shortcuts}
                selected={steps.length === 1 && steps[0].type === "shortcut" ? steps[0].name : ""}
                onPick={(name) => choose({ label: name.toLowerCase(), icon: "bolt", steps: [{ type: "shortcut", name }] })}
              />
            )}
          </div>
        )}

        {error && <p className="mps-error">{error}</p>}
      </div>
    </EditablePopup>
  );
}

/** One choice in the "what should this key do" list: an iOS Settings row. */
function KindRow({ info, current, onPick }: { info: (typeof KINDS)[number]; current?: boolean; onPick: () => void }) {
  return (
    <button className={`group-row bed-kind${current ? " current" : ""}`} onClick={onPick} aria-current={current || undefined}>
      <span className={`mps-ico ${info.color}`}>
        <MI name={info.icon} />
      </span>
      <span className="mps-row-text">
        {info.title}
        <small>{info.hint}</small>
      </span>
      {current && <MI name="check" className="bed-kind-check" />}
      <MI name="chevron_right" className="mps-chev" />
    </button>
  );
}

/** One plain sentence for what a button does. */
function summarize(steps: MacapadStep[], catalog: MacapadCatalog | null): string {
  if (!steps.length) return "Doesn't do anything yet";
  const parts = steps.map((st) => describeStep(st, catalog));
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return `${parts.length} steps: ${parts.join(", then ")}`;
}

function describeStep(st: MacapadStep, catalog: MacapadCatalog | null): string {
  switch (st.type) {
    case "action": {
      const a = catalog?.actions.find((x) => x.id === st.id);
      if (!st.id) return "an action (not chosen yet)";
      if (!a) return st.id;
      const keys = a.steps.length === 1 && a.steps[0].type === "keystroke" ? `, ${prettyCombo(a.steps[0].keys)}` : "";
      return `${a.name.toLowerCase()}${keys}`;
    }
    case "openApp": {
      const app = catalog?.apps.find((x) => x.bundleId === st.app || x.name.toLowerCase() === st.app.toLowerCase());
      return st.app ? `opens ${app?.name ?? st.app}` : "opens an app (not chosen yet)";
    }
    case "openURL": {
      try {
        return `opens ${new URL(fullUrl(st.url)).hostname.replace(/^www\./, "")}`;
      } catch {
        return "opens a website (not set yet)";
      }
    }
    case "keystroke": return parseCombo(st.keys).key ? `presses ${prettyCombo(st.keys)}` : "presses a shortcut (not set yet)";
    case "shortcut": return st.name ? `runs “${st.name}”` : "runs a shortcut (not chosen yet)";
    case "media": return MEDIA_LABELS[st.key] ?? st.key;
    case "typeText": return st.text ? `types “${st.text.length > 24 ? `${st.text.slice(0, 24)}…` : st.text}”` : "types text";
    case "appleScript": return "runs AppleScript";
    case "wait": return `waits ${+(st.ms / 1000).toFixed(1)} sec`;
  }
}

// ── keyboard shortcuts ───────────────────────────────────────────────

const MODIFIERS = [
  { key: "ctrl", symbol: "⌃", name: "control" },
  { key: "opt", symbol: "⌥", name: "option" },
  { key: "shift", symbol: "⇧", name: "shift" },
  { key: "cmd", symbol: "⌘", name: "command" },
] as const;

const KEY_SYMBOLS: Record<string, string> = {
  space: "Space", return: "↩", tab: "⇥", esc: "⎋", delete: "⌫", forwarddelete: "⌦",
  up: "↑", down: "↓", left: "←", right: "→", home: "↖", end: "↘", pageup: "⇞", pagedown: "⇟",
};

const MOD_ALIASES: Record<string, string> = { command: "cmd", option: "opt", alt: "opt", control: "ctrl" };

// every key name macapad understands
const KNOWN_KEYS = new Set([
  ..."abcdefghijklmnopqrstuvwxyz0123456789".split(""),
  "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/", "`",
  ...Object.keys(KEY_SYMBOLS), "enter", "backspace", "escape",
  ...Array.from({ length: 20 }, (_, i) => `f${i + 1}`),
]);

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
  return [...(mods.has("fn") ? ["fn"] : []), ...MODIFIERS.map((m) => m.key).filter((m) => mods.has(m)), key]
    .filter(Boolean)
    .join("+");
}

/** The parts of a combo as they're printed on keycaps: ⌃ ⌥ ⌘ T. */
function comboCaps(combo: string): string[] {
  const { mods, key } = parseCombo(combo);
  return [
    ...(mods.has("fn") ? ["fn"] : []),
    ...MODIFIERS.filter((m) => mods.has(m.key)).map((m) => m.symbol),
    ...(key ? [KEY_SYMBOLS[key] ?? key.toUpperCase()] : []),
  ];
}

function prettyCombo(combo: string): string {
  const caps = comboCaps(combo);
  return caps[0] === "fn" ? `fn ${caps.slice(1).join("")}` : caps.join("");
}

// browser KeyboardEvent.key → macapad key names
const BROWSER_KEYS: Record<string, string> = {
  " ": "space", Enter: "return", Tab: "tab", Escape: "esc", Backspace: "delete", Delete: "forwarddelete",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown",
};

// the keys you can't type into a text field on a tablet
const TAP_KEYS = ["space", "return", "tab", "esc", "delete", "left", "up", "down", "right"];

function ShortcutComposer({ value, onChange }: { value: string; onChange: (combo: string) => void }) {
  const { mods, key } = parseCombo(value);
  const [draft, setDraft] = useState(key && !KEY_SYMBOLS[key] ? key : "");
  const caps = comboCaps(value);
  const unknown = key !== "" && !KNOWN_KEYS.has(key);

  function toggle(mod: string) {
    const next = new Set(mods);
    if (next.has(mod)) next.delete(mod);
    else next.add(mod);
    onChange(buildCombo(next, key));
  }

  function setKey(k: string) {
    setDraft(KEY_SYMBOLS[k] ? "" : k);
    onChange(buildCombo(mods, k));
  }

  // on a computer: click the field and press the real shortcut
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Shift", "Meta", "Control", "Alt", "CapsLock", "Fn"].includes(e.key)) return;
    const name =
      BROWSER_KEYS[e.key] ??
      (/^F\d{1,2}$/.test(e.key) ? e.key.toLowerCase()
        : e.code.startsWith("Key") ? e.code.slice(3).toLowerCase()
        : e.code.startsWith("Digit") ? e.code.slice(5)
        : e.key.length === 1 ? e.key.toLowerCase() : "");
    if (!name) return;
    // a plain letter from a soft keyboard is just typing — let onChange take it
    if (!e.metaKey && !e.ctrlKey && !e.altKey && name.length === 1 && !BROWSER_KEYS[e.key]) return;
    e.preventDefault();
    const next = new Set<string>();
    if (e.metaKey) next.add("cmd");
    if (e.shiftKey) next.add("shift");
    if (e.altKey) next.add("opt");
    if (e.ctrlKey) next.add("ctrl");
    setDraft(KEY_SYMBOLS[name] ? "" : name);
    onChange(buildCombo(next.size ? next : mods, name));
  }

  return (
    <div className="bed-keys">
      <div className="bed-caps" aria-live="polite">
        {caps.length ? (
          caps.map((c, i) => (
            <kbd key={i} className={c.length > 1 ? "wide" : ""}>
              {c}
            </kbd>
          ))
        ) : (
          <span className="bed-caps-empty">Pick the keys below</span>
        )}
      </div>

      <h4 className="group-head">Hold down</h4>
      <div className="bed-chips">
        {MODIFIERS.map((m) => (
          <button key={m.key} className={mods.has(m.key) ? "on" : ""} onClick={() => toggle(m.key)} aria-pressed={mods.has(m.key)}>
            <b>{m.symbol}</b> {m.name}
          </button>
        ))}
        <button className={mods.has("fn") ? "on" : ""} onClick={() => toggle("fn")} aria-pressed={mods.has("fn")}>
          fn
        </button>
      </div>

      <h4 className="group-head">Then press</h4>
      <input
        className="field bed-keyfield"
        value={draft}
        maxLength={3}
        placeholder="A letter, number or F5"
        aria-label="Key"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onKeyDown={onKeyDown}
        onChange={(e) => setKey(e.target.value === " " ? "space" : e.target.value.trim().toLowerCase())}
      />
      <div className="bed-chips">
        {TAP_KEYS.map((k) => (
          <button key={k} className={k === key ? "on" : ""} onClick={() => setKey(k === key ? "" : k)} aria-pressed={k === key} aria-label={k}>
            {KEY_SYMBOLS[k]}
            {k.length > 1 && KEY_SYMBOLS[k].length === 1 && !["up", "down", "left", "right"].includes(k) ? ` ${k}` : ""}
          </button>
        ))}
      </div>

      {unknown ? (
        <p className="mps-error">“{key}” isn&rsquo;t a key Macapad knows. Use a letter, a number, a symbol like / or ; , or F1–F20.</p>
      ) : (
        <p className="group-foot">On a computer, click the box and press the whole shortcut.</p>
      )}
    </div>
  );
}

// ── how it looks ─────────────────────────────────────────────────────

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
    return { error: "Couldn't reach the desk." };
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
  const [mode, setMode] = useState<"icon" | "picture">(image ? "picture" : "icon");
  return (
    <div className="bed-panel">
      <h3 className="bed-q">What goes on the key?</h3>
      <div className="bed-seg small" role="tablist">
        <button role="tab" className={mode === "icon" ? "on" : ""} onClick={() => setMode("icon")} aria-selected={mode === "icon"}>
          An icon
        </button>
        <button role="tab" className={mode === "picture" ? "on" : ""} onClick={() => setMode("picture")} aria-selected={mode === "picture"}>
          A picture
        </button>
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
    if (!res.url) return setError(res.error ?? "Couldn't use that picture.");
    onImage(res.url);
    if (res.originalBytes && res.bytes) setNote(`Shrunk from ${kb(res.originalBytes)} to ${kb(res.bytes)}. Transparency is kept.`);
  }

  return (
    <div className="bed-picture">
      <div className="group">
        <label className={`group-row bed-upload${busy ? " busy" : ""}`}>
          <span className="mps-ico blue">
            <MI name="upload" />
          </span>
          <span className="mps-row-text">
            {busy ? "Shrinking…" : "Upload a picture"}
            <small>PNG, JPG, WebP, GIF or SVG</small>
          </span>
          <MI name="chevron_right" className="mps-chev" />
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
      </div>
      <h4 className="group-head">Or use a picture from the web</h4>
      <form
        className="bed-inline"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) use(link.trim());
        }}
      >
        <input
          className="field"
          value={link}
          placeholder="Paste a picture link"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setLink(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !link.trim()}>
          Use
        </button>
      </form>
      {note && <p className="group-foot ok">{note}</p>}
      {image && (
        <div className="group bed-unpic">
          <button className="group-row mps-red" onClick={() => onImage("")}>
            Take the picture off
          </button>
        </div>
      )}
      {error && <p className="mps-error">{error}</p>}
    </div>
  );
}

function IconGrid({ value, onPick }: { value: string | null; onPick: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? ICONS.filter((name) => iconMatches(name, q)) : ICONS;
  return (
    <div className="bed-iconpick">
      <SearchField value={query} onChange={setQuery} placeholder="Search icons: music, browser, robot…" />
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
      {shown.length === 0 && <div className="mpe-empty">No icons match “{query}”.</div>}
    </div>
  );
}

// ── what it does: the pickers ────────────────────────────────────────

/** Scroll a list so its current choice is in view when it first opens. */
function useRevealSelected() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = ref.current?.querySelector<HTMLElement>(".on");
    on?.scrollIntoView({ block: "center" });
  }, []);
  return ref;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="bed-search">
      <MI name="search" />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </label>
  );
}

const CATEGORY_NAMES: Record<string, string> = {
  media: "Media", system: "System", windows: "Windows", browser: "Browser", editing: "Editing", custom: "Your actions",
};

const CATEGORY_COLORS: Record<string, string> = {
  media: "pink", system: "gray", windows: "blue", browser: "teal", editing: "orange", custom: "purple",
};

function ActionPicker({ actions, selected, onPick }: { actions: MacapadAction[]; selected: string; onPick: (a: MacapadAction) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? actions.filter((a) => `${a.name} ${a.id} ${a.category}`.toLowerCase().includes(q)) : actions;
  const list = useRevealSelected();
  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder={`Search ${actions.length} actions`} />
      <div className="bed-list" ref={list}>
        {byCategory(shown).map(([category, list]) => (
          <div key={category}>
            <h4 className="group-head">{CATEGORY_NAMES[category] ?? category}</h4>
            <div className="group">
              {list.map((a) => (
                <button key={a.id} className={`group-row bed-item${a.id === selected ? " on" : ""}`} onClick={() => onPick(a)} aria-pressed={a.id === selected}>
                  <span className={`mps-ico ${CATEGORY_COLORS[category] ?? "gray"}`}>
                    <MI name={iconOrBolt(a.icon)} />
                  </span>
                  <span className="mps-row-text">{a.name}</span>
                  {a.steps.length === 1 && a.steps[0].type === "keystroke" && <kbd>{prettyCombo(a.steps[0].keys)}</kbd>}
                  {a.id === selected && <MI name="check" className="mps-check" />}
                </button>
              ))}
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="mpe-empty">No actions match “{query}”.</div>}
      </div>
    </>
  );
}

/** "Your actions": the ones saved on your Mac (made here or in the Mac app),
 *  shown with their own icons, plus a way to make a new one — saving it puts
 *  it straight on the key. */
function CustomActionPicker({
  actions,
  selected,
  onPick,
  onChanged,
}: {
  actions: MacapadAction[];
  selected: string;
  onPick: (a: MacapadAction) => void;
  onChanged: () => void;
}) {
  const mine = actions.filter((a) => a.custom);
  const [making, setMaking] = useState(false);
  return (
    <div className="bed-list">
      <div className="group">
        {mine.map((a) => (
          <button
            key={a.id}
            className={`group-row bed-item${a.id === selected ? " on" : ""}`}
            onClick={() => onPick(a)}
            aria-pressed={a.id === selected}
          >
            <ActionIcon icon={a.icon} />
            <span className="mps-row-text">
              {a.name}
              <small>
                {a.steps.length} step{a.steps.length === 1 ? "" : "s"}
              </small>
            </span>
            {a.id === selected && <MI name="check" className="mps-check" />}
          </button>
        ))}
        <button className="group-row mps-blue" onClick={() => setMaking(true)}>
          <MI name="add" /> New action
        </button>
      </div>
      <p className="group-foot">
        {mine.length
          ? "Saved on your Mac, so every pad and screen can use them."
          : "You haven't saved any actions yet. Make one for anything a key should do in several steps."}
      </p>
      {making && (
        <ActionEditor
          action={null}
          actions={actions}
          onClose={() => setMaking(false)}
          onSaved={(saved) => {
            setMaking(false);
            onChanged();
            if (saved) onPick(saved);
          }}
        />
      )}
    </div>
  );
}

function AppPicker({ apps, selected, onPick }: { apps: MacapadApp[]; selected: string; onPick: (app: MacapadApp) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? apps.filter((a) => a.name.toLowerCase().includes(q) || a.bundleId.toLowerCase().includes(q)) : apps;
  const list = useRevealSelected();
  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder={`Search ${apps.length} apps`} />
      <div className="bed-list" ref={list}>
        {shown.length > 0 && (
          <div className="group">
            {shown.map((app) => (
              <button
                key={app.bundleId}
                className={`group-row bed-item${app.bundleId === selected ? " on" : ""}`}
                onClick={() => onPick(app)}
                aria-pressed={app.bundleId === selected}
              >
                <span className="bed-appicon">
                  <KeyFace button={{ icon: "apps", image: appIcon(app.bundleId) }} />
                </span>
                <span className="mps-row-text">{app.name}</span>
                {app.bundleId === selected && <MI name="check" className="mps-check" />}
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 && <div className="mpe-empty">No apps match “{query}”.</div>}
      </div>
    </>
  );
}

function ShortcutPicker({ shortcuts, selected, onPick }: { shortcuts: string[]; selected: string; onPick: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useRevealSelected();
  if (!shortcuts.length) return <div className="mpe-empty">Your Shortcuts app has no shortcuts yet.</div>;
  const q = query.trim().toLowerCase();
  const shown = q ? shortcuts.filter((name) => name.toLowerCase().includes(q)) : shortcuts;
  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder={`Search ${shortcuts.length} shortcuts`} />
      <div className="bed-list" ref={list}>
        {shown.length > 0 && (
          <div className="group">
            {shown.map((name) => (
              <button key={name} className={`group-row bed-item${name === selected ? " on" : ""}`} onClick={() => onPick(name)} aria-pressed={name === selected}>
                <span className="mps-ico indigo">
                  <MI name="bolt" />
                </span>
                <span className="mps-row-text">{name}</span>
                {name === selected && <MI name="check" className="mps-check" />}
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 && <div className="mpe-empty">No shortcuts match “{query}”.</div>}
      </div>
    </>
  );
}

function WebsitePicker({
  current,
  onPick,
}: {
  current: string;
  onPick: (b: { label: string; image?: string; icon?: string; steps: MacapadStep[] }) => void;
}) {
  const [url, setUrl] = useState(current);
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
      return setError(res.reason ?? "Couldn't read that site.");
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
    <div className="bed-picture">
      <form
        className="bed-inline"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <input
          className="field"
          value={url}
          placeholder="hackclub.com"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !url.trim()}>
          {busy ? "Finding…" : "Find"}
        </button>
      </form>
      <p className="group-foot">Type the website&rsquo;s address. It opens in your Mac&rsquo;s default browser, and the key gets the site&rsquo;s own logo.</p>
      {meta && meta.images.length > 1 && (
        <>
          <h4 className="group-head">Other logos on {new URL(meta.url).hostname.replace(/^www\./, "")}</h4>
          <div className="mpe-logos">
            {meta.images.slice(0, 8).map((src) => (
              <button key={src} onClick={() => use(meta, src)} aria-label="Use this logo" disabled={busy}>
                <KeyTile button={{ icon: "language", image: src }} />
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="mps-error">{error}</p>}
    </div>
  );
}

/** The step list for buttons that do several things. */
function SequenceEditor({
  steps,
  actions,
  onChange,
}: {
  steps: MacapadStep[];
  actions?: MacapadAction[];
  onChange: (steps: MacapadStep[]) => void;
}) {
  const move = (i: number, d: number) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="bed-sequence">
      {steps.length > 0 && (
        <ol className="mpad-steps">
          {steps.map((st, i) => (
            <StepRow
              key={i}
              step={st}
              number={i + 1}
              actions={actions}
              canUp={i > 0}
              canDown={i < steps.length - 1}
              onChange={(next) => onChange(steps.map((x, j) => (j === i ? next : x)))}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onRemove={() => onChange(steps.filter((_, j) => j !== i))}
            />
          ))}
        </ol>
      )}
      <div className="group">
        <button className="group-row mps-blue" onClick={() => onChange([...steps, defaultStep(steps.length ? "wait" : "action")])}>
          <MI name="add" /> {steps.length ? "Add another step" : "Add the first step"}
        </button>
      </div>
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
        <b>Step {number}</b>
        <span style={{ flex: 1 }} />
        <button className="mps-round" onClick={onUp} disabled={!canUp} aria-label="Move step up">
          <MI name="arrow_upward" />
        </button>
        <button className="mps-round" onClick={onDown} disabled={!canDown} aria-label="Move step down">
          <MI name="arrow_downward" />
        </button>
        <button className="mps-round red" onClick={onRemove} aria-label="Remove step">
          <MI name="close" />
        </button>
      </div>
      <div className="mpad-step-body">
        <select className="field" value={step.type} onChange={(e) => onChange(defaultStep(e.target.value as StepType))} aria-label="What this step does">
          {MACAPAD_STEP_TYPES.map((t) => (
            <option key={t} value={t}>
              {STEP_INFO[t].label}
            </option>
          ))}
        </select>

      {step.type === "media" && (
        <select className="field" value={step.key} onChange={(e) => onChange({ ...step, key: e.target.value as typeof step.key })} aria-label="Which media key">
          {Object.entries(MEDIA_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      )}
      {step.type === "wait" && (
        <input
          className="field"
          type="number"
          inputMode="decimal"
          min={0}
          max={60}
          step={0.1}
          value={step.ms / 1000}
          onChange={(e) => onChange({ ...step, ms: Math.round(Number(e.target.value) * 1000) })}
          aria-label="Seconds"
        />
      )}
      {step.type === "action" && actions && (
        <select className="field" value={step.id} onChange={(e) => onChange({ ...step, id: e.target.value })} aria-label="Which Mac action">
          <option value="">Choose an action…</option>
          {byCategory(actions).map(([category, list]) => (
            <optgroup key={category} label={CATEGORY_NAMES[category] ?? category}>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          ))}
          {step.id && !actions.some((a) => a.id === step.id) && <option value={step.id}>{step.id} (not on your Mac)</option>}
        </select>
      )}
      {step.type === "keystroke" && <ShortcutComposer value={step.keys} onChange={(keys) => onChange({ ...step, keys })} />}
      {step.type === "appleScript" && (
        <textarea
          className="field"
          value={step.source}
          placeholder={info.placeholder}
          onChange={(e) => onChange(withValue(step, e.target.value))}
          aria-label="AppleScript"
        />
      )}
      {value !== null && step.type !== "appleScript" && step.type !== "keystroke" && !(step.type === "action" && actions) && (
        <input
          className="field"
          value={value}
          placeholder={step.type === "action" ? "The action's name" : info.placeholder}
          onChange={(e) => onChange(withValue(step, e.target.value))}
          inputMode={step.type === "openURL" ? "url" : undefined}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={info.label}
        />
      )}
      {info.hint && <small>{info.hint}</small>}
      </div>
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
    <>
      <h3 className="group-head">Your actions</h3>
      <div className="group">
        {!catalog && (
          <div className="group-row mps-muted">
            <span className="mps-row-text">{error ? sentence(error) : "Asking your Mac…"}</span>
            {error && (
              <button className="mps-pill" onClick={reload}>
                Try again
              </button>
            )}
          </div>
        )}
        {mine.map((a) => (
          <div key={a.id} className="group-row">
            <ActionIcon icon={a.icon} />
            <span className="mps-row-text">
              {a.name}
              <small>
                {a.steps.length} step{a.steps.length === 1 ? "" : "s"}
              </small>
            </span>
            <button className="mps-pill" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
              Edit
            </button>
            <button className="mps-round red" onClick={() => remove(a)} aria-label={`Delete ${a.name}`}>
              <MI name="delete" />
            </button>
          </div>
        ))}
        {catalog && (
          <button className="group-row mps-blue" onClick={() => setEditing("new")}>
            <MI name="add" /> New action
          </button>
        )}
      </div>
      <p className="group-foot">
        Saved on your Mac, so any key can run one, and so can other apps that use Macapad. Build one when a key needs to
        do several things in a row.
      </p>
      {problem && <p className="mps-error">{problem}</p>}
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
    </>
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
  onSaved: (saved: MacapadAction | null) => void;
}) {
  const [name, setName] = useState(action?.name ?? "");
  const [icon, setIcon] = useState(action?.icon ?? "bolt");
  const [steps, setSteps] = useState<MacapadStep[]>(action?.steps ?? [defaultStep("keystroke")]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"steps" | "icon">("steps");

  async function save() {
    if (!name.trim()) return setError("Give it a name first.");
    if (!steps.length) return setError("Add at least one step.");
    const blank = steps.findIndex((st) => stepValue(st)?.trim() === "" || (st.type === "keystroke" && !parseCombo(st.keys).key));
    if (blank >= 0) return setError(`Step ${blank + 1} isn't finished yet.`);
    setSaving(true);
    const res = await macapadAction<MacapadAction>("saveAction", {
      action: { id: action?.id ?? "", name: name.trim(), icon, category: action?.category ?? "custom", steps },
    });
    setSaving(false);
    if (res.reason) return setError(res.reason);
    onSaved(res.data?.id ? res.data : null);
  }

  return (
    <EditablePopup
      open
      title={action ? "Edit action" : "New action"}
      onClose={onClose}
      className="bed-pop"
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button className="btn-primary bed-save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save to Mac"}
          </button>
        </>
      }
    >
      <div className="bed-side">
        <div className="bed-hero">
          <div className="bed-key" aria-hidden>
            <KeyTile button={{ icon }} />
            <span>{name || " "}</span>
          </div>
          <div className="bed-hero-text">
            <input
              className="field bed-label"
              value={name}
              maxLength={40}
              placeholder="Name this action"
              aria-label="Action name"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="bed-does">
              {steps.length} step{steps.length === 1 ? "" : "s"}, saved on your Mac
            </p>
          </div>
        </div>
        <div className="bed-seg" role="tablist">
          <button role="tab" aria-selected={view === "steps"} className={view === "steps" ? "on" : ""} onClick={() => setView("steps")}>
            Steps
          </button>
          <button role="tab" aria-selected={view === "icon"} className={view === "icon" ? "on" : ""} onClick={() => setView("icon")}>
            Icon
          </button>
        </div>
      </div>

      <div className="bed-main">
        {view === "steps" ? (
          <div className="bed-sequence">
            <h3 className="bed-q">What happens, in order</h3>
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
            <div className="group">
              <button className="group-row mps-blue" onClick={() => setSteps((cur) => [...cur, defaultStep("keystroke")])}>
                <MI name="add" /> Add a step
              </button>
            </div>
          </div>
        ) : (
          <div className="bed-panel">
            <h3 className="bed-q">Pick an icon</h3>
            <IconGrid value={icon} onPick={setIcon} />
          </div>
        )}
        {error && <p className="mps-error">{error}</p>}
      </div>
    </EditablePopup>
  );
}
