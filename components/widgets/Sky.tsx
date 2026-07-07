"use client";

import { useNow } from "../hooks";
import { clock12 } from "../alarmUtil";
import { useWeather } from "./Weather";
import type { WidgetProps } from "./registry";

// ── sunrise / sunset ─────────────────────────────────────────────────

export function SunWidget({ settings }: WidgetProps) {
  const wx = useWeather(settings);
  const now = useNow(60_000);

  let body: React.ReactNode;
  if (!wx || wx.error) {
    body = <div className="w-empty">{wx?.error ?? "reading the sky…"}</div>;
  } else {
    const rise = new Date(wx.sunrise).getTime();
    const set = new Date(wx.sunset).getTime();
    const p = Math.max(0, Math.min(1, (now.getTime() - rise) / (set - rise)));
    const up = now.getTime() >= rise && now.getTime() <= set;
    // arc from (20,95) to (180,95), radius 80
    const a = Math.PI * (1 - p);
    const sx = 100 + 80 * Math.cos(a);
    const sy = 95 - 80 * Math.sin(a);
    const riseT = clock12(new Date(rise));
    const setT = clock12(new Date(set));

    body = (
      <>
        <svg className="sun-svg" viewBox="0 0 200 108">
          <path
            d="M 20 95 A 80 80 0 0 1 180 95"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1.6"
            strokeDasharray="3 5"
          />
          <line x1="8" y1="95" x2="192" y2="95" stroke="var(--line)" strokeWidth="1.4" />
          {up && (
            <>
              <path
                d={`M 20 95 A 80 80 0 0 1 ${sx} ${sy}`}
                fill="none"
                stroke="var(--amber)"
                strokeWidth="2.4"
              />
              <circle cx={sx} cy={sy} r="7" fill="var(--amber)" />
              <circle cx={sx} cy={sy} r="12" fill="none" stroke="var(--amber)" strokeWidth="1" opacity="0.4" />
            </>
          )}
        </svg>
        <div className="sun-times">
          <div className="sun-t">
            <b>
              {riseT.time} {riseT.ampm}
            </b>
            <span>sunrise</span>
          </div>
          <div className="sun-t">
            <b>
              {setT.time} {setT.ampm}
            </b>
            <span>sunset</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <span className="w-label">sun · {settings.location.name}</span>
      <div className="w-body">{body}</div>
    </>
  );
}

// ── moon phase ───────────────────────────────────────────────────────

const SYNODIC = 29.53058867;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

function moonPhase(d: Date): number {
  const days = (d.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC; // 0 new → 0.5 full
}

function phaseName(p: number): string {
  if (p < 0.033 || p > 0.967) return "new moon";
  if (p < 0.217) return "waxing crescent";
  if (p < 0.283) return "first quarter";
  if (p < 0.467) return "waxing gibbous";
  if (p < 0.533) return "full moon";
  if (p < 0.717) return "waning gibbous";
  if (p < 0.783) return "last quarter";
  return "waning crescent";
}

/** Shadow path over a lit disc — the classic half-circle + ellipse trick. */
function shadowPath(p: number, cx: number, cy: number, r: number): string {
  const rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  const waxing = p < 0.5; // light grows on the right
  const outerSweep = waxing ? 0 : 1;
  const innerSweep = waxing ? (p < 0.25 ? 1 : 0) : p < 0.75 ? 0 : 1;
  return (
    `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} ` +
    `A ${rx} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`
  );
}

export function MoonWidget(_: WidgetProps) {
  const now = useNow(60_000);
  const p = moonPhase(now);
  const illum = Math.round(((1 - Math.cos(2 * Math.PI * p)) / 2) * 100);

  return (
    <>
      <span className="w-label">moon</span>
      <div className="w-body">
        <svg className="moon-svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="var(--cream)" opacity="0.92" />
          <path d={shadowPath(p, 60, 60, 52)} fill="var(--bg-2)" opacity="0.94" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />
        </svg>
        <div className="moon-name">{phaseName(p)}</div>
        <div className="moon-pct">{illum}% illuminated</div>
      </div>
    </>
  );
}
