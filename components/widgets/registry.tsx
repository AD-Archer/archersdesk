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
import { MacapadWidget } from "./Macapad";
import { SeerrWidget } from "./Seerr";
import { QbittorrentWidget, TransmissionWidget } from "./Torrents";
import { AgendaWidget } from "./Agenda";
import { EpicGamesWidget } from "./Epic";
import { NavidromeWidget } from "./Navidrome";
import { EmbedWidget } from "./Embed";
import { MonkeytypeWidget } from "./Monkeytype";
import { ArcherHoursWidget } from "./hackclub/ArcherHours";
import {
  PhantomActiveWidget,
  PhantomFunnelWidget,
  PhantomHoursWidget,
  PhantomLedgerWidget,
  PhantomMoneyWidget,
  PhantomBudgetWidget,
  PhantomEventWidget,
  PhantomOrdersWidget,
  PhantomPeopleWidget,
  PhantomProjectsWidget,
  PhantomTrafficWidget,
} from "./hackclub/programs/Phantom";
import {
  SternFinesWidget,
  SternMarginWidget,
  SternNetWorthWidget,
  SternTimelineWidget,
  SternTopWidget,
  SternWeekWidget,
  SternWpsWidget,
} from "./hackclub/stern/You";
import {
  SternActiveWidget,
  SternFunnelWidget,
  SternHoursWidget,
  SternMoneyWidget,
  SternOrdersWidget,
  SternPeopleWidget,
  SternProgramWidget,
  SternProgramWpsWidget,
  SternReviewWidget,
} from "./hackclub/stern/Program";
import {
  AwayUntilWidget,
  DoNotDisturbWidget,
  PleaseDisturbWidget,
  VibeWidget,
} from "./Status";
import {
  AnilistWidget,
  ChessWidget,
  LichessWidget,
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
  /** the page's hack club program (DeviceLayout.programs); program widgets show it */
  program?: string;
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
  lichess: LichessWidget,
  stocks: StocksWidget,
  anilist: AnilistWidget,
  wakatime: WakatimeWidget,
  monkeytype: MonkeytypeWidget,
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
  macapad: MacapadWidget,
  seerr: SeerrWidget,
  qbittorrent: QbittorrentWidget,
  transmission: TransmissionWidget,
  agenda: AgendaWidget,
  epicgames: EpicGamesWidget,
  navidrome: NavidromeWidget,
  embed: EmbedWidget,
  archerhours: ArcherHoursWidget,
  phantom_traffic: PhantomTrafficWidget,
  phantom_active: PhantomActiveWidget,
  phantom_hours: PhantomHoursWidget,
  phantom_people: PhantomPeopleWidget,
  phantom_orders: PhantomOrdersWidget,
  phantom_projects: PhantomProjectsWidget,
  phantom_funnel: PhantomFunnelWidget,
  phantom_ledger: PhantomLedgerWidget,
  phantom_money: PhantomMoneyWidget,
  phantom_budget: PhantomBudgetWidget,
  phantom_event: PhantomEventWidget,
  stern_wps: SternWpsWidget,
  stern_week: SternWeekWidget,
  stern_top: SternTopWidget,
  stern_networth: SternNetWorthWidget,
  stern_fines: SternFinesWidget,
  stern_timeline: SternTimelineWidget,
  stern_margin: SternMarginWidget,
  stern_program: SternProgramWidget,
  stern_program_wps: SternProgramWpsWidget,
  stern_people: SternPeopleWidget,
  stern_active: SternActiveWidget,
  stern_review: SternReviewWidget,
  stern_hours: SternHoursWidget,
  stern_orders: SternOrdersWidget,
  stern_funnel: SternFunnelWidget,
  stern_money: SternMoneyWidget,
};

export function MainRow({
  row,
  settings,
  integrationSettings,
  program,
}: {
  row: LayoutRow;
  settings: ViewSettings;
  integrationSettings?: ViewSettings;
  program?: string;
}) {
  if (row.type === "dual") {
    const Widget = REGISTRY[row.widget] ?? ClockWidget;
    return (
      <div className="main-view">
        <section className="panel wide" data-widget={row.widget}>
          <Widget settings={settings} integrationSettings={integrationSettings} program={program} wide />
        </section>
      </div>
    );
  }

  return (
    <div className="main-view">
      <WidgetPanel widget={row.left} settings={settings} integrationSettings={integrationSettings} program={program} slot="left" />
      <WidgetPanel widget={row.right} settings={settings} integrationSettings={integrationSettings} program={program} slot="right" />
    </div>
  );
}

export function WidgetPanel({
  widget,
  settings,
  integrationSettings,
  program,
  slot,
  style,
}: {
  widget: WidgetName;
  settings: ViewSettings;
  integrationSettings?: ViewSettings;
  program?: string;
  slot: "left" | "right";
  style?: CSSProperties;
}) {
  const Widget = REGISTRY[widget] ?? ClockWidget;
  return (
    <section className="panel" data-slot={slot} data-widget={widget} style={style}>
      <Widget settings={settings} integrationSettings={integrationSettings} program={program} />
    </section>
  );
}
