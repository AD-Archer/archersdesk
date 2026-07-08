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
  "lunch",
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
  lunch: { label: "at lunch", blurb: "back after a bite", category: "status", icon: "restaurant" },
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
}

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

/** One vertically-swipeable row of the main view: two squares or one wide. */
export type LayoutRow =
  | { type: "split"; left: WidgetName; right: WidgetName }
  | { type: "dual"; widget: WidgetName };

export const MAX_ROWS = 6;

export interface Settings {
  theme: ThemeName;
  location: Location;
  units: "fahrenheit" | "celsius";
  layout: {
    rows: LayoutRow[];
  };
  standby: {
    showTemp: boolean;
    showAlarm: boolean;
  };
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
  };
  alarms: Alarm[];
  worldclock: WorldClockZone[];
}

export type IntegrationService = keyof Settings["integrations"];

/** Keyless public feeds served through the same proxy as integrations. */
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
