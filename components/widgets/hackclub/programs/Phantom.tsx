"use client";

// Archer-only: phantom's program figures, from its /api/stats. One fetch feeds
// all seven widgets (the server caches it for a minute); each shows one part.
// Phantom sends counts only, so nothing here names a person.

import { WIDGET_INFO, type WidgetName } from "@/lib/types";
import { BigStat, Empty, MiniList, Shell, StatRow, integrationGate, useIntegration } from "../../kit";
import type { WidgetProps } from "../../registry";

/** The shape of phantom's /api/stats (lib/server/stats.ts over there). */
interface PhantomStats {
  generatedAt: string;
  traffic: {
    visitors: number;
    visits: number;
    pageviews: number;
    bounceRate: number;
    visitDuration: number;
    days: Array<{ day: string; n: number }>;
  } | null;
  active: { today: number; yesterday: number; week: number; month: number; days: number[] };
  people: { total: number; week: number; days: number[] };
  orders: { byState: Record<string, number>; open: number; week: number; days: number[] };
  projects: { all: number; draft: number; review: number; approved: number; rejected: number };
  funnel: Array<{ key: string; label: string; n: number }>;
  ledger: { outstanding: number; awarded: number; spent: number; fragmentSeconds: number; days: number[] };
}

const n = (v: number) => v.toLocaleString("en-US");

/** seconds as a person says them: 4m 16s */
function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/** The common frame: one shared fetch, the account check, the loading gate. */
function PhantomFrame({
  widget,
  label,
  settings,
  integrationSettings,
  children,
}: WidgetProps & {
  widget: WidgetName;
  label: string;
  children: (d: PhantomStats) => React.ReactNode;
}) {
  const source = integrationSettings ?? settings;
  const linked = Boolean(source.integrations.phantom?.url && source.integrations.phantom?.token);
  const payload = useIntegration<PhantomStats>("phantom", source, 60 * 1000, undefined, linked);
  const gate = integrationGate(payload, "asking phantom…");
  return (
    <Shell icon={WIDGET_INFO[widget].icon} label={label}>
      {!linked ? <Empty>Add your Phantom address and stats token in settings</Empty> : (gate ?? children(payload!.data!))}
    </Shell>
  );
}

/** One bar a day, oldest left, today right and full strength; the rest
 *  recede so the eye lands on today. Zero days keep a sliver, so a gap reads
 *  as "none" rather than "missing". */
function DayBars({ days, label }: { days: number[]; label: string }) {
  if (days.length === 0) return null;
  const max = Math.max(1, ...days);
  const total = days.reduce((a, b) => a + b, 0);
  return (
    <figure className="phantom-bars" role="img" aria-label={`${label}: ${n(total)} over ${days.length} days, ${n(days[days.length - 1])} today`}>
      <div className="phantom-bars-plot">
        {days.map((v, i) => (
          <span key={i} className={`phantom-bar${i === days.length - 1 ? " today" : ""}`} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />
        ))}
      </div>
      <figcaption className="phantom-bars-x">
        <span>{days.length} days ago</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

export function PhantomTrafficWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_traffic" label="Phantom visitors">
      {(d) =>
        !d.traffic ? (
          <Empty>Phantom can&rsquo;t read Plausible right now</Empty>
        ) : (
          <>
            <BigStat value={n(d.traffic.visitors)} unit="people" caption="in the last 7 days" />
            <StatRow
              items={[
                { label: "Visits", value: n(d.traffic.visits) },
                { label: "Average visit", value: duration(d.traffic.visitDuration) },
                { label: "Left after one page", value: `${Math.round(d.traffic.bounceRate)}%` },
              ]}
            />
            {props.wide && <DayBars days={d.traffic.days.map((day) => day.n)} label="People a day" />}
          </>
        )
      }
    </PhantomFrame>
  );
}

