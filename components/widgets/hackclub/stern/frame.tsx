"use client";

// What every stern widget shares: one poll of the desk's stern proxy (the
// server keeps it a minute, so a page of these is one read), the frames, and
// the few marks they draw with. Styles: the stern part of app/styles/hackclub.css.
//
// Two frames. SternFrame is you across every program, in hack club red.
// ProgramFrame is the page's own program (settings → layout → program): it
// wears that program's colour and shows its logo and name over the card, so a
// page reads as that program from across the room.

import { useState, type CSSProperties, type ReactNode } from "react";
import { WIDGET_INFO, type WidgetName } from "@/lib/types";
import type { DeskProgram, HcbBalances, SternDesk, SternProgramStats } from "@/lib/stern";
import { Empty, Shell, integrationGate, useIntegration } from "../../kit";
import type { WidgetProps } from "../../registry";

export const n = (v: number) => Math.round(v).toLocaleString("en-US");

/** wps to one place, the way unified shows them: 321.4 */
export const wp = (v: number) => (Math.abs(v) >= 1000 ? n(v) : v.toFixed(1));

/** Dollars as a glance wants them: $6,198, then $44.7k past ten thousand. */
export function usd(dollars: number) {
  const sign = dollars < 0 ? "-" : "";
  const a = Math.abs(dollars);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

export const cents = (c: number) => usd(c / 100);

export const pct = (share: number) => `${Math.round(share * 100)}%`;

export const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;

function useStern(props: WidgetProps, refresh?: string) {
  const source = props.integrationSettings ?? props.settings;
  const linked = Boolean(source.integrations.stern?.token);
  // the page's program rides along as the refresh key: picking one refetches
  // straight away instead of on the next minute's poll
  const payload = useIntegration<SternDesk>("stern", source, 60 * 1000, refresh, linked);
  return { linked, payload };
}

/** You across every program. */
export function SternFrame({
  widget,
  children,
  ...props
}: WidgetProps & { widget: WidgetName; children: (d: SternDesk) => ReactNode }) {
  const { linked, payload } = useStern(props);
  const gate = integrationGate(payload, "asking stern…");
  return (
    <Shell icon={WIDGET_INFO[widget].icon} label={labelOf(widget)}>
      {!linked ? <Empty>Add your Stern platform key in settings</Empty> : (gate ?? children(payload!.data!))}
    </Shell>
  );
}

export interface ProgramView {
  d: SternDesk;
  p: DeskProgram;
  stats: SternProgramStats | null;
  hcb: HcbBalances | null;
}

/** The page's program. `needs` says which half it draws from: stern's figures
 *  (a program that runs on stern), unified's (one of yours), or either. */
export function ProgramFrame({
  widget,
  needs,
  children,
  ...props
}: WidgetProps & {
  widget: WidgetName;
  needs: "stern" | "unified" | "any";
  children: (v: ProgramView) => ReactNode;
}) {
  const key = props.program ?? "";
  const { linked, payload } = useStern(props, key);
  const icon = WIDGET_INFO[widget].icon;
  const plain = (body: ReactNode) => (
    <Shell icon={icon} label={labelOf(widget)}>
      {body}
    </Shell>
  );

  if (!linked) return plain(<Empty>Add your Stern platform key in settings</Empty>);
  if (!key) return plain(<Empty>Pick this page&rsquo;s program in settings</Empty>);
  const gate = integrationGate(payload, "asking stern…");
  if (gate) return plain(gate);
  const d = payload!.data!;
  const p = d.programs.find((x) => x.key === key);
  if (!p) return plain(<Empty>Stern doesn&rsquo;t list this page&rsquo;s program any more</Empty>);

  const stats = d.stats[key] ?? null;
  let body: ReactNode;
  if (needs === "stern" && !p.slug) body = <Empty>{p.name} doesn&rsquo;t run on Stern, so there&rsquo;s none of this</Empty>;
  else if (needs === "stern" && !stats) body = <Empty>{`Asking Stern about ${p.name}…`}</Empty>;
  else if (needs === "unified" && !p.unified)
    body = <Empty>{d.me ? `${p.name} isn't one of your programs in Unified` : (d.meReason ?? "Reading Unified…")}</Empty>;
  else body = children({ d, p, stats, hcb: d.hcb[key] ?? null });

  return (
    <div className="stern-skin" style={{ "--tint": p.color } as CSSProperties}>
      <Shell icon={icon} label={p.name} mark={<ProgramMark p={p} />} show>
        {body}
      </Shell>
    </div>
  );
}

/** The heading's words for a card with no program: "Your wps". */
function labelOf(widget: WidgetName) {
  const l = WIDGET_INFO[widget].label.replace(/\bwps\b/, "WPs");
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** A program's logo, or a dot of its colour when it has none (or it won't
 *  load). */
export function ProgramMark({ p, size }: { p: Pick<DeskProgram, "logoUrl" | "color" | "name">; size?: "big" }) {
  const [broken, setBroken] = useState(false);
  const style = { "--c": p.color } as CSSProperties;
  if (!p.logoUrl || broken) return <i className={`stern-dot${size ? ` ${size}` : ""}`} style={style} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a remote logo at its own size
    <img
      className={`stern-mark${size ? ` ${size}` : ""}`}
      src={p.logoUrl}
      alt=""
      style={style}
      onError={() => setBroken(true)}
    />
  );
}

