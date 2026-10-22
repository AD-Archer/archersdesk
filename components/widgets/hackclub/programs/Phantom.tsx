"use client";

// Archer-only: phantom's program figures, from its /api/stats. One fetch feeds
// all seven widgets (the server caches it for a minute); each shows one part.
// Phantom sends counts only, so nothing here names a person.

import { WIDGET_INFO, type WidgetName } from "@/lib/types";
import { BigStat, Empty, MiniList, Shell, StatRow, integrationGate, useIntegration } from "../../kit";
import type { WidgetProps } from "../../registry";
import { DitherBars } from "../DitherBars";

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
  /** Phantom's hcb org, in cents (added by the desk's proxy); null when hcb
   *  can't be read. */
  hcb: { balance: number; incoming: number; raised: number } | null;
}

/** An hour of approved work, in cents: what it brings in, and where that
 *  goes. The $5 back and $1 shipping are phantom's shop budget
 *  (lib/shop/budget.ts); what's left runs the program. The ledger counts
 *  seconds, so money is seconds / 3600 × a rate, whatever a fragment is. */
const HOUR = { income: 850, back: 500, shipping: 100 };
const RUNNING = HOUR.income - HOUR.back - HOUR.shipping;
const owedFor = (seconds: number) => Math.round((seconds / 3600) * (HOUR.back + HOUR.shipping));

const n = (v: number) => v.toLocaleString("en-US");

/** Cents as whole dollars, the way a glance wants them: $6,198 */
const usd = (cents: number) => `${cents < 0 ? "-" : ""}$${Math.round(Math.abs(cents) / 100).toLocaleString("en-US")}`;

/** Cents as a rate, cents shown only when there are some: $5, $2.50 */
const rate = (cents: number) => `$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;

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
  const linked = Boolean(source.integrations.phantom?.token);
  const payload = useIntegration<PhantomStats>("phantom", source, 60 * 1000, undefined, linked);
  const gate = integrationGate(payload, "asking phantom…");
  return (
    <Shell icon={WIDGET_INFO[widget].icon} label={label}>
      {!linked ? <Empty>Add your Phantom stats token in settings</Empty> : (gate ?? children(payload!.data!))}
    </Shell>
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
            {props.wide && <DitherBars days={d.traffic.days.map((day) => day.n)} label="People a day" />}
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
          <DitherBars days={d.active.days} label="Active a day" />
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
          <DitherBars days={d.people.days} label="Sign-ups a day" />
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
            <BigStat
              value={f(d.ledger.outstanding)}
              unit="fragments"
              caption={`held by participants, ${usd(owedFor(d.ledger.outstanding))} to cash in`}
            />
            <StatRow
              items={[
                { label: "Awarded", value: f(d.ledger.awarded) },
                { label: "Spent", value: f(d.ledger.spent) },
              ]}
            />
            {props.wide && <DitherBars days={d.ledger.days} label="Ledger entries a day" />}
          </>
        );
      }}
    </PhantomFrame>
  );
}

/** Can phantom pay for every fragment it has handed out? What's on hcb
 *  against what the fragments people hold would cost if they were all spent
 *  tonight, at $5 an hour plus $1 shipping. Wide, it adds where each hour's
 *  $8.50 goes and whether the money raised has kept up with the work. */
export function PhantomMoneyWidget(props: WidgetProps) {
  return (
    <PhantomFrame {...props} widget="phantom_money" label="Phantom money">
      {(d) => {
        if (!d.hcb) return <Empty>Phantom&rsquo;s HCB can&rsquo;t be read right now</Empty>;
        const held = d.hcb.balance + d.hcb.incoming;
        const owed = owedFor(d.ledger.outstanding);
        const spare = held - owed;
        const hours = d.ledger.awarded / 3600;
        return (
          <>
            <BigStat
              className={spare < 0 ? "short" : undefined}
              value={usd(Math.abs(spare))}
              unit={spare < 0 ? "short" : "spare"}
              caption={spare < 0 ? "HCB can't cover every fragment held" : "once every fragment held is cashed in"}
            />
            <StatRow
              items={[
                { label: "On HCB", value: usd(held) },
                { label: "Fragments owed", value: usd(owed) },
                { label: "Covered", value: owed > 0 ? `${(held / owed).toFixed(1)}×` : "All" },
              ]}
            />
            {props.wide && (
              <div className="phantom-money-side">
                <HourSplit />
                <MiniList
                  rows={[
                    { key: "earned", left: `Earned at ${rate(HOUR.income)}/h`, right: <b>{usd(hours * HOUR.income)}</b> },
                    { key: "raised", left: "Raised on HCB", right: <b>{usd(d.hcb.raised)}</b> },
                    { key: "running", left: `Kept to run it, ${rate(RUNNING)}/h`, right: <b>{usd(hours * RUNNING)}</b> },
                  ]}
                />
              </div>
            )}
          </>
        );
      }}
    </PhantomFrame>
  );
}

/** Each hour's $8.50 as one bar cut in three, widths to scale: what goes
 *  back to the person, what ships it, what runs the program. */
function HourSplit() {
  const parts = [
    { key: "back", cents: HOUR.back, label: "back" },
    { key: "ship", cents: HOUR.shipping, label: "shipping" },
    { key: "run", cents: RUNNING, label: "running it" },
  ];
  return (
    <figure
      className="phantom-split"
      role="img"
      aria-label={`Each hour brings in ${rate(HOUR.income)}: ${parts.map((p) => `${rate(p.cents)} ${p.label}`).join(", ")}`}
    >
      <figcaption>Every hour brings in {rate(HOUR.income)}</figcaption>
      <div className="phantom-split-bar">
        {parts.map((p) => (
          <span key={p.key} className={p.key} style={{ flexGrow: p.cents }} />
        ))}
      </div>
      <div className="phantom-split-key">
        {parts.map((p) => (
          <span key={p.key}>
            <i className={p.key} />
            <b>{rate(p.cents)}</b> {p.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
