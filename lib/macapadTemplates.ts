// Ready-made macapad pages: settings → macapad → "Start from a ready-made
// page" fills the page you're on, "Add a page…" adds one. A pad page starts
// as 4×2 (2×4 on the phone remote), so every template is built around its
// first 8 keys, ordered in pairs: read four to a row they make two sensible
// rows, read two to a row they make four sensible pairs (volume down · up,
// previous · next…). Bigger grids take the 7 extras after them; the small
// pad (4 slots) takes the picks listed in `small`. Client-safe (no sqlite) —
// the editor lists these, /api/macapad builds pages from them by id, and
// lib/macapad seeds each screen's pad page with two of them.
// Every icon must be in the font subset (tools/make-icon-font.mjs).

import type { MacapadButton, MacapadMediaKey } from "./types";

type Key = Omit<MacapadButton, "id">;

export interface MacapadTemplate {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  color: string; // .mps-ico color class
  keys: Key[]; // 15: the core 8 (in pairs), then extras for bigger grids
  small: number[]; // indexes into keys: the best 4, for a 2×2 pad
}

const appIcon = (bundleId: string) => `/api/macapad/app-icon?bundleId=${encodeURIComponent(bundleId)}`;

const media = (label: string, icon: string, key: MacapadMediaKey): Key => ({ label, icon, steps: [{ type: "media", key }] });
const keys = (label: string, icon: string, combo: string): Key => ({ label, icon, steps: [{ type: "keystroke", keys: combo }] });
const app = (label: string, bundleId: string): Key => ({
  label,
  icon: "apps",
  image: appIcon(bundleId),
  steps: [{ type: "openApp", app: bundleId }],
});
const site = (label: string, icon: string, url: string): Key => ({ label, icon, steps: [{ type: "openURL", url }] });
const script = (label: string, icon: string, source: string): Key => ({ label, icon, steps: [{ type: "appleScript", source }] });
const volume = (label: string, level: number) => script(label, level >= 75 ? "volume_up" : "volume_down", `set volume output volume ${level}`);