/** One column a day, oldest left. Today stands at full strength and the rest
 *  recede, so the eye lands on today; a quiet day keeps a sliver, so it reads
 *  as "none" rather than missing. */
export function DayBars({ days, label }: { days: number[]; label: string }) {
  if (!days.length) return null;
  const max = Math.max(...days);
  const total = days.reduce((a, b) => a + b, 0);
  return (
    <figure
      className="stern-days"
      role="img"
      aria-label={`${label}: ${total.toLocaleString("en-US", { maximumFractionDigits: 1 })} over ${days.length} days, ${days[days.length - 1].toLocaleString("en-US", { maximumFractionDigits: 1 })} today`}
    >
      <div className="stern-days-plot">
        {days.map((v, i) => (
          <span
            key={i}
            className={i === days.length - 1 ? "today" : undefined}
            style={{ height: `${max > 0 ? Math.max(3, (v / max) * 100) : 3}%` }}
          />
        ))}
      </div>
      <figcaption className="stern-days-x">
        <span>{days.length} days ago</span>
        <span>{label}</span>
        <span>today</span>
      </figcaption>
    </figure>
  );
}

export interface RankRow {
  key: string;
  label: ReactNode;
  /** how full the bar is, 0 to 1 */
  share: number;
  value: ReactNode;
  /** this row's own colour (a program's), else the card's */
  color?: string;
  mark?: ReactNode;
  over?: boolean;
  muted?: boolean;
}

/** Label, a bar, a figure: one row each, split by hairlines. */
export function RankList({ rows, className }: { rows: RankRow[]; className?: string }) {
  return (
    <ol className={`stern-rank${className ? ` ${className}` : ""}`}>
      {rows.map((r) => (
        <li
          key={r.key}
          className={r.muted ? "muted" : undefined}
          style={r.color ? ({ "--c": r.color } as CSSProperties) : undefined}
        >
          <span className="stern-rank-label">
            {r.mark}
            <span>{r.label}</span>
          </span>
          <span className="stern-rank-track" aria-hidden>
            <span
              className={`stern-rank-fill${r.over ? " over" : ""}`}
              style={{ width: `${Math.min(1, Math.max(0, r.share)) * 100}%` }}
            />
          </span>
          <b>{r.value}</b>
        </li>
      ))}
    </ol>
  );
}

/** A long thin bar: how far along (a run, a budget). Past 1 it turns red. */
export function Meter({ value, label, marks }: { value: number; label: string; marks?: [ReactNode, ReactNode] }) {
  return (
    <div className="stern-meter-wrap">
      <span className={`stern-meter${value > 1 ? " over" : ""}`} role="img" aria-label={label}>
        <span style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} />
      </span>
      {marks && (
        <span className="stern-meter-marks">
          <span>{marks[0]}</span>
          <span>{marks[1]}</span>
        </span>
      )}
    </div>
  );
}
