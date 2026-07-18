"use client";

import type { CSSProperties } from "react";
import type { LayoutRow, ViewSettings, WidgetName } from "@/lib/types";
import { AdguardWidget, PiholeWidget } from "./Adblock";
import { ClockWidget, AnalogWidget, DateWidget, DatetimeWidget } from "./Clock";
import { CalendarWidget } from "./Calendar";
import { WeatherWidget, ForecastWidget } from "./Weather";
import { SunWidget, MoonWidget } from "./Sky";
import { WorldClockWidget } from "./WorldClock";
import { NowPlayingWidget } from "./NowPlaying";
import { AlarmsWidget } from "./Alarms";
import { TimerWidget } from "./Timer";
import { QuoteWidget } from "./Quote";
import { HomeAssistantWidget } from "./HomeAssistant";
import { SeerrWidget } from "./Seerr";
import { QbittorrentWidget, TransmissionWidget } from "./Torrents";
import { AgendaWidget } from "./Agenda";
import { EpicGamesWidget } from "./Epic";
import { NavidromeWidget } from "./Navidrome";
import { EmbedWidget } from "./Embed";
import {
  AwayUntilWidget,
  DoNotDisturbWidget,
  PleaseDisturbWidget,
  VibeWidget,
} from "./Status";
import {
  AnilistWidget,
  ChessWidget,
  GithubWidget,
  JellyfinWidget,
  PlexWidget,
  SeptaWidget,
  StocksWidget,
  WakatimeWidget,
} from "./Integrations";
import {
  CatFactWidget,
  CatWidget,
  CityBikesWidget,
  DogFactWidget,
  DogWidget,
  DuckWidget,
  F1Widget,
  FlightsWidget,
  FoxWidget,
  ShibeWidget,
  SpaceNewsWidget,
} from "./Feeds";

export interface WidgetProps {
  settings: ViewSettings;
  integrationSettings?: ViewSettings;
  wide?: boolean;
}

// name → component. to add a widget: entry in lib/types WIDGETS + WIDGET_INFO,
// a component here, and it's instantly pickable in settings → layout.
export const REGISTRY: Record<WidgetName, (p: WidgetProps) => React.ReactNode> = {
  clock: ClockWidget,
  analog: AnalogWidget,
  date: DateWidget,
  datetime: DatetimeWidget,
  calendar: CalendarWidget,
  weather: WeatherWidget,
  forecast: ForecastWidget,
  sun: SunWidget,
  moon: MoonWidget,
  worldclock: WorldClockWidget,
  nowplaying: NowPlayingWidget,
  alarms: AlarmsWidget,
  timer: TimerWidget,
  quote: QuoteWidget,
  dnd: DoNotDisturbWidget,
  please_disturb: PleaseDisturbWidget,
  away_until: AwayUntilWidget,
  vibe: VibeWidget,
  github: GithubWidget,
  chess: ChessWidget,
  stocks: StocksWidget,
  anilist: AnilistWidget,
  wakatime: WakatimeWidget,
  dog: DogWidget,
  cat: CatWidget,
  fox: FoxWidget,
  duck: DuckWidget,
  shibe: ShibeWidget,
  catfact: CatFactWidget,
  dogfact: DogFactWidget,
  spacenews: SpaceNewsWidget,
  f1: F1Widget,
  citybikes: CityBikesWidget,
  flights: FlightsWidget,
  septa: SeptaWidget,
  jellyfin: JellyfinWidget,
  plex: PlexWidget,
  adguard: AdguardWidget,
  pihole: PiholeWidget,
  homeassistant: HomeAssistantWidget,
  seerr: SeerrWidget,
  qbittorrent: QbittorrentWidget,
  transmission: TransmissionWidget,
  agenda: AgendaWidget,
  epicgames: EpicGamesWidget,
  navidrome: NavidromeWidget,
  embed: EmbedWidget,
};

export function MainRow({
  row,
  settings,
  integrationSettings,
}: {
  row: LayoutRow;
  settings: ViewSettings;
  integrationSettings?: ViewSettings;
}) {
  if (row.type === "dual") {
    const Widget = REGISTRY[row.widget] ?? ClockWidget;
    return (
      <div className="main-view">
        <section className="panel wide">
          <Widget settings={settings} integrationSettings={integrationSettings} wide />
        </section>
      </div>
    );
  }

  return (
    <div className="main-view">
      <WidgetPanel widget={row.left} settings={settings} integrationSettings={integrationSettings} slot="left" />
      <WidgetPanel widget={row.right} settings={settings} integrationSettings={integrationSettings} slot="right" />
    </div>
  );
}

export function WidgetPanel({
  widget,
  settings,
  integrationSettings,
  slot,
  style,
}: {
  widget: WidgetName;
  settings: ViewSettings;
  integrationSettings?: ViewSettings;
  slot: "left" | "right";
  style?: CSSProperties;
}) {
  const Widget = REGISTRY[widget] ?? ClockWidget;
  return (
    <section className="panel" data-slot={slot} style={style}>
      <Widget settings={settings} integrationSettings={integrationSettings} />
    </section>
  );
}