export const MACAPAD_TEMPLATES: MacapadTemplate[] = [
  {
    id: "volume",
    name: "Volume & music",
    blurb: "Playback, volume steps, your music apps",
    icon: "volume_up",
    color: "pink",
    keys: [
      media("volume down", "volume_down", "volumeDown"),
      media("volume up", "volume_up", "volumeUp"),
      media("previous", "skip_previous", "previous"),
      media("next", "skip_next", "next"),
      media("play / pause", "play_pause", "playPause"),
      media("mute", "volume_off", "mute"),
      app("music", "com.apple.Music"),
      app("spotify", "com.spotify.client"),
      volume("volume 25%", 25),
      volume("volume 50%", 50),
      volume("volume 75%", 75),
      volume("volume max", 100),
      app("podcasts", "com.apple.podcasts"),
      site("sound settings", "tune", "x-apple.systempreferences:com.apple.Sound-Settings.extension"),
      script("mic off", "mic_off", "set volume input volume 0"),
    ],
    small: [0, 1, 4, 5],
  },
  {
    id: "developer",
    name: "Developer",
    blurb: "VS Code, Terminal and the shortcuts you reach for",
    icon: "terminal",
    color: "indigo",
    keys: [
      app("vs code", "com.microsoft.VSCode"),
      app("terminal", "com.apple.Terminal"),
      keys("commands", "keyboard_command_key", "cmd+shift+p"),
      keys("go to file", "description", "cmd+p"),
      keys("find in files", "search", "cmd+shift+f"),
      keys("comment", "edit_note", "cmd+/"),
      keys("terminal panel", "web_asset", "ctrl+`"),
      keys("save all", "save_alt", "opt+cmd+s"),
      site("github", "merge", "https://github.com"),
      site("localhost", "dns", "http://localhost:3000"),
      keys("format", "auto_awesome", "shift+opt+f"),
      keys("definition", "arrow_forward", "f12"),
      keys("rename", "edit", "f2"),
      keys("split editor", "dashboard", "cmd+\\"),
      app("activity", "com.apple.ActivityMonitor"),
    ],
    small: [0, 1, 2, 6],
  },
  {
    id: "browser",
    name: "Browser",
    blurb: "Tabs, history, zoom — any browser",
    icon: "language",
    color: "teal",
    keys: [
      keys("back", "arrow_back", "cmd+["),
      keys("forward", "arrow_forward", "cmd+]"),
      keys("new tab", "tab", "cmd+t"),
      keys("close tab", "close", "cmd+w"),
      keys("previous tab", "chevron_left", "ctrl+shift+tab"),
      keys("next tab", "chevron_right", "ctrl+tab"),
      keys("reload", "refresh", "cmd+r"),
      keys("reopen tab", "history", "cmd+shift+t"),
      keys("address bar", "link", "cmd+l"),
      keys("bookmark", "bookmark", "cmd+d"),
      keys("find", "search", "cmd+f"),
      keys("new window", "open_in_new", "cmd+n"),
      keys("private", "visibility_off", "cmd+shift+n"),
      keys("zoom in", "zoom_in", "cmd+="),
      keys("zoom out", "zoom_out", "cmd+-"),
    ],
    small: [2, 3, 6, 7],
  },
  {
    id: "calls",
    name: "Zoom calls",
    blurb: "Mute, camera, share and leave",
    icon: "videocam",
    color: "green",
    keys: [
      keys("mute", "mic_off", "cmd+shift+a"),
      keys("camera", "videocam_off", "cmd+shift+v"),
      keys("share screen", "screen_share", "cmd+shift+s"),
      keys("leave", "logout", "cmd+w"),
      keys("raise hand", "flag", "opt+y"),
      keys("chat", "chat", "cmd+shift+h"),
      keys("people", "group", "cmd+u"),
      app("zoom", "us.zoom.xos"),
      keys("gallery", "grid_view", "cmd+shift+w"),
      keys("full screen", "fullscreen", "cmd+shift+f"),
      keys("record", "videocam", "cmd+shift+r"),
      app("calendar", "com.apple.iCal"),
      app("slack", "com.tinyspeck.slackmacgap"),
      app("mail", "com.apple.mail"),
      app("messages", "com.apple.MobileSMS"),
    ],
    small: [0, 1, 2, 3],
  },
  {
    id: "mac",
    name: "Mac & windows",
    blurb: "Spaces, windows, screenshots, lock",
    icon: "desktop_mac",
    color: "orange",
    keys: [
      keys("space left", "chevron_left", "ctrl+left"),
      keys("space right", "chevron_right", "ctrl+right"),
      keys("mission control", "grid_view", "ctrl+up"),
      keys("app windows", "window", "ctrl+down"),
      keys("spotlight", "search", "cmd+space"),
      keys("screenshot", "screenshot_monitor", "cmd+shift+4"),
      keys("emoji", "mood", "ctrl+cmd+space"),
      keys("lock", "lock", "ctrl+cmd+q"),
      keys("minimize", "minimize", "cmd+m"),
      keys("hide app", "visibility_off", "cmd+h"),
      keys("quit app", "power_settings_new", "cmd+q"),
      keys("full screen", "fullscreen", "ctrl+cmd+f"),
      keys("next window", "web_asset", "cmd+`"),
      keys("screen tools", "photo_camera", "cmd+shift+5"),
      app("finder", "com.apple.finder"),
    ],
    small: [2, 4, 5, 7],
  },
  {
    id: "writing",
    name: "Writing & editing",
    blurb: "Copy, paste, undo, formatting",
    icon: "edit_note",
    color: "purple",
    keys: [
      keys("undo", "undo", "cmd+z"),
      keys("redo", "redo", "cmd+shift+z"),
      keys("copy", "content_copy", "cmd+c"),
      keys("paste", "content_paste", "cmd+v"),
      keys("cut", "content_cut", "cmd+x"),
      keys("select all", "select_all", "cmd+a"),
      keys("find", "search", "cmd+f"),
      keys("save", "save_alt", "cmd+s"),
      keys("bold", "format_paint", "cmd+b"),
      keys("italic", "draw", "cmd+i"),
      keys("underline", "edit", "cmd+u"),
      keys("plain paste", "content_paste", "opt+shift+cmd+v"),
      keys("new", "note", "cmd+n"),
      keys("print", "print", "cmd+p"),
      app("notes", "com.apple.Notes"),
    ],
    small: [2, 3, 0, 7],
  },
];

/** The template's keys for a pad with `slots` slots, slot for slot (null =
 *  empty slot): the small pick for 4 slots or fewer, else the keys in order. Keys get ids from `id`, so the same template can be added
 *  more than once. */
export function templateButtons(
  template: MacapadTemplate,
  slots: number,
  id: (index: number) => string
): (MacapadButton | null)[] {
  const keys = slots <= 4 ? template.small.map((i) => template.keys[i]) : template.keys;
  return Array.from({ length: slots }, (_, i) => (keys[i] ? { id: id(i), ...keys[i] } : null));
}
