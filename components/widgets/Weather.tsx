"use client";

import type { WeatherData } from "@/lib/types";
import { usePoll } from "../hooks";
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

export function WeatherWidget({ config, wide }: WidgetProps) {
  const wx = usePoll<WeatherData>("/api/weather", 10 * 60 * 1000, [config.city, config.units]);

  const body = !wx ? (
    <div className="w-empty">reading the sky…</div>
  ) : wx.error ? (
    <div className="w-empty">{wx.error}</div>
  ) : (
    <div className={wide ? "wx-row" : undefined} style={wide ? undefined : { display: "contents" }}>
      <div className="wx-icon">
        <WxIcon kind={wx.kind} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="wx-temp">
          {wx.temp}
          <sup>°</sup>
        </div>
        <div className="wx-cond">{wx.label}</div>
      </div>
      <div className="wx-meta">
        <span>
          <b>{wx.hi}°</b> hi
        </span>
        <span>
          <b>{wx.lo}°</b> lo
        </span>
        {wide && (
          <>
            <span>
              <b>{wx.humidity}%</b> hum
            </span>
            <span>
              <b>{wx.wind}</b> {wx.units === "celsius" ? "km/h" : "mph"}
            </span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span className="w-label">{wx && !wx.error ? wx.city : config.city}</span>
      <div className="w-body" style={{ gap: "0.5vmin" }}>
        {body}
      </div>
    </>
  );
}
