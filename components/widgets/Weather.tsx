"use client";

import type { WeatherData } from "@/lib/types";
import { clock12 } from "../alarmUtil";
import { usePoll } from "../hooks";
import { Empty } from "./kit";
import type { WidgetProps } from "./registry";

export function WxIcon({ kind }: { kind: string }) {
  const s = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "clear":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
        </svg>
      );
    case "partly":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <circle cx="8.5" cy="8.5" r="3.4" />
          <path d="M8.5 2.4v1.7M2.4 8.5h1.7M4.2 4.2l1.2 1.2" />
          <path d="M9 17.5a4 4 0 0 1 7.6-1.7h.9a2.9 2.9 0 1 1 0 5.7H12A3 3 0 0 1 9 17.5z" />
        </svg>
      );
    case "cloudy":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M6.5 18a4.5 4.5 0 1 1 .8-8.9 5.5 5.5 0 0 1 10.6 1.6h.4a3.6 3.6 0 1 1 0 7.3H6.5z" />
        </svg>
      );
    case "fog":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M5 9.5a4 4 0 0 1 7.7-1.4 3.4 3.4 0 0 1 5.3 2.9" />
          <path d="M4 14h16M6 17.5h12M8 21h8" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M6.5 14a4.5 4.5 0 1 1 .8-8.9A5.5 5.5 0 0 1 17.9 6.7h.4a3.6 3.6 0 1 1 0 7.3H6.5z" />
          <path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3" />
        </svg>
      );
    case "snow":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M6.5 14a4.5 4.5 0 1 1 .8-8.9A5.5 5.5 0 0 1 17.9 6.7h.4a3.6 3.6 0 1 1 0 7.3H6.5z" />
          <path d="M8.5 18.2v.01M12.5 20v.01M16.5 18.2v.01M10.5 21v.01M14.5 21v.01" strokeWidth="2.4" />
        </svg>
      );
    case "storm":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <path d="M6.5 13a4.5 4.5 0 1 1 .8-8.9A5.5 5.5 0 0 1 17.9 5.7h.4a3.6 3.6 0 1 1 0 7.3h-2" />
          <path d="M12.5 11l-2.8 4.6h3l-1.8 4.4 4.8-6h-3l1.6-3z" />
        </svg>
      );
    default:
      return null;
  }
}

export function useWeather(settings: WidgetProps["settings"]): WeatherData | null {
  return usePoll<WeatherData>(`/api/weather?device=${encodeURIComponent(settings.deviceId)}`, 10 * 60 * 1000, [
    settings.deviceId,
    settings.location.latitude,
    settings.location.longitude,
    settings.units,
  ]);
}

function sunTime(iso: string) {
  const { time, ampm } = clock12(new Date(iso));
  return `${time} ${ampm}`;
}

const DOW_LONG: Record<string, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

/** iOS weather: the city in the tint, a huge white temperature, then the
 *  condition and today's high and low. Wide adds humidity and wind. */
export function WeatherWidget({ settings, wide }: WidgetProps) {
  const wx = useWeather(settings);

  const body = !wx ? (
    <Empty icon="cloud">Reading the sky…</Empty>
  ) : wx.error ? (
    <Empty icon="cloud">{wx.error}</Empty>
  ) : (
    <div className={`wx${wide ? " wide" : ""}`}>
      <div className="wx-now">
        <div className="wx-temp">
          {wx.temp}
          <span className="wx-deg">°</span>
        </div>
        <div className="wx-foot">
          <span className="wx-icon">
            <WxIcon kind={wx.kind} />
          </span>
          <div className="wx-cond">{wx.label}</div>
          <div className="wx-hilo">
            H:{wx.hi}° L:{wx.lo}°
          </div>
        </div>
      </div>
      {wide && (
        <div className="wx-more">
          <div className="wx-more-row">
            <span>Humidity</span>
            <b>{wx.humidity}%</b>
          </div>
          <div className="wx-more-row">
            <span>Wind</span>
            <b>
              {wx.wind} {wx.units === "celsius" ? "km/h" : "mph"}
            </b>
          </div>
          <div className="wx-more-row">
            <span>Sunrise</span>
            <b>{sunTime(wx.sunrise)}</b>
          </div>
          <div className="wx-more-row">
            <span>Sunset</span>
            <b>{sunTime(wx.sunset)}</b>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <span className="w-label show">{wx && !wx.error ? wx.city : settings.location.name}</span>
      <div className="w-body">{body}</div>
    </>
  );
}

/** iOS's daily forecast list: day, icon, low, a range bar, high. */
export function ForecastWidget({ settings, wide }: WidgetProps) {
  const wx = useWeather(settings);
  const days = wx && !wx.error ? wx.days : [];
  const min = Math.min(...days.map((d) => d.lo));
  const max = Math.max(...days.map((d) => d.hi));
  const span = Math.max(1, max - min);

  return (
    <>
      <span className="w-label">Forecast · {settings.location.name}</span>
      <div className="w-body">
        {!wx ? (
          <Empty icon="cloud">Reading the sky…</Empty>
        ) : wx.error ? (
          <Empty icon="cloud">{wx.error}</Empty>
        ) : (
          <div className={`fc${wide ? " wide" : ""}`}>
            {days.map((d) => (
              <div key={d.date} className="fc-day">
                <span className="fc-dow">{DOW_LONG[d.dow] ?? d.dow}</span>
                <span className="fc-icon">
                  <WxIcon kind={d.kind} />
                </span>
                <span className="fc-lo">{d.lo}°</span>
                <span className="fc-bar" aria-hidden>
                  <i
                    style={{
                      left: `${((d.lo - min) / span) * 100}%`,
                      right: `${((max - d.hi) / span) * 100}%`,
                    }}
                  />
                </span>
                <span className="fc-hi">{d.hi}°</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
