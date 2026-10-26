"use client";

// The page's own program (settings → layout → program), in its colour, its
// logo and name over every card. Stern's figures (people, reviews, hours,
// orders) need a program that runs on stern; unified's (wps, fines, spend)
// need one of yours. The program card itself takes whichever there is.

import { programRun, runLine, shortDate } from "@/lib/stern";
import { BigStat, Empty, MiniList, StatRow } from "../../kit";
import type { WidgetProps } from "../../registry";
import { DayBars, Meter, ProgramFrame, ProgramMark, RankList, cents, fx, n, pct, usd, wp } from "./frame";

/** Which program this page is: its logo and name, big in its colour, where
 *  it is in its run, and the line it runs along. */
export function SternProgramWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_program" needs="any">
      {({ p, stats }) => {
        const now = new Date();
        const r = programRun(p, now);
        const u = p.unified;
        const items = [
          ...(u ? [{ label: "WPs", value: fx(wp(u.wps.total)) }, { label: "Yours", value: fx(wp(u.mine)) }] : []),
          ...(stats
            ? [{ label: "People", value: fx(n(stats.people.total)) }]
            : u
              ? [{ label: "Shippers", value: fx(n(u.shippers)) }]
              : p.stern
                ? [{ label: "People", value: fx(n(p.stern.people)) }]
                : []),
        ];
        return (
          <>
            <div className="stern-id">
              <ProgramMark p={p} size="big" />
              <b className="stern-id-name">{p.name}</b>
              <span className={`stern-id-run ${r.phase}`}>{runLine(p, now)}</span>
            </div>
            {r.progress !== null && (
              <Meter
                value={r.progress}
                label={`${pct(r.progress)} of the way from ${shortDate(r.start, now)} to ${shortDate(r.end, now)}`}
                marks={[shortDate(r.start, now), shortDate(r.end, now)]}
              />
            )}
            {items.length > 0 && <StatRow items={items} />}
          </>
        );
      }}
    </ProgramFrame>
  );
}

/** The program's wps, and how many of them are yours: shared programs split
 *  each project between their owners. Wide, its fines and its people. */
export function SternProgramWpsWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_program_wps" needs="unified">
      {({ p }) => {
        const u = p.unified!;
        const others = u.owners - 1;
        return (
          <>
            <BigStat
              value={fx(wp(u.mine))}
              unit="yours"
              caption={`of ${wp(u.wps.total)} WPs${others > 0 ? `, shared with ${others} ${others === 1 ? "other" : "others"}` : ""}`}
            />
            <StatRow
              items={[
                { label: "This month", value: fx(wp(u.wps.month)) },
                { label: "Last 7 days", value: fx(wp(u.wps.week)) },
                { label: "Projects", value: fx(n(u.projects)) },
              ]}
            />
            {props.wide && (
              <MiniList
                rows={[
                  { key: "mine", left: "Yours this month", right: <b>{fx(wp(u.mineMonth))}</b> },
                  { key: "shippers", left: "People who shipped", right: <b>{fx(n(u.shippers))}</b> },
                  {
                    key: "fines",
                    left: "Fines",
                    right: <b>{fx(u.fines.count ? `${n(u.fines.count)}, ${usd(u.fines.amount)}` : "None")}</b>,
                  },
                  ...(u.nps !== null ? [{ key: "nps", left: "NPS", right: <b>{fx(n(u.nps))}</b> }] : []),
                ]}
              />
            )}
          </>
        );
      }}
    </ProgramFrame>
  );
}

export function SternPeopleWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_people" needs="stern">
      {({ stats }) => {
        const s = stats!.people;
        const started = stats!.funnel.find((f) => f.key === "started")?.n;
        return (
          <>
            <BigStat value={fx(n(s.total))} unit="people" caption={`${n(s.week)} joined this week`} />
            <StatRow
              items={[
                { label: "On Hackatime", value: fx(s.total ? pct(s.hackatimeLinked / s.total) : "—") },
                ...(started !== undefined ? [{ label: "Started a project", value: fx(n(started)) }] : []),
              ]}
            />
            <DayBars days={s.days} label="joined a day" />
          </>
        );
      }}
    </ProgramFrame>
  );
}

/** Stern counts someone active when they post a devlog, the one record of
 *  work it keeps for every program, so a quiet coder doesn't show. */
export function SternActiveWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_active" needs="stern">
      {({ stats }) => {
        const a = stats!.active;
        return (
          <>
            <BigStat value={fx(n(a.today))} unit="posting today" caption={`${n(a.yesterday)} yesterday`} />
            <StatRow
              items={[
                { label: "This week", value: fx(n(a.week)) },
                { label: "This month", value: fx(n(a.month)) },
              ]}
            />
            <DayBars days={a.days} label="posting a day" />
          </>
        );
      }}
    </ProgramFrame>
  );
}

/** The review queue: what's waiting, how long the oldest has, and the
 *  hours builders say are in it. Past a week, the figure turns amber. */
