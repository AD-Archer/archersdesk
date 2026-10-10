// Regenerates app/fonts/material-symbols.woff2: a Material Symbols Rounded
// subset holding only the icon names below. It's the static default style
// (weight 400, no fill, grade 0, 24px optical size) — the app never varies
// those, and dropping the variable axes makes the font several times smaller.
// Add a name here, then run: pnpm icon-font
// Names: https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ICONS = [
  // widgets, settings, status
  "access_alarm", "access_alarms", "access_time", "access_time_filled", "alarm", "audiotrack", "av_timer",
  "calendar_today", "chess", "cloud", "cloud_queue", "cloudy", "cloudy_filled", "code", "dark_mode",
  "date_range", "do_disturb_on", "do_not_disturb_on", "download", "file_download", "flight", "format_quote",
  "get_app", "home", "home_filled", "insert_emoticon", "keyboard", "light_mode", "lightbulb",
  "lightbulb_outline", "live_tv", "local_fire_department", "logout", "menu_book", "mood", "movie",
  "movie_creation", "music_note", "notifications_active", "ondemand_video", "pedal_bike", "pets",
  "play_circle", "public", "query_builder", "remove_circle", "remove_circle_outline", "restaurant",
  "rocket_launch", "save_alt", "schedule", "shield", "sports_motorsports", "tag_faces", "thermostat",
  "timer", "today", "train", "trending_up", "watch_later", "wb_cloudy",
  // macapad buttons
  "add", "apps", "arrow_back", "arrow_downward", "arrow_forward", "arrow_upward", "bolt", "brush", "chat",
  "check", "close", "coffee", "content_copy", "content_paste", "delete", "desktop_mac", "edit", "favorite",
  "folder", "grid_view", "headphones", "keyboard_command_key", "language", "link", "lock", "mail", "mic",
  "mic_off", "open_in_new", "pause", "photo_camera", "play_arrow", "play_pause", "power_settings_new",
  "refresh", "repeat", "screenshot_monitor", "search", "settings", "shuffle", "skip_next", "skip_previous",
  "smart_toy", "sports_esports", "star", "tab", "terminal", "undo", "videocam", "volume_down", "volume_mute",
  "volume_off", "volume_up", "web", "wifi", "work", "content_cut", "redo", "select_all",
  // macapad icon picker (searchable)
  "photo", "image", "movie_filter", "tv", "cast", "speaker", "radio", "podcasts", "library_music",
  "queue_music", "playlist_play", "album", "fast_forward", "fast_rewind", "replay", "stop", "graphic_eq",
  "equalizer", "computer", "laptop", "smartphone", "tablet", "watch", "mouse", "print", "headset_mic",
  "bluetooth", "usb", "battery_full", "power", "brightness_high", "brightness_low", "contrast", "bedtime",
  "notifications", "notifications_off", "visibility", "visibility_off", "fingerprint", "key", "security",
  "calendar_month", "event", "hourglass_empty", "history", "update", "sync", "cloud_upload",
  "cloud_download", "upload", "share", "send", "inbox", "forum", "call", "videocam_off", "group", "person",
  "account_circle", "face", "edit_note", "note", "description", "article", "sticky_note_2", "checklist",
  "task_alt", "list", "bookmark", "label", "flag", "push_pin", "shopping_cart", "payments", "credit_card",
  "attach_money", "savings", "map", "place", "navigation", "directions_car", "directions_bike",
  "directions_walk", "local_cafe", "local_bar", "fastfood", "cake", "fitness_center", "sports_soccer",
  "sports_basketball", "pool", "spa", "self_improvement", "school", "science", "calculate", "psychology",
  "auto_awesome", "palette", "format_paint", "draw", "architecture", "build", "construction", "handyman",
  "bug_report", "dns", "storage", "database", "memory", "developer_board", "api", "data_object", "webhook",
  "lan", "router", "wifi_off", "zoom_in", "zoom_out", "fullscreen", "fullscreen_exit", "minimize",
  "open_in_full", "close_fullscreen", "crop", "rotate_right", "chevron_left", "chevron_right",
  "expand_more", "expand_less", "login", "exit_to_app", "cottage", "apartment", "garage", "door_front",
  "bed", "weekend", "chair", "kitchen", "light", "floor_lamp", "ac_unit", "water_drop", "eco", "park",
  "sunny", "rainy", "thunderstorm", "emoji_emotions", "celebration", "translate", "casino", "extension",
  "toys", "pending", "hourglass_top", "record_voice_over", "tune", "more_horiz", "menu", "dashboard",
  "widgets", "window", "open_in_browser", "web_asset", "call_split", "merge", "mic_external_on",
  "keyboard_voice", "screen_share", "stop_screen_share", "desktop_windows", "monitor", "dock",
];

const names = [...new Set(ICONS)].sort(); // the api wants them sorted
const css = await fetch(
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" +
    `&icon_names=${names.join(",")}&display=block`,
  // a modern browser UA, or google serves ttf instead of woff2
  { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" } }
).then((r) => {
  if (!r.ok) throw new Error(`google fonts: ${r.status}`);
  return r.text();
});

const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!url) throw new Error("no woff2 url in google fonts response");
const font = Buffer.from(await (await fetch(url)).arrayBuffer());
writeFileSync(join(ROOT, "app/fonts/material-symbols.woff2"), font);
console.log(`wrote app/fonts/material-symbols.woff2 (${names.length} icons, ${(font.length / 1024).toFixed(1)} KB)`);
