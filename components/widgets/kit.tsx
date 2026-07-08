"use client";

// ── widget kit ───────────────────────────────────────────────────────
// Reusable building blocks so a new widget is ~30 lines: a Shell, a big
// stat, label/value lists, and a polling hook for integration proxies.
// Everything reads theme tokens, so new widgets pick up themes for free.

import type { IntegrationPayload, ProxyService, Settings } from "@/lib/types";
import { usePoll } from "../hooks";

/** Material Symbols glyph (self-hosted subset — names must be in the font;
 *  regenerate app/fonts/material-symbols.woff2 when adding new ones). */
export function MI({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`mi${className ? ` ${className}` : ""}`} aria-hidden>
      {name}
    </span>
  );
}

/** Label chip + centered body — the frame every widget lives in. */
export function Shell({
  label,
  icon,
  children,
}: {
  label: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className={`w-label${icon ? " has-icon" : ""}`}>
        {icon && <MI name={icon} />}
        {label}
      </span>
      <div className="w-body">{children}</div>
    </>
  );
}

/** Dimmed centered message for loading / unconfigured / error states. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="w-empty">{children}</div>;
}

/** Huge serif number with an accent unit and a small caption under it. */
export function BigStat({
  value,
  unit,
  caption,
}: {
  value: React.ReactNode;
  unit?: string;
  caption?: React.ReactNode;
}) {
  return (
    <div className="kstat">
      <div className="kstat-value">
        {value}
        {unit && <em>{unit}</em>}
      </div>
      {caption && <div className="kstat-cap">{caption}</div>}
    </div>
  );
}

/** Horizontal strip of small labeled figures (like the weather hi/lo row). */
export function StatRow({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="krow-strip">
      {items.map((it, i) => (
        <span key={i}>
          <b>{it.value}</b> {it.label}
        </span>
      ))}
    </div>
  );
}

/** Bordered rows of left/right pairs (like the world clock list). */
export function MiniList({
  rows,
}: {
  rows: Array<{ left: React.ReactNode; right: React.ReactNode; key?: string }>;
}) {
  return (
    <div className="klist">
      {rows.map((r, i) => (
        <div key={r.key ?? i} className="klist-row">
          <span className="klist-left">{r.left}</span>
          <span className="klist-right">{r.right}</span>
        </div>
      ))}
    </div>
  );
}

/** Signed percentage with up/down coloring. */
export function Delta({ pct }: { pct: number }) {
  const cls = pct > 0.005 ? "up" : pct < -0.005 ? "down" : "";
  return (
    <span className={`kdelta ${cls}`}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

/** Poll a server integration/feed proxy; re-fetches when its settings change.
 *  Credentialed services key off their credentials, feeds off location. */
export function useIntegration<T>(
  service: ProxyService,
  settings: Settings,
  ms = 3 * 60 * 1000
): IntegrationPayload<T> | null {
  const creds =
    service in settings.integrations
      ? settings.integrations[service as keyof Settings["integrations"]]
      : settings.location;
  return usePoll<IntegrationPayload<T>>(`/api/integrations/${service}`, ms, [
    JSON.stringify(creds),
  ]);
}

/** The standard loading / unconfigured gate. Returns null when data is ready. */
export function integrationGate<T>(
  payload: IntegrationPayload<T> | null,
  loading: string
): React.ReactNode | null {
  if (!payload) return <Empty>{loading}</Empty>;
  if (!payload.configured || !payload.data) return <Empty>{payload.reason ?? loading}</Empty>;
  return null;
}
