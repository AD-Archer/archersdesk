"use client";

import type { DeskConfig, WidgetName } from "@/lib/types";
import { ClockWidget, DateWidget, DatetimeWidget } from "./Clock";
import { CalendarWidget } from "./Calendar";
import { WeatherWidget } from "./Weather";
import { NowPlayingWidget } from "./NowPlaying";
import { AlarmsWidget } from "./Alarms";

export interface WidgetProps {
  config: DeskConfig;
  wide?: boolean;
}

// yaml name → component. add a widget here + in lib/types WIDGETS and it's
// immediately usable from everyone's config.
export const REGISTRY: Record<WidgetName, (p: WidgetProps) => React.ReactNode> = {
  clock: ClockWidget,
  date: DateWidget,
  datetime: DatetimeWidget,
  calendar: CalendarWidget,
  weather: WeatherWidget,
  nowplaying: NowPlayingWidget,
  alarms: AlarmsWidget,
};

export function MainView({ config }: { config: DeskConfig }) {
  const { layout } = config;

  if (layout.mode === "dual") {
    const Widget = REGISTRY[layout.dual] ?? ClockWidget;
    return (
      <div className="main-view">
        <section className="panel wide">
          <Widget config={config} wide />
        </section>
      </div>
    );
  }

  const Left = REGISTRY[layout.left] ?? CalendarWidget;
  const Right = REGISTRY[layout.right] ?? NowPlayingWidget;
  return (
    <div className="main-view">
      <section className="panel">
        <Left config={config} />
      </section>
      <section className="panel">
        <Right config={config} />
      </section>
    </div>
  );
}
