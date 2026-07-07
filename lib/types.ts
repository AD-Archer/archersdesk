// Client-safe types shared between the server config layer and the UI.
// (lib/config.ts pulls in sqlite — never import that from client code.)

export const WIDGETS = [
  "clock",
  "date",
  "datetime",
  "calendar",
  "weather",
  "nowplaying",
  "alarms",
] as const;

export type WidgetName = (typeof WIDGETS)[number];

export interface Alarm {
  time: string; // "HH:MM" 24h
  label: string;
  days: string[]; // mon..sun, empty = every day
  enabled: boolean;
}

export interface DeskConfig {
  city: string;
  units: "fahrenheit" | "celsius";
  layout: {
    mode: "split" | "dual";
    left: WidgetName;
    right: WidgetName;
    dual: WidgetName;
  };
  standby: {
    show_temp: boolean;
    show_alarm: boolean;
  };
  lastfm: {
    username: string;
    api_key: string;
  };
  alarms: Alarm[];
}

export interface WeatherData {
  city: string;
  temp: number;
  feels: number;
  hi: number;
  lo: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  kind: string;
  label: string;
  units: string;
  error?: string;
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
