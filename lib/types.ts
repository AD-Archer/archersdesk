// Client-safe types shared between the server settings layer and the UI.
// (lib/settings.ts pulls in sqlite — never import that from client code.)

export const WIDGETS = [
  "clock",
  "analog",
  "date",
  "datetime",
  "calendar",
  "weather",
  "forecast",
  "sun",
  "moon",
  "worldclock",
  "nowplaying",
  "alarms",
  "timer",
  "quote",
  "dnd",
  "please_disturb",
  "away_until",
  "vibe",
  "github",
  "chess",
  "stocks",
  "anilist",
  "wakatime",
  "dog",
  "cat",
  "fox",
  "duck",
  "shibe",
  "catfact",
  "dogfact",
  "spacenews",
  "f1",
  "citybikes",
  "flights",
  "septa",
  "jellyfin",
  "plex",
  "adguard",
  "pihole",
  "homeassistant",
  "seerr",
  "qbittorrent",
  "transmission",
  "agenda",
  "epicgames",
] as const;

export type WidgetName = (typeof WIDGETS)[number];

/** Picker categories, in display order. */
export const WIDGET_CATEGORIES = [
  { key: "time", label: "time & date" },
  { key: "sky", label: "sky & weather" },
  { key: "tools", label: "tools" },
  { key: "status", label: "status signs" },
  { key: "accounts", label: "your accounts" },
  { key: "feeds", label: "feeds & fun" },
] as const;

export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number]["key"];

export const WIDGET_INFO: Record<
  WidgetName,
  { label: string; blurb: string; category: WidgetCategory; icon: string }
> = {
  clock: { label: "clock", blurb: "big digital time", category: "time", icon: "schedule" },
  analog: { label: "analog", blurb: "sweeping hands", category: "time", icon: "av_timer" },
  date: { label: "date", blurb: "today, huge", category: "time", icon: "today" },
  datetime: { label: "date & time", blurb: "both stacked", category: "time", icon: "date_range" },
  worldclock: { label: "world clock", blurb: "elsewhere right now", category: "time", icon: "public" },
  weather: { label: "weather", blurb: "now + hi/lo", category: "sky", icon: "thermostat" },
  forecast: { label: "forecast", blurb: "next five days", category: "sky", icon: "cloud" },
  sun: { label: "sun", blurb: "sunrise → sunset", category: "sky", icon: "light_mode" },
  moon: { label: "moon", blurb: "tonight's phase", category: "sky", icon: "dark_mode" },
  calendar: { label: "calendar", blurb: "month at a glance", category: "tools", icon: "calendar_today" },
  alarms: { label: "alarms", blurb: "what's ringing next", category: "tools", icon: "alarm" },
  timer: { label: "timer", blurb: "tap-to-start countdown", category: "tools", icon: "timer" },
  quote: { label: "quote", blurb: "a line a day", category: "tools", icon: "format_quote" },
  dnd: { label: "do not disturb", blurb: "quiet status sign", category: "status", icon: "do_not_disturb_on" },
  please_disturb: { label: "please disturb", blurb: "interruptions welcome", category: "status", icon: "notifications_active" },
  away_until: { label: "away until", blurb: "editable return time", category: "status", icon: "logout" },
  vibe: { label: "vibe check", blurb: "general fun status", category: "status", icon: "mood" },
  nowplaying: { label: "now playing", blurb: "last.fm / navidrome", category: "accounts", icon: "music_note" },
  github: { label: "github", blurb: "your recent activity", category: "accounts", icon: "code" },
  chess: { label: "chess.com", blurb: "ratings at a glance", category: "accounts", icon: "chess" },
  stocks: { label: "stocks", blurb: "tickers you watch", category: "accounts", icon: "trending_up" },
  anilist: { label: "anilist", blurb: "anime + manga stats", category: "accounts", icon: "menu_book" },
  wakatime: { label: "wakatime", blurb: "today's coding time", category: "accounts", icon: "keyboard" },
  dog: { label: "dog cam", blurb: "a fresh dog, often", category: "feeds", icon: "pets" },
  cat: { label: "cat cam", blurb: "cat as a service", category: "feeds", icon: "pets" },
  fox: { label: "fox cam", blurb: "random foxes", category: "feeds", icon: "pets" },
  duck: { label: "duck cam", blurb: "random ducks", category: "feeds", icon: "pets" },
  shibe: { label: "shibe cam", blurb: "shiba inu supply", category: "feeds", icon: "pets" },
  catfact: { label: "cat facts", blurb: "feline trivia", category: "feeds", icon: "lightbulb" },
  dogfact: { label: "dog facts", blurb: "canine trivia", category: "feeds", icon: "lightbulb" },
  spacenews: { label: "space news", blurb: "spaceflight headlines", category: "feeds", icon: "rocket_launch" },
  f1: { label: "formula 1", blurb: "next race + standings", category: "feeds", icon: "sports_motorsports" },
  citybikes: { label: "city bikes", blurb: "bikes near you", category: "feeds", icon: "pedal_bike" },
  flights: { label: "overhead", blurb: "aircraft above you now", category: "feeds", icon: "flight" },
  septa: { label: "septa", blurb: "next trains at your station", category: "feeds", icon: "train" },
  jellyfin: { label: "jellyfin", blurb: "what's streaming now", category: "accounts", icon: "play_circle" },
  plex: { label: "plex", blurb: "what's streaming now", category: "accounts", icon: "live_tv" },
  adguard: { label: "adguard home", blurb: "dns queries blocked today", category: "accounts", icon: "shield" },
  pihole: { label: "pi-hole", blurb: "dns queries blocked today", category: "accounts", icon: "shield" },
  homeassistant: { label: "home assistant", blurb: "entities you pick, tap to toggle", category: "accounts", icon: "home" },
  seerr: { label: "seerr", blurb: "jellyseerr / overseerr requests", category: "accounts", icon: "movie" },
  qbittorrent: { label: "qbittorrent", blurb: "torrents, speed & ratio", category: "accounts", icon: "download" },
  transmission: { label: "transmission", blurb: "torrents, speed & ratio", category: "accounts", icon: "download" },
  agenda: { label: "agenda", blurb: "your calendars, next few days", category: "tools", icon: "calendar_today" },
  epicgames: { label: "epic free games", blurb: "free this week + next", category: "feeds", icon: "play_circle" },
};

