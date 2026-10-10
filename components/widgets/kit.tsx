"use client";

// ── widget kit ───────────────────────────────────────────────────────
// Reusable building blocks so a new widget is ~30 lines: a Shell, a big
// stat, label/value lists, and a polling hook for integration proxies.
// Everything reads theme tokens, so new widgets pick up themes for free.

import { createContext, useContext } from "react";
import type { IntegrationPayload, ProxyService, ViewSettings } from "@/lib/types";
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

// the Shell's icon, so an Empty inside it can show the widget's glyph
const ShellIcon = createContext<string | undefined>(undefined);

/** Tinted heading + centered body — the frame every widget lives in. */
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
    <ShellIcon.Provider value={icon}>
      <span className={`w-label${icon ? " has-icon" : ""}`}>
        {icon && <MI name={icon} />}
        {label}
      </span>
      <div className="w-body">{children}</div>
    </ShellIcon.Provider>
  );
}

/** Loading / unconfigured / error state: the widget's glyph in a tinted
 *  disc over one plain sentence (like StandBy's empty music widget).
 *  `plain` drops the glyph for a quiet line inside other content. */
export function Empty({
  children,
  icon,
  plain = false,
}: {
  children: React.ReactNode;
  icon?: string;
  plain?: boolean;
}) {
  const shellIcon = useContext(ShellIcon);
  const glyph = plain ? undefined : (icon ?? shellIcon);
  const text = typeof children === "string" ? plainWords(children) : children;
  if (!glyph) return <div className="w-empty">{text}</div>;
  return (
    <div className="w-empty-state">
      <span className="w-glyph" aria-hidden>
        <MI name={glyph} />
      </span>
      <p className="w-empty">{text}</p>
    </div>
  );
}

/** Server reasons read like "add your x in settings → accounts". On the board
 *  that becomes plain direction: "Add your x in settings" (no arrow paths). */
export function plainWords(text: string): string {
  const t = text.replace(/\s*→\s*[\w &]+$/u, "").replace(/\s*→\s*/gu, ", ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A time readout in the rounded figure face. `tone` gives StandBy's big
 *  clock treatment: each digit drawn separately, two tones of the widget's
 *  tint overlapping where they meet, and the colon as two soft white dots. */
export function BigTime({
  time,
  ampm,
  className,
  tone = false,
}: {
  time: string;
  ampm?: string;
  className?: string;
  tone?: boolean;
}) {
  const label = `${time}${ampm ? ` ${ampm}` : ""}`;
  if (!tone) {
    return (
      <span className={`btime${className ? ` ${className}` : ""}`} aria-label={label} suppressHydrationWarning>
        {time}
        {ampm && <span className="btime-ampm">{ampm}</span>}
      </span>
    );
  }
  const [h, m = ""] = time.split(":");
  // tones alternate across the whole readout: light, dark, light, dark
  const digits = (str: string, offset: number) =>
    [...str].map((d, i) => (
      <span key={i} className={`tt-d${(i + offset) % 2 ? " b" : ""}`}>
        {d}
      </span>
    ));
  return (
    <span className={`tt${className ? ` ${className}` : ""}`} role="img" aria-label={label} suppressHydrationWarning>
      <span className="tt-pair">{digits(h, 0)}</span>
      <span className="tt-colon" />
      <span className="tt-pair">{digits(m, h.length)}</span>
      {ampm && <span className="tt-ampm">{ampm}</span>}
    </span>
  );
}

/** @deprecated old name — use BigTime */
export const DotTime = BigTime;

/** The hero figure: a big rounded number in the tint, a quiet unit beside
 *  it, a caption under it. */
export function BigStat({
  value,
  unit,
  caption,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  caption?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`kstat${className ? ` ${className}` : ""}`}>
      <div className="kstat-value">
        {value}
        {unit && <span className="kstat-unit">{unit}</span>}
      </div>
      {caption && <div className="kstat-cap">{caption}</div>}
    </div>
  );
}

/** A row of small figures, each over its label (like iOS widget stats). */
export function StatRow({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="krow-strip">
      {items.map((it, i) => (
        <span key={i} className="krow-item">
          <b>{it.value}</b>
          <small>{it.label}</small>
        </span>
      ))}
    </div>
  );
}

/** Left/right rows split by hairlines, like an iOS widget list. */
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
  settings: ViewSettings,
  ms = 3 * 60 * 1000,
  refreshKey?: number | string,
  enabled = true
): IntegrationPayload<T> | null {
  const creds =
    service === "agenda"
      ? { calendars: settings.calendars, epic: settings.showEpicInAgenda }
      : service in settings.integrations
        ? settings.integrations[service as keyof ViewSettings["integrations"]]
        : settings.location;
  // location-aware feeds resolve on the server per active device, so the
  // device id rides along in the query string (and in the poll deps).
  const url = `/api/integrations/${service}?device=${encodeURIComponent(settings.deviceId)}`;
  // bumping refreshKey changes the poll deps → immediate refetch (used after a
  // write action so the new state shows without waiting out the interval).
  return usePoll<IntegrationPayload<T>>(enabled ? url : null, ms, [
    JSON.stringify(creds),
    settings.deviceId,
    refreshKey,
  ]);
}

/** Fire a write action against a service's proxy (e.g. seerr approve/decline,
 *  home assistant toggle). Not polled — call it from an event handler. `screen`
 *  (a device id or "remote") says which screen pressed, for macapad's schedules. */
export function useIntegrationAction(service: ProxyService, screen?: string) {
  return async (action: string, payload?: unknown): Promise<IntegrationPayload> => {
    const query = screen ? `?device=${encodeURIComponent(screen)}` : "";
    const res = await fetch(`/api/integrations/${service}${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    return res.json();
  };
}

/** The standard loading / unconfigured gate. Returns null when data is ready. */
export function integrationGate<T>(
  payload: IntegrationPayload<T> | null,
  loading: string
): React.ReactNode | null {
  // rendered inside a Shell, so the Empty picks up the widget's glyph
  if (!payload) return <Empty>{loading}</Empty>;
  if (!payload.configured || !payload.data) return <Empty>{payload.reason ?? loading}</Empty>;
  return null;
}
