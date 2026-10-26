"use client";

// Archer-only: cont.d's program figures, from its /api/v1/stats with a key
// from its admin. One fetch (three ranges) feeds every cont.d widget; each
// shows one part. cont.d sends counts only, so nothing here names a person.
// The pool shows up in its own widget only; the rest keep to people, work,
// reviews and hours.
//
// Each widget wears the stage it's about, as cont.d's landing page tells the
// story: people in its red and the hero's mixed shapes, picking a project up
// and working on it in yellow squares, shipping in green circles, the pool in
// cyan triangles (the tints are in hackclub.css). The big figure is drawn in
// that shape and the chart lights it.

import { WIDGET_INFO, type WidgetName } from "@/lib/types";
import { BigStat, Empty, MiniList, Shell, StatRow, integrationGate, useIntegration } from "../../kit";
import type { WidgetProps } from "../../registry";
import { Decrypt } from "../Decrypt";
import { ShapeColumns } from "../ShapeColumns";
import { ShapeFigure } from "../ShapeFigure";

type Day = { day: string; n: number };
type Series = { total: number; previousPeriod: number | null; days: Day[] };

/** One range of cont.d's /api/v1/stats (src/app/api/v1/stats/route.ts over there). */
interface ContdRange {
  range: "7d" | "30d" | "all";
  generatedAt: string;
  /** People on the site, from Plausible; null when cont.d can't read it. Missing from an older cont.d. */
  site?: { visitors: number; visits: number; pageviews: number; bounceRate: number; visitDuration: number; days: Day[] } | null;
  /** People who logged Hackatime time on a project linked to their remake, per New York day. */
  activity: {
    today: number;
    averagePerDay: number;
    differentPeople: number;
    codingAtAll: number;
    hours: number;
    days: Array<{ day: string; active: number; codingAtAll: number; firstTime: number; hours: number }>;
  };
  /** Approved hours and what's waiting in the review queue. Missing from an older cont.d. */
  hours?: { approved: number; approvedInRange: number; approvedRemakes: number; waiting: number; waitingRemakes: number };
  people: { signedIn: number; finishedIntro: number; connectedHackatime: number };
  pool: { listed: number; tossedInEver: number; forkedAtLeastOnce: number; waitingForAFork: number; tossedBackIn: number; byStatus: Record<string, number> };
  remakes: { started: number; shipped: number; approved: number; builders: number; byStatus: Record<string, number> };
  reviews: {
    decisions: number;
    waiting: { pool: number; fraudCheck: number; firstPass: number; secondPass: number };
    medianHoursToDecision: { pool: number | null; remake: number | null };
  };
  funnel: Array<{ key?: string; label: string; n: number }>;
  daily: Record<"signups" | "intro" | "tossed" | "remakes" | "shipped" | "reviews", Series>;
}

/** What the desk's proxy hands over: the last 7 days, the last 30, and all time. */
interface ContdStats {
  week: ContdRange;
  month: ContdRange;
  all: ContdRange;
}

/** The funnel's pool steps, left out here: the pool has its own widget. */
const POOL_STEPS = new Set(["tossed", "pooled"]);

/** Each funnel step in its stage's colour (hackclub.css): people in red, the
 *  remake in yellow, shipping and approval in green. */
const STEP_TINT: Record<string, string> = {
  signedIn: "var(--contd-red)",
  intro: "var(--contd-red)",
  hackatime: "var(--contd-red)",
  remade: "var(--contd-yellow)",
  shipped: "var(--contd-green)",
  approved: "var(--contd-green)",
};

const n = (v: number) => v.toLocaleString("en-US");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

/** Hours, a decimal only while it still matters: 3.5, 412 */
const hours = (h: number) => (h < 10 ? (Math.round(h * 10) / 10).toString() : n(Math.round(h)));