export const THEMES = ["ember", "moonlight", "meadow", "rose", "paper"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_INFO: Record<ThemeName, { label: string; blurb: string }> = {
  ember: { label: "ember", blurb: "warm black · amber" },
  moonlight: { label: "moonlight", blurb: "cool night · ice blue" },
  meadow: { label: "meadow", blurb: "deep green · sage" },
  rose: { label: "rose", blurb: "dark plum · blush" },
  paper: { label: "paper", blurb: "daylight · ink & clay" },
};

export interface Alarm {
  time: string; // "HH:MM" 24h
  label: string;
  days: string[]; // mon..sun, empty = every day
  enabled: boolean;
  devices: string[]; // device ids that respond; empty = all devices
}

/** Fun status moods shown by the vibe widget / remote. */
export const VIBES = ["joyful", "sad", "stressed", "calm", "busy", "mysterious"] as const;
export type Vibe = (typeof VIBES)[number];

export interface Location {
  name: string;
  region: string; // "Vermont · United States"
  latitude: number;
  longitude: number;
}

export interface WorldClockZone {
  label: string;
  tz: string; // IANA zone
}

export interface CalendarFeed {
  id: string;
  name: string;
  url: string; // ical/ics feed url (webcal:// is rewritten to https://)
  enabled: boolean;
}

/** One vertically-swipeable row of the main view: two squares or one wide. */
export type LayoutRow =
  | { type: "split"; left: WidgetName; right: WidgetName }
  | { type: "dual"; widget: WidgetName };

export const MAX_ROWS = 12;
export const WIDGET_PAGE_COUNT = 2;

/** Live, server-synced status for one device. Pushed by the remote. */
export interface Presence {
  awayUntil: string | null; // ISO; null = not away. Forces the away screen while in the future.
  awayLocation: string; // free-text "where I am" note
  vibe: Vibe;
}

/** A named logical display/profile. A browser chooses which device it *is*
 *  (see localStorage `archersdesk.deviceId`); several browsers may share one. */
export interface Device {
  id: string;
  name: string;
  theme: ThemeName;
  location: Location;
  layout: {
    rows: LayoutRow[]; // legacy page-1 shape
    pages: LayoutRow[][];
  };
  standby: {
    showTemp: boolean;
    showAlarm: boolean;
  };
  presence: Presence;
}

export interface Settings {
  version: number; // monotonic; bumped on every write for poll compare-and-refetch
  devices: Device[];
  presets: LayoutRow[][]; // shared layout-preset library (account-global)
  units: "fahrenheit" | "celsius";
  lastfm: {
    username: string;
    apiKey: string; // per-user secret override; server LASTFM_API_KEY is the default
  };
  integrations: {
    github: { username: string; token: string };
    chess: { username: string };
    stocks: { symbols: string[] };
    anilist: { username: string };
    wakatime: { apiKey: string; apiUrl: string }; // apiUrl → wakapi/hackatime
    septa: { station: string };
    jellyfin: { url: string; apiKey: string; username: string; password: string };
    plex: { url: string; token: string };
    adguard: { url: string; username: string; password: string };
    pihole: { url: string; password: string };
    homeassistant: { url: string; token: string; entities: string }; // comma-separated entity ids
    seerr: { url: string; apiKey: string };
    qbittorrent: { url: string; apiKey: string; username: string; password: string };
    transmission: { url: string; username: string; password: string };
  };
  alarms: Alarm[];
  worldclock: WorldClockZone[];
  calendars: CalendarFeed[];
  showEpicInAgenda: boolean; // inject epic free-games as events in the agenda
}

/** The flattened, per-active-device shape the client actually renders from:
 *  every account-global field, plus the active device's own theme/location/
 *  layout/standby/presence hoisted to the top level. Widgets read this, so a
 *  widget can keep reading `settings.location` etc. unchanged. Built by
 *  `toView`; folded back into a canonical `Settings` by `fromView` (lib/view). */
export interface ViewSettings {
  deviceId: string;
  deviceName: string;
  theme: ThemeName;
  location: Location;
  layout: { rows: LayoutRow[]; pages: LayoutRow[][] };
  standby: { showTemp: boolean; showAlarm: boolean };
  presence: Presence;
  units: Settings["units"];
  lastfm: Settings["lastfm"];
  integrations: Settings["integrations"];
  alarms: Alarm[];
  worldclock: WorldClockZone[];
  calendars: CalendarFeed[];
  showEpicInAgenda: boolean;
  presets: LayoutRow[][];
  devices: Device[]; // full list, for the device switcher / remote / settings
  version: number;
}

export type IntegrationService = keyof Settings["integrations"];

/** Keyless public feeds served through the same proxy as integrations.
 *  `agenda` (calendars) and `epicgames` also ride this proxy path. */
export const FEED_SERVICES = [
  "dog",
  "cat",
  "fox",
  "duck",
  "shibe",
  "catfact",
  "dogfact",
  "spacenews",
  "f1",
  "citybikes",
  "flights",
  "agenda",
  "epicgames",
] as const;

export type FeedService = (typeof FEED_SERVICES)[number];
export type ProxyService = IntegrationService | FeedService;

/** Standard envelope every /api/integrations/<service> response uses. */
export interface IntegrationPayload<T = unknown> {
  configured: boolean;
  reason?: string;
  data?: T;
}

export interface DayForecast {
  date: string;
  dow: string; // "mon"
  hi: number;
  lo: number;
  kind: string;
}

export interface WeatherData {
  city: string;
  temp: number;
  feels: number;
  hi: number;
  lo: number;
  humidity: number;
  wind: number;
  isDay: boolean;
  kind: string;
  label: string;
  units: string;
  sunrise: string; // local ISO
  sunset: string;
  days: DayForecast[];
  error?: string;
}

export interface GeocodeResult {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface NowPlayingData {
  configured: boolean;
  playing?: boolean;
  reason?: string;
  track?: {
    name: string;
    artist: string;
    album: string;
    art: string;
    url: string;
    playedAt: number | null;
  } | null;
}