export function PhantomActiveWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_active" label="Phantom daily active">
      {(d) => (
        <>
          <BigStat value={n(d.active.today)} unit="coding today" caption={`${n(d.active.yesterday)} yesterday`} />
          <StatRow
            items={[
              { label: "This week", value: n(d.active.week) },
              { label: "This month", value: n(d.active.month) },
            ]}
          />
          <DayBars days={d.active.days} label="Active a day" />
        </>
      )}
    </PhantomFrame>
  );
}

export function PhantomPeopleWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_people" label="Phantom people">
      {(d) => (
        <>
          <BigStat value={n(d.people.total)} unit="people" caption={`${n(d.people.week)} joined this week`} />
          <DayBars days={d.people.days} label="Sign-ups a day" />
        </>
      )}
    </PhantomFrame>
  );
}

export function PhantomOrdersWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_orders" label="Phantom orders">
      {(d) => {
        const s = d.orders.byState;
        return (
          <>
            <BigStat value={n(d.orders.open)} unit="to send" caption={`${n(d.orders.week)} placed this week`} />
            <MiniList
              rows={[
                { key: "placed", left: "Placed", right: <b>{n(s.placed ?? 0)}</b> },
                { key: "hold", left: "On hold", right: <b>{n(s.on_hold ?? 0)}</b> },
                ...((s.unfulfilled ?? 0) > 0
                  ? [{ key: "back", left: "Came back", right: <b>{n(s.unfulfilled)}</b> }]
                  : []),
                { key: "sent", left: "Fulfilled", right: <b>{n(s.fulfilled ?? 0)}</b> },
                ...(props.wide
                  ? [{ key: "no", left: "Rejected or cancelled", right: <b>{n((s.rejected ?? 0) + (s.cancelled ?? 0))}</b> }]
                  : []),
              ]}
            />
          </>
        );
      }}
    </PhantomFrame>
  );
}

export function PhantomProjectsWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_projects" label="Phantom projects">
      {(d) => (
        <>
          <BigStat value={n(d.projects.review)} unit="in review" caption={`${n(d.projects.all)} projects in all`} />
          <MiniList
            rows={[
              { key: "draft", left: "Never shipped", right: <b>{n(d.projects.draft)}</b> },
              { key: "approved", left: "Approved", right: <b>{n(d.projects.approved)}</b> },
              { key: "rejected", left: "Rejected", right: <b>{n(d.projects.rejected)}</b> },
            ]}
          />
        </>
      )}
    </PhantomFrame>
  );
}

/** Every step against the first, so each bar reads as "this share of everyone
 *  who signed up got this far". */
export function PhantomFunnelWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_funnel" label="Phantom funnel">
      {(d) => {
        const first = Math.max(1, d.funnel[0]?.n ?? 0);
        const last = d.funnel[d.funnel.length - 1];
        return (
          <>
            {props.wide && last && (
              <BigStat
                value={`${Math.round((last.n / first) * 100)}%`}
                unit={last.label}
                caption={`of ${n(d.funnel[0].n)} who signed up`}
              />
            )}
            <ol className="phantom-funnel">
              {d.funnel.map((step) => (
                <li key={step.key}>
                  <span className="phantom-funnel-label">{step.label}</span>
                  <span className="phantom-funnel-track" aria-hidden>
                    <span className="phantom-funnel-fill" style={{ width: `${(step.n / first) * 100}%` }} />
                  </span>
                  <b>{n(step.n)}</b>
                </li>
              ))}
            </ol>
          </>
        );
      }}
    </PhantomFrame>
  );
}

export function PhantomLedgerWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_ledger" label="Phantom ledger">
      {(d) => {
        const f = (seconds: number) => n(Math.trunc(seconds / d.ledger.fragmentSeconds));
        return (
          <>
            <BigStat value={f(d.ledger.outstanding)} unit="fragments" caption="held by participants" />
            <StatRow
              items={[
                { label: "Awarded", value: f(d.ledger.awarded) },
                { label: "Spent", value: f(d.ledger.spent) },
              ]}
            />
            {props.wide && <DayBars days={d.ledger.days} label="Ledger entries a day" />}
          </>
        );
      }}
    </PhantomFrame>
  );
}