export function SternReviewWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_review" needs="stern">
      {({ stats }) => {
        const r = stats!.review;
        const old = r.oldestWaitDays ?? 0;
        return (
          <>
            <BigStat
              className={old >= 7 ? "warn" : undefined}
              value={fx(n(r.waiting))}
              unit="waiting"
              caption={r.waiting ? `oldest has waited ${old} day${old === 1 ? "" : "s"}` : "The queue is clear"}
            />
            <StatRow
              items={[
                { label: "Hours waiting", value: fx(n(r.hoursWaiting)) },
                { label: "Final checks", value: fx(n(stats!.projects.finalChecks)) },
                { label: "Approved", value: fx(r.approvalRate === null ? "—" : pct(r.approvalRate)) },
              ]}
            />
            <DayBars days={r.days} label="reviewed a day" />
          </>
        );
      }}
    </ProgramFrame>
  );
}

/** Hours: approved work, what's been granted and spent, and what builders
 *  still hold, the shop's liability. */
export function SternHoursWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_hours" needs="stern">
      {({ stats }) => {
        const h = stats!.hours;
        const c = stats!.currency;
        return (
          <>
            <BigStat
              value={fx(n(h.shipped))}
              unit="hours shipped"
              caption={h.outstanding ? `${n(h.outstanding)}h still held, ${usd(h.outstandingUsd)} to cash in` : "Nothing left unspent"}
            />
            <StatRow
              items={[
                { label: "Granted", value: fx(n(h.granted)) },
                { label: "Spent", value: fx(n(h.spent)) },
                ...(c ? [{ label: `${c.name} held`, value: fx(n(c.outstanding)) }] : []),
              ]}
            />
            <DayBars days={h.days} label="hours granted a day" />
          </>
        );
      }}
    </ProgramFrame>
  );
}

export function SternOrdersWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_orders" needs="stern">
      {({ stats }) => {
        const o = stats!.orders;
        const s = o.byStatus;
        return (
          <>
            <BigStat
              value={fx(n(o.toShip))}
              unit="to send"
              caption={`${n(o.toShipUnits)} item${o.toShipUnits === 1 ? "" : "s"}, ${n(o.week)} placed this week`}
            />
            <MiniList
              rows={[
                { key: "pending", left: "Placed", right: <b>{fx(n(s.pending ?? 0))}</b> },
                { key: "processing", left: "Being packed", right: <b>{fx(n(s.processing ?? 0))}</b> },
                { key: "shipped", left: "On the way", right: <b>{fx(n(o.inTransit))}</b> },
                { key: "fulfilled", left: "Delivered", right: <b>{fx(n(s.fulfilled ?? 0))}</b> },
                ...(props.wide ? [{ key: "cancelled", left: "Cancelled", right: <b>{fx(n(s.cancelled ?? 0))}</b> }] : []),
              ]}
            />
          </>
        );
      }}
    </ProgramFrame>
  );
}

/** Every step against everyone who joined, so each bar reads as "this share
 *  of everyone got this far". */
export function SternFunnelWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_funnel" needs="stern">
      {({ stats }) => {
        const f = stats!.funnel;
        const first = Math.max(1, f[0]?.n ?? 0);
        const last = f[f.length - 1];
        return (
          <>
            {props.wide && last && (
              <BigStat value={fx(pct(last.n / first))} unit={last.label.toLowerCase()} caption={`of ${n(f[0].n)} who joined`} />
            )}
            <RankList rows={f.map((step) => ({ key: step.key, label: step.label, share: step.n / first, value: n(step.n) }))} />
          </>
        );
      }}
    </ProgramFrame>
  );
}

/** Has this program spent more than it earned? It earns its budget per hour
 *  for every hour its wps stand for; the bar is spend against that. Wide,
 *  what its hcb holds and what it still owes. */
export function SternMoneyWidget(props: WidgetProps) {
  return (
    <ProgramFrame {...props} widget="stern_money" needs="unified">
      {({ p, stats, hcb }) => {
        const m = p.unified!.money;
        const used = m.allowance > 0 ? m.spent / m.allowance : m.spent > 0 ? 2 : 0;
        if (m.allowance === 0 && m.spent === 0)
          return <Empty>{`${p.name} hasn't earned or spent anything yet`}</Empty>;
        return (
          <>
            <BigStat
              className={m.margin < 0 ? "short" : undefined}
              value={fx(usd(Math.abs(m.margin)))}
              unit={m.margin < 0 ? "over" : "under"}
              caption={
                m.costPerHour === null
                  ? "spent before any WPs came in"
                  : `$${m.costPerHour.toFixed(2)} an hour, budget $${m.budgetPerHour}`
              }
            />
            <Meter
              value={used}
              label={`${usd(m.spent)} spent of ${usd(m.allowance)} earned`}
              marks={[`${usd(m.spent)} spent`, `${usd(m.allowance)} earned`]}
            />
            {props.wide && (
              <MiniList
                rows={[
                  ...(hcb
                    ? [
                        { key: "hcb", left: "On HCB", right: <b>{fx(cents(hcb.balance + hcb.incoming))}</b> },
                        { key: "raised", left: "Raised on HCB", right: <b>{fx(cents(hcb.raised))}</b> },
                      ]
                    : []),
                  ...(stats ? [{ key: "owed", left: "Owed for hours held", right: <b>{fx(usd(stats.hours.outstandingUsd))}</b> }] : []),
                  {
                    key: "fines",
                    left: "Fines",
                    right: <b>{fx(p.unified!.fines.count ? usd(p.unified!.fines.amount) : "None")}</b>,
                  },
                ]}
              />
            )}
          </>
        );
      }}
    </ProgramFrame>
  );
}
