// Ready-made macapad pages: settings → macapad → "Start from a template" adds
// one as a new page on whichever pad is open. Each template is 15 keys, laid
// out for a 5×3 pad page (read left to right) and in order of importance; a
// pad with 8 slots or fewer (the big pad, a 4×2 page) takes the picks listed
// for 8, 4 or fewer (the small pad) the picks for 4, so every grid gets a
// sensible set. Client-safe (no sqlite) — the editor lists these,
// /api/macapad builds the page from one by id, and lib/macapad seeds each
// screen's pad page with two of them.
// Every icon must be in the font subset (tools/make-icon-font.mjs).

import type { MacapadButton, MacapadMediaKey } from "./types";

type Key = Omit<MacapadButton, "id">;

export interface MacapadTemplate {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  color: string; // .mps-ico color class
  keys: Key[]; // 15, in order
  pick: { small: number[]; big: number[] }; // indexes into keys: the best 4, the best 8
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
      media("previous", "skip_previous", "previous"),
      media("play / pause", "play_pause", "playPause"),
      media("next", "skip_next", "next"),
      media("volume down", "volume_down", "volumeDown"),
      media("volume up", "volume_up", "volumeUp"),
      media("mute", "volume_off", "mute"),
      app("music", "com.apple.Music"),
      app("spotify", "com.spotify.client"),
      app("podcasts", "com.apple.podcasts"),
      site("sound settings", "tune", "x-apple.systempreferences:com.apple.Sound-Settings.extension"),
      volume("volume 25%", 25),
      volume("volume 50%", 50),
      volume("volume 75%", 75),
      volume("volume max", 100),
      script("mic off", "mic_off", "set volume input volume 0"),
    ],
    pick: { small: [3, 4, 5, 1], big: [0, 1, 2, 5, 3, 4, 6, 7] },
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
      site("github", "merge", "https://github.com"),
      site("localhost", "dns", "http://localhost:3000"),
      app("activity", "com.apple.ActivityMonitor"),
      keys("commands", "keyboard_command_key", "cmd+shift+p"),
      keys("go to file", "description", "cmd+p"),
      keys("find in files", "search", "cmd+shift+f"),
      keys("comment", "edit_note", "cmd+/"),
      keys("format", "auto_awesome", "shift+opt+f"),
      keys("terminal panel", "web_asset", "ctrl+`"),
      keys("save all", "save_alt", "opt+cmd+s"),
      keys("definition", "arrow_forward", "f12"),
      keys("rename", "edit", "f2"),
      keys("split editor", "dashboard", "cmd+\\"),
    ],
    pick: { small: [0, 1, 5, 10], big: [0, 1, 2, 3, 5, 6, 7, 8] },
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
      keys("reload", "refresh", "cmd+r"),
      keys("new tab", "tab", "cmd+t"),
      keys("close tab", "close", "cmd+w"),
      keys("previous tab", "chevron_left", "ctrl+shift+tab"),
      keys("next tab", "chevron_right", "ctrl+tab"),
      keys("reopen tab", "history", "cmd+shift+t"),
      keys("address bar", "link", "cmd+l"),
      keys("bookmark", "bookmark", "cmd+d"),
      keys("new window", "open_in_new", "cmd+n"),
      keys("private", "visibility_off", "cmd+shift+n"),
      keys("find", "search", "cmd+f"),
      keys("zoom in", "zoom_in", "cmd+="),
      keys("zoom out", "zoom_out", "cmd+-"),
    ],
    pick: { small: [3, 4, 7, 2], big: [0, 1, 2, 3, 5, 6, 7, 4] },
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
      keys("raise hand", "flag", "opt+y"),
      keys("leave", "logout", "cmd+w"),
      keys("chat", "chat", "cmd+shift+h"),
      keys("people", "group", "cmd+u"),
      keys("gallery", "grid_view", "cmd+shift+w"),
      keys("full screen", "fullscreen", "cmd+shift+f"),
      keys("record", "videocam", "cmd+shift+r"),
      app("zoom", "us.zoom.xos"),
      app("calendar", "com.apple.iCal"),
      app("slack", "com.tinyspeck.slackmacgap"),
      app("mail", "com.apple.mail"),
      app("messages", "com.apple.MobileSMS"),
    ],
    pick: { small: [0, 1, 2, 4], big: [0, 1, 2, 4, 3, 5, 6, 10] },
  },
  {
    id: "mac",
    name: "Mac & windows",
    blurb: "Spaces, windows, screenshots, lock",
    icon: "desktop_mac",
    color: "orange",
    keys: [
      keys("mission control", "grid_view", "ctrl+up"),
      keys("app windows", "window", "ctrl+down"),
      keys("space left", "chevron_left", "ctrl+left"),
      keys("space right", "chevron_right", "ctrl+right"),
      keys("spotlight", "search", "cmd+space"),
      keys("minimize", "minimize", "cmd+m"),
      keys("hide app", "visibility_off", "cmd+h"),
      keys("quit app", "power_settings_new", "cmd+q"),
      keys("full screen", "fullscreen", "ctrl+cmd+f"),
      keys("next window", "web_asset", "cmd+`"),
      keys("screenshot", "screenshot_monitor", "cmd+shift+4"),
      keys("screen tools", "photo_camera", "cmd+shift+5"),
      keys("emoji", "mood", "ctrl+cmd+space"),
      keys("lock", "lock", "ctrl+cmd+q"),
      app("finder", "com.apple.finder"),
    ],
    pick: { small: [0, 4, 10, 13], big: [0, 2, 3, 4, 5, 8, 10, 13] },
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
      keys("cut", "content_cut", "cmd+x"),
      keys("copy", "content_copy", "cmd+c"),
      keys("paste", "content_paste", "cmd+v"),
      keys("select all", "select_all", "cmd+a"),
      keys("find", "search", "cmd+f"),
      keys("save", "save_alt", "cmd+s"),
      keys("bold", "format_paint", "cmd+b"),
      keys("italic", "draw", "cmd+i"),
      keys("plain paste", "content_paste", "opt+shift+cmd+v"),
      keys("underline", "edit", "cmd+u"),
      keys("new", "note", "cmd+n"),
      keys("print", "print", "cmd+p"),
      app("notes", "com.apple.Notes"),
    ],
    pick: { small: [3, 4, 0, 7], big: [0, 1, 3, 4, 2, 5, 6, 7] },
  },
];

/** The template's keys for a pad with `slots` slots, slot for slot (null =
 *  empty slot). Keys get ids from `id`, so the same template can be added
 *  more than once. */
export function templateButtons(
  template: MacapadTemplate,
  slots: number,
  id: (index: number) => string
): (MacapadButton | null)[] {
  const keys =
    slots <= 4
      ? template.pick.small.map((i) => template.keys[i])
      : slots <= 8
        ? template.pick.big.map((i) => template.keys[i])
        : template.keys;
  return Array.from({ length: slots }, (_, i) => (keys[i] ? { id: id(i), ...keys[i] } : null));
}
