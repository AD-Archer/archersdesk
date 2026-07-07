"use client";

import type { CSSProperties } from "react";
import type { LayoutRow, Settings, WidgetName } from "@/lib/types";
import { ClockWidget, AnalogWidget, DateWidget, DatetimeWidget } from "./Clock";
import { CalendarWidget } from "./Calendar";
import { WeatherWidget, ForecastWidget } from "./Weather";
import { SunWidget, MoonWidget } from "./Sky";
import { WorldClockWidget } from "./WorldClock";
import { NowPlayingWidget } from "./NowPlaying";
import { AlarmsWidget } from "./Alarms";
import { TimerWidget } from "./Timer";
import { QuoteWidget } from "./Quote";
import {
  AwayUntilWidget,
  DoNotDisturbWidget,
  LunchWidget,
  PleaseDisturbWidget,
  VibeWidget,
} from "./Status";

export interface WidgetProps {
  settings: Settings;
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
  lunch: LunchWidget,
  away_until: AwayUntilWidget,
  vibe: VibeWidget,
};

export function MainRow({ row, settings }: { row: LayoutRow; settings: Settings }) {
  if (row.type === "dual") {
    const Widget = REGISTRY[row.widget] ?? ClockWidget;
    return (
      <div className="main-view">
        <section className="panel wide">
          <Widget settings={settings} wide />
        </section>
      </div>
    );
  }

  return (
    <div className="main-view">
      <WidgetPanel widget={row.left} settings={settings} slot="left" />
      <WidgetPanel widget={row.right} settings={settings} slot="right" />
    </div>
  );
}

export function WidgetPanel({
  widget,
  settings,
  slot,
  style,
}: {
  widget: WidgetName;
  settings: Settings;
  slot: "left" | "right";
  style?: CSSProperties;
}) {
  const Widget = REGISTRY[widget] ?? ClockWidget;
  return (
    <section className="panel" data-slot={slot} style={style}>
      <Widget settings={settings} />
    </section>
  );
}
