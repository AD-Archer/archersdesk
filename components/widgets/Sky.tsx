"use client";

import { useNow } from "../hooks";
import { clock12 } from "../alarmUtil";
import { useWeather } from "./Weather";
import { BigTime, Empty } from "./kit";
import type { WidgetProps } from "./registry";

// ── sunrise / sunset ─────────────────────────────────────────────────

/** The next sun event as the hero time (in the tint), the day's arc over the
 *  horizon with the sun riding it, and the other event underneath. */
export function SunWidget({ settings, wide }: WidgetProps) {
  const wx = useWeather(settings);
  const now = useNow(60_000);

  let body: React.ReactNode;
  if (!wx || wx.error) {
    body = <Empty icon="light_mode">{wx?.error ?? "Reading the sky…"}</Empty>;
  } else {
    const rise = new Date(wx.sunrise).getTime();
    const set = new Date(wx.sunset).getTime();
    const t = now.getTime();
    const p = Math.max(0, Math.min(1, (t - rise) / (set - rise)));
    const up = t >= rise && t <= set;
    // arc from (16,100) to (184,100), radius 84
    const a = Math.PI * (1 - p);
    const sx = 100 + 84 * Math.cos(a);
    const sy = 100 - 84 * Math.sin(a);
    const riseT = clock12(new Date(rise));
    const setT = clock12(new Date(set));
    // before sunrise or after sunset the next thing is a sunrise
    const nextIsSet = up;
    const hero = nextIsSet ? setT : riseT;
    const other = nextIsSet ? riseT : setT;

    body = (
      <div className={`sun${wide ? " wide" : ""}`}>
        <svg className="sun-svg" viewBox="0 0 200 108" aria-hidden>
          <path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            stroke="var(--fill-3)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="0.1 8"
          />
          <line x1="2" y1="100" x2="198" y2="100" stroke="var(--label-3)" strokeWidth="1.5" />
          {up && (
            <>
              <path
                d={`M 16 100 A 84 84 0 0 1 ${sx} ${sy}`}
                fill="none"
                stroke="var(--tint)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={sx} cy={sy} r="9" fill="var(--tint)" />
            </>
          )}
        </svg>
        <div className="sun-text">
          <div className="sun-what">{nextIsSet ? "Sunset" : "Sunrise"}</div>
          <BigTime className="sun-time" time={hero.time} ampm={hero.ampm} />
          <div className="sun-other">
            {nextIsSet ? "Sunrise" : "Sunset"} {other.time} {other.ampm}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <span className="w-label">Sun · {settings.location.name}</span>
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
  if (p < 0.033 || p > 0.967) return "New moon";
  if (p < 0.217) return "Waxing crescent";
  if (p < 0.283) return "First quarter";
  if (p < 0.467) return "Waxing gibbous";
  if (p < 0.533) return "Full moon";
  if (p < 0.717) return "Waning gibbous";
  if (p < 0.783) return "Last quarter";
  return "Waning crescent";
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

/** Tonight's moon as big as the half allows, its phase and how lit it is. */
export function MoonWidget({ wide }: WidgetProps) {
  const now = useNow(60_000);
  const p = moonPhase(now);
  const illum = Math.round(((1 - Math.cos(2 * Math.PI * p)) / 2) * 100);

  return (
    <>
      <span className="w-label">Moon</span>
      <div className="w-body">
        <div className={`moon${wide ? " wide" : ""}`}>
          <svg className="moon-svg" viewBox="0 0 120 120" role="img" aria-label={phaseName(p)}>
            <circle cx="60" cy="60" r="56" fill="#f2f2f7" />
            <path d={shadowPath(p, 60, 60, 56.5)} fill="var(--fill-1)" />
          </svg>
          <div className="moon-text">
            <div className="moon-name">{phaseName(p)}</div>
            <div className="moon-pct">{illum}% lit</div>
          </div>
        </div>
      </div>
    </>
  );
}
