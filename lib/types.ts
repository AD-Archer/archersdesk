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
] as const;

export type WidgetName = (typeof WIDGETS)[number];

export const WIDGET_INFO: Record<WidgetName, { label: string; blurb: string }> = {
  clock: { label: "clock", blurb: "big digital time" },
  analog: { label: "analog", blurb: "sweeping hands" },
  date: { label: "date", blurb: "today, huge" },
  datetime: { label: "date & time", blurb: "both stacked" },
  calendar: { label: "calendar", blurb: "month at a glance" },
  weather: { label: "weather", blurb: "now + hi/lo" },
  forecast: { label: "forecast", blurb: "next five days" },
  sun: { label: "sun", blurb: "sunrise → sunset" },
  moon: { label: "moon", blurb: "tonight's phase" },
  worldclock: { label: "world clock", blurb: "elsewhere right now" },
  nowplaying: { label: "now playing", blurb: "last.fm / navidrome" },
  alarms: { label: "alarms", blurb: "what's ringing next" },
  timer: { label: "timer", blurb: "tap-to-start countdown" },
  quote: { label: "quote", blurb: "a line a day" },
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
  alarms: Alarm[];
  worldclock: WorldClockZone[];
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