/** A median wait: 45m, 12h, 3d */
const wait = (h: number | null) => (h === null ? "–" : h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`);

/** seconds as a person says them: 4m 16s */
function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/** "4 the week before", or nothing when there's no week before to compare with. */
const before = (s: Series) => (s.previousPeriod === null ? "" : `, ${n(s.previousPeriod)} the week before`);

/** A figure that decrypts into place when it shows or changes. */
const fx = (text: string) => <Decrypt text={text} />;

/** The common frame: one shared fetch, the account check, the loading gate. */
function ContdFrame({
  widget,
  label,
  settings,
  integrationSettings,
  children,
}: WidgetProps & {
  widget: WidgetName;
  label: string;
  children: (d: ContdStats) => React.ReactNode;
}) {
  const source = integrationSettings ?? settings;
  const linked = Boolean(source.integrations.contd?.token);
  const payload = useIntegration<ContdStats>("contd", source, 60 * 1000, undefined, linked);
  const gate = integrationGate(payload, "asking cont.d…");
  return (
    <Shell icon={WIDGET_INFO[widget].icon} label={label}>
      {!linked ? <Empty>Add a cont.d API key in settings</Empty> : (gate ?? children(payload!.data!))}
    </Shell>
  );
}

/** People on the site this week, from Plausible through cont.d. */
export function ContdTrafficWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_traffic" label="cont.d visitors">
      {(d) => {
        const s = d.week.site;
        if (s === undefined) return <Empty>This cont.d doesn&rsquo;t send site traffic yet</Empty>;
        if (s === null) return <Empty>cont.d can&rsquo;t read Plausible right now</Empty>;
        return (
          <>
            <BigStat value={<ShapeFigure text={n(s.visitors)} shape="mixed" />} unit="people" caption="on the site in the last 7 days" />
            <StatRow
              items={[
                { label: "Visits", value: fx(n(s.visits)) },
                { label: "Average visit", value: fx(duration(s.visitDuration)) },
                ...(props.wide ? [{ label: "Left after one page", value: fx(`${Math.round(s.bounceRate)}%`) }] : []),
              ]}
            />
            <ShapeColumns days={(d.month.site?.days ?? s.days).map((x) => x.n)} label="People a day" shape="mixed" />
          </>
        );
      }}
    </ContdFrame>
  );
}

/** Daily active users: people who worked on their remake, by Hackatime. */
export function ContdActiveWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_active" label="cont.d daily active">
      {(d) => {
        const days = d.month.activity.days;
        const yesterday = days.length > 1 ? days[days.length - 2].active : 0;
        return (
          <>
            <BigStat value={<ShapeFigure text={n(d.week.activity.today)} shape="square" />} unit="on their remake today" caption={`${n(yesterday)} yesterday`} />
            <StatRow
              items={[
                { label: "This week", value: fx(n(d.week.activity.differentPeople)) },
                { label: "This month", value: fx(n(d.month.activity.differentPeople)) },
                ...(props.wide ? [{ label: "Coding at all, this week", value: fx(n(d.week.activity.codingAtAll)) }] : []),
              ]}
            />
            <ShapeColumns days={days.map((x) => x.active)} label="Active a day" shape="square" />
          </>
        );
      }}
    </ContdFrame>
  );
}

/** The daily active count's other half: how long they coded on their remakes. */
export function ContdHoursWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_hours" label="cont.d hours coded">
      {(d) => {
        const days = d.month.activity.days;
        const today = days[days.length - 1];
        const yesterday = days[days.length - 2];
        return (
          <>
            <BigStat value={<ShapeFigure text={hours(today?.hours ?? 0)} shape="square" />} unit="hours today" caption={`${hours(yesterday?.hours ?? 0)} yesterday`} />
            <StatRow
              items={[
                { label: "This week", value: fx(hours(d.week.activity.hours)) },
                { label: "This month", value: fx(hours(d.month.activity.hours)) },
                { label: "Each, today", value: fx(today?.active ? `${hours(today.hours / today.active)}h` : "–") },
              ]}
            />
            <ShapeColumns days={days.map((x) => x.hours)} label="Hours a day" shape="square" />
          </>
        );
      }}
    </ContdFrame>
  );
}

/** Approved hours, and the hours waiting on a review decision. */
export function ContdApprovedWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_approved" label="cont.d approved hours">
      {(d) => {
        const h = d.all.hours;
        if (!h) return <Empty>This cont.d doesn&rsquo;t send hours yet</Empty>;
        return (
          <>
            <BigStat value={<ShapeFigure text={hours(h.approved)} shape="circle" />} unit="hours approved" caption={`${hours(d.week.hours?.approvedInRange ?? 0)} approved this week`} />
            {props.wide ? (
              <MiniList
                rows={[
                  { key: "waiting", left: "Waiting in the queue", right: <b>{fx(`${hours(h.waiting)}h`)}</b> },
                  { key: "waitingRemakes", left: "Remakes waiting", right: <b>{fx(n(h.waitingRemakes))}</b> },
                  { key: "approvedRemakes", left: "Remakes approved", right: <b>{fx(n(h.approvedRemakes))}</b> },
                  { key: "month", left: "Approved this month", right: <b>{fx(`${hours(d.month.hours?.approvedInRange ?? 0)}h`)}</b> },
                ]}
              />
            ) : (
              <StatRow
                items={[
                  { label: "Waiting", value: fx(`${hours(h.waiting)}h`) },
                  { label: "Remakes waiting", value: fx(n(h.waitingRemakes)) },
                ]}
              />
            )}
          </>
        );
      }}
    </ContdFrame>
  );
}

export function ContdSignupsWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_signups" label="cont.d sign-ups">
      {(d) => {
        const p = d.all.people;
        const week = d.week.daily.signups;
        return (
          <>
            <BigStat value={<ShapeFigure text={n(p.signedIn)} shape="mixed" />} unit="people" caption={`${n(week.total)} joined this week${before(week)}`} />
            <StatRow
              items={[
                { label: "Connected Hackatime", value: fx(n(p.connectedHackatime)) },
                { label: "Finished the intro", value: fx(pct(p.finishedIntro, p.signedIn)) },
              ]}
            />
            <ShapeColumns days={d.month.daily.signups.days.map((x) => x.n)} label="Sign-ups a day" shape="mixed" />
          </>
        );
      }}
    </ContdFrame>
  );
}

/** Remakes started: the projects people are building, drafts to approved. */
export function ContdRemakesWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_remakes" label="cont.d remakes">
      {(d) => {
        const s = d.all.remakes.byStatus;
        const week = d.week.daily.remakes;
        return (
          <>
            <BigStat value={<ShapeFigure text={n(week.total)} shape="square" />} unit="started this week" caption={`${n(d.all.remakes.started)} in all, by ${n(d.all.remakes.builders)} people`} />
            <MiniList
              rows={[
                { key: "draft", left: "Still in draft", right: <b>{fx(n(s.draft ?? 0))}</b> },
                { key: "review", left: "Shipped, in review", right: <b>{fx(n((s.submitted ?? 0) + (s.in_review ?? 0)))}</b> },
                { key: "approved", left: "Approved", right: <b>{fx(n(s.approved ?? 0))}</b> },
                ...(props.wide ? [{ key: "rejected", left: "Rejected", right: <b>{fx(n(s.rejected ?? 0))}</b> }] : []),
              ]}
            />
          </>
        );
      }}
    </ContdFrame>
  );
}

export function ContdShippedWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_shipped" label="cont.d shipped">
      {(d) => {
        const week = d.week.daily.shipped;
        const r = d.all.remakes;
        return (
          <>
            <BigStat value={<ShapeFigure text={n(week.total)} shape="circle" />} unit="shipped this week" caption={`${n(r.shipped)} in all${before(week)}`} />
            <StatRow
              items={[
                { label: "Approved", value: fx(n(r.approved)) },
                { label: "Of those shipped", value: fx(pct(r.approved, r.shipped)) },
              ]}
            />
            <ShapeColumns days={d.month.daily.shipped.days.map((x) => x.n)} label="Shipped a day" shape="circle" />
          </>
        );
      }}
    </ContdFrame>
  );
}

/** Is reviewing keeping up: shipped remakes waiting at each stage, their hours, and how fast decisions come. */
export function ContdReviewsWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_reviews" label="cont.d reviews">
      {(d) => {
        const w = d.all.reviews.waiting;
        const remakes = w.fraudCheck + w.firstPass + w.secondPass;
        const median = d.month.reviews.medianHoursToDecision.remake;
        const waitingHours = d.all.hours?.waiting;
        return (
          <>
            <BigStat
              value={<ShapeFigure text={n(remakes)} shape="circle" />}
              unit="remakes waiting"
              caption={`${waitingHours === undefined ? "" : `${hours(waitingHours)}h of work, `}a first decision takes ${wait(median)}`}
            />
            {props.wide && (
              <StatRow
                items={[
                  { label: "Decisions this week", value: fx(n(d.week.daily.reviews.total)) },
                  { label: "This month", value: fx(n(d.month.daily.reviews.total)) },
                ]}
              />
            )}
            <MiniList
              rows={[
                { key: "fraud", left: "Fraud check", right: <b>{fx(n(w.fraudCheck))}</b> },
                { key: "first", left: "1st pass", right: <b>{fx(n(w.firstPass))}</b> },
                { key: "second", left: "2nd pass", right: <b>{fx(n(w.secondPass))}</b> },
              ]}
            />
          </>
        );
      }}
    </ContdFrame>
  );
}

/** Every step against the first, so each bar reads as "this share of everyone
 *  who signed in got this far". The pool's steps are left to its own widget. */
export function ContdFunnelWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_funnel" label="cont.d funnel">
      {(d) => {
        const steps = d.all.funnel.filter((s) => !s.key || !POOL_STEPS.has(s.key)).filter((s) => !/pool|tossed/i.test(s.label));
        const first = Math.max(1, steps[0]?.n ?? 0);
        const last = steps[steps.length - 1];
        return (
          <>
            {props.wide && last && (
              <BigStat
                value={<ShapeFigure text={`${Math.round((last.n / first) * 100)}%`} shape="circle" />}
                unit={last.label.toLowerCase()}
                caption={`of ${n(steps[0].n)} who signed in`}
              />
            )}
            <ol className="phantom-funnel">
              {steps.map((step) => (
                <li key={step.key ?? step.label} style={step.key && STEP_TINT[step.key] ? ({ "--tint": STEP_TINT[step.key] } as React.CSSProperties) : undefined}>
                  <span className="phantom-funnel-label">{step.label}</span>
                  <span className="phantom-funnel-track" aria-hidden>
                    <span className="phantom-funnel-fill" style={{ width: `${(step.n / first) * 100}%` }} />
                  </span>
                  <b>{fx(n(step.n))}</b>
                </li>
              ))}
            </ol>
          </>
        );
      }}
    </ContdFrame>
  );
}

/** The pool, on its own: what's in it to remake, and how much of it has been picked up. */
export function ContdPoolWidget(props: WidgetProps) {
  return (
    <ContdFrame {...props} widget="contd_pool" label="cont.d pool">
      {(d) => {
        const p = d.all.pool;
        return (
          <>
            <BigStat value={<ShapeFigure text={n(p.listed)} shape="triangle" />} unit="in the pool" caption={`${n(p.waitingForAFork)} still waiting for a first remake`} />
            <StatRow
              items={[
                { label: "Forked", value: fx(n(p.forkedAtLeastOnce)) },
                { label: "Tossed back in", value: fx(n(p.tossedBackIn)) },
                ...(props.wide ? [{ label: "Tossed in ever", value: fx(n(p.tossedInEver)) }] : []),
              ]}
            />
            {props.wide && <ShapeColumns days={d.month.daily.tossed.days.map((x) => x.n)} label="Tossed in a day" shape="triangle" />}
          </>
        );
      }}
    </ContdFrame>
  );
}
