"use client";

// You across every hack club program you own: your weighted projects (wps),
// this week's against last week's, which programs bring them in, your hcb net worth, your fines, when each
// program runs, and whether each one has spent more than it earned. Unified
// (stern's /me) and hcb are the sources; see lib/stern.ts.

import type { CSSProperties } from "react";
import { countFines, sharedPrograms, programRun, runLine, wpWeeks, type DeskProgram, type UnifiedProgram } from "@/lib/stern";
import { BigStat, Empty, StatRow } from "../../kit";
import type { WidgetProps } from "../../registry";
import { DayBars, ProgramMark, RankList, SternFrame, cents, n, pct, plural, usd, wp } from "./frame";

/** Your programs as unified has them, each with its desk colour and logo. */
function yours(programs: DeskProgram[]): Array<DeskProgram & { unified: UnifiedProgram }> {
  return programs.filter((p): p is DeskProgram & { unified: UnifiedProgram } => !!p.unified);
}

export function SternWpsWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_wps">
      {(d) => {
        const w = d.me?.wps;
        if (!w) return <Empty>{d.meReason ?? "Reading Unified…"}</Empty>;
        const change = w.lastMonth > 0 ? (w.thisMonth - w.lastMonth) / w.lastMonth : null;
        return (
          <>
            <BigStat value={wp(w.total)} unit="WPs" caption={`${n(w.total * 10)} hours shipped`} />
            <StatRow
              items={[
                { label: "This month", value: wp(w.thisMonth) },
                { label: change === null ? "Last month" : `${change >= 0 ? "Up" : "Down"} on last month`, value: change === null ? wp(w.lastMonth) : pct(Math.abs(change)) },
                { label: "This year", value: wp(w.year) },
              ]}
            />
            <DayBars days={d.me!.wpDays} label="your WPs a day" />
          </>
        );
      }}
    </SternFrame>
  );
}

/** Your week: wps in the last seven days against the seven before, and what
 *  they're worth. Wide, the two weeks side by side. */
export function SternWeekWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_week">
      {(d) => {
        if (!d.me?.wps) return <Empty>{d.meReason ?? "Reading Unified…"}</Empty>;
        const w = wpWeeks(d.me);
        const most = Math.max(w.thisWeek, w.lastWeek, 0.1);
        return (
          <>
            <BigStat
              value={wp(w.thisWeek)}
              unit="WPs"
              caption={
                w.change === null
                  ? w.lastWeek === 0 && w.thisWeek === 0 ? "None this week or last" : "None last week"
                  : `${w.change >= 0 ? "Up" : "Down"} ${pct(Math.abs(w.change))} on last week`
              }
            />
            <StatRow
              items={[
                { label: "Made this week", value: w.thisUsd === null ? "—" : usd(w.thisUsd) },
                { label: "Last week", value: wp(w.lastWeek) },
                { label: "Made last week", value: w.lastUsd === null ? "—" : usd(w.lastUsd) },
              ]}
            />
            {props.wide && (
              <RankList
                rows={[
                  { key: "this", label: "This week", share: w.thisWeek / most, value: `${wp(w.thisWeek)}${w.thisUsd === null ? "" : ` · ${usd(w.thisUsd)}`}` },
                  { key: "last", label: "Last week", share: w.lastWeek / most, value: `${wp(w.lastWeek)}${w.lastUsd === null ? "" : ` · ${usd(w.lastUsd)}`}`, muted: true },
                ]}
              />
            )}
            <DayBars days={w.days} label="your WPs a day" />
          </>
        );
      }}
    </SternFrame>
  );
}

/** Which programs give you the most wps: each bar in its program's colour,
 *  against the one giving most. Wide, the leader leads. */
export function SternTopWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_top">
      {(d) => {
        const mine = yours(d.programs).filter((p) => p.unified.mine > 0);
        if (!d.me) return <Empty>{d.meReason ?? "Reading Unified…"}</Empty>;
        if (!mine.length) return <Empty>None of your programs has WPs yet</Empty>;
        const total = mine.reduce((a, p) => a + p.unified.mine, 0);
        const top = mine[0];
        const most = top.unified.mine;
        return (
          <>
            {props.wide && (
              <div className="stern-lead" style={{ "--c": top.color } as CSSProperties}>
                <BigStat value={wp(top.unified.mine)} unit="WPs" caption={`from ${top.name}, ${pct(top.unified.mine / total)} of yours`} />
                <StatRow
                  items={[
                    { label: "This month", value: wp(top.unified.mineMonth) },
                    { label: "Programs", value: n(mine.length) },
                    { label: "All of yours", value: wp(total) },
                  ]}
                />
              </div>
            )}
            <RankList
              rows={mine.slice(0, props.wide ? 6 : 5).map((p) => ({
                key: p.key,
                label: p.name,
                mark: <ProgramMark p={p} />,
                color: p.color,
                share: p.unified.mine / most,
                value: wp(p.unified.mine),
              }))}
            />
          </>
        );
      }}
    </SternFrame>
  );
}

/** Your hcb net worth, the way stern's net worth tool counts it: "yours" is
 *  the orgs you own plus your split of shared ones, out of every org you're
 *  on. Wide, the orgs that hold the most of it. */
export function SternNetWorthWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_networth">
      {(d) => {
        const w = d.netWorth;
        if (!w) return <Empty>{d.netWorthReason ?? "Counting your HCB orgs…"}</Empty>;
        const orgs = [...w.orgs].filter((o) => o.shareBalanceCents > 0).sort((a, b) => b.shareBalanceCents - a.shareBalanceCents);
        const most = Math.max(1, orgs[0]?.shareBalanceCents ?? 1);
        return (
          <>
            <BigStat
              value={cents(w.trueNetWorth.balanceCents)}
              unit="yours"
              caption={`${cents(w.groupNetWorth.balanceCents)} across every org you're on`}
            />
            <StatRow
              items={[
                { label: "Raised, your share", value: cents(w.trueNetWorth.totalRaisedCents) },
                { label: "Orgs", value: n(w.orgs.length) },
              ]}
            />
            {props.wide && orgs.length > 0 && (
              <RankList
                rows={orgs.slice(0, 6).map((o) => ({
                  key: o.id,
                  label: o.name,
                  share: o.shareBalanceCents / most,
                  value: cents(o.shareBalanceCents),
                }))}
              />
            )}
          </>
        );
      }}
    </SternFrame>
  );
}

/** Your fines: how many, and what they come to, less those on programs
 *  you share (settings → accounts → stern).
 *  Wide, which programs they're on. */
export function SternFinesWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_fines">
      {(d) => {
        if (!d.me?.author) return <Empty>{d.meReason ?? "Reading Unified…"}</Empty>;
        const hidden = sharedPrograms(props.settings.integrations.stern?.shared);
        const f = countFines(d, hidden);
        const fined = yours(d.programs)
          .filter((p) => p.unified.fines.count > 0 && !hidden.has(p.key))
          .sort((a, b) => b.unified.fines.count - a.unified.fines.count || b.unified.fines.amount - a.unified.fines.amount);
        const most = Math.max(1, ...fined.map((p) => p.unified.fines.count));
        return (
          <>
            <BigStat value={n(f.count)} unit={f.count === 1 ? "fine" : "fines"} caption={f.count ? `${usd(f.amount)} in all` : "None"} />
            <StatRow
              items={[
                { label: "Programs fined", value: n(fined.length) },
                ...(f.leftOut ? [{ label: "Left out", value: n(f.leftOut) }] : []),
              ]}
            />
            {props.wide && fined.length > 0 && (
              <RankList
                rows={fined.slice(0, 6).map((p) => ({
                  key: p.key,
                  label: p.name,
                  mark: <ProgramMark p={p} />,
                  color: p.color,
                  share: p.unified.fines.count / most,
                  value: `${n(p.unified.fines.count)} · ${usd(p.unified.fines.amount)}`,
                }))}
              />
            )}
          </>
        );
      }}
    </SternFrame>
  );
}

const DAY = 86_400_000;

/** When your programs run. Square: the live and upcoming ones, soonest to end
 *  first, each with how far through it is. Wide: every one on one time line,
 *  with today down the middle of it. */
export function SternTimelineWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_timeline">
      {(d) => {
        const now = new Date();
        const mine = d.programs.filter((p) => p.mine && (p.startsAt || p.endsAt));
        if (!mine.length) return <Empty>{d.me ? "None of your programs has dates" : (d.meReason ?? "Reading Unified…")}</Empty>;
        const runs = mine.map((p) => ({ p, r: programRun(p, now) }));
        const live = runs.filter((x) => x.r.phase === "live").length;
        const upcoming = runs.filter((x) => x.r.phase === "upcoming").length;

        if (!props.wide) {
          // live ones ending soonest, then the next to start, then what just ended
          const order = { live: 0, upcoming: 1, ended: 2, undated: 3 } as const;
          const shown = [...runs]
            .sort(
              (a, b) =>
                order[a.r.phase] - order[b.r.phase] ||
                (a.r.phase === "ended"
                  ? (b.r.end?.getTime() ?? 0) - (a.r.end?.getTime() ?? 0)
                  : (a.r.end?.getTime() ?? Infinity) - (b.r.end?.getTime() ?? Infinity))
            )
            .slice(0, 5);
          return (
            <RankList
              className="stern-runs"
              rows={shown.map(({ p, r }) => ({
                key: p.key,
                label: p.name,
                mark: <ProgramMark p={p} />,
                color: p.color,
                share: r.phase === "upcoming" ? 0 : (r.progress ?? 1),
                value: runLine(p, now),
                muted: r.phase === "ended",
              }))}
            />
          );
        }

        // the window: from the earliest start to the latest end, at least two
        // months either side of today so a short run doesn't fill the card
        const starts = runs.map((x) => (x.r.start ?? x.r.end)!.getTime());
        const ends = runs.map((x) => (x.r.end ?? x.r.start)!.getTime() + DAY);
        const from = Math.min(...starts, now.getTime() - 30 * DAY);
        const to = Math.max(...ends, now.getTime() + 30 * DAY);
        const at = (t: number) => `${((t - from) / (to - from)) * 100}%`;
        const months: Date[] = [];
        for (let m = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 1); m.getTime() < to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1))
          months.push(m);
        // what's live or to come, then what ended most recently; seven fit
        const kept = new Set(
          [...runs]
            .sort((a, b) =>
              (a.r.phase === "ended") !== (b.r.phase === "ended")
                ? a.r.phase === "ended" ? 1 : -1
                : (b.r.end?.getTime() ?? 0) - (a.r.end?.getTime() ?? 0)
            )
            .slice(0, 7)
        );
        const sorted = runs.filter((x) => kept.has(x)).sort((a, b) => (a.r.start?.getTime() ?? 0) - (b.r.start?.getTime() ?? 0));
        return (
          <div className="stern-gantt" role="img" aria-label={`${plural(live, "program")} live, ${n(upcoming)} to come`}>
            <div className="stern-gantt-head">
              <b>{n(live)}</b> live
              {upcoming > 0 && (
                <>
                  , <b>{n(upcoming)}</b> to come
                </>
              )}
            </div>
            <div className="stern-gantt-grid">
              {months.map((m) => (
                <span key={m.getTime()} className="stern-gantt-month" style={{ left: at(m.getTime()) }}>
                  {m.toLocaleDateString("en-US", { month: "short" })}
                </span>
              ))}
              <span className="stern-gantt-today" style={{ left: at(now.getTime()) }} />
              {sorted.map(({ p, r }) => {
                const s = (r.start ?? r.end)!.getTime();
                const e = (r.end ?? r.start)!.getTime() + DAY;
                return (
                  <div key={p.key} className={`stern-gantt-row ${r.phase}`} style={{ "--c": p.color } as CSSProperties}>
                    <span className="stern-gantt-bar" style={{ left: at(s), width: `calc(${at(e)} - ${at(s)})` }}>
                      <span className="stern-gantt-name">
                        <ProgramMark p={p} />
                        {p.name}
                        {r.phase === "live" && <small>{runLine(p, now)}</small>}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }}
    </SternFrame>
  );
}

/** Has each program earned more than it spent? A program earns its budget
 *  per hour (hq's $5) for every hour its wps stand for (10 a wp); its spend
 *  is everything it has paid out. Each bar is spend against that budget, red
 *  once it's past it. */
export function SternMarginWidget(props: WidgetProps) {
  return (
    <SternFrame {...props} widget="stern_margin">
      {(d) => {
        if (!d.me?.author) return <Empty>{d.meReason ?? "Reading Unified…"}</Empty>;
        const shared = sharedPrograms(props.settings.integrations.stern?.shared);
        const counted = yours(d.programs).filter(
          (p) => !shared.has(p.key) && (p.unified.money.spent > 0 || p.unified.money.allowance > 0)
        );
        if (!counted.length) return <Empty>Nothing&rsquo;s been spent on your programs yet</Empty>;
        const spent = counted.reduce((a, p) => a + p.unified.money.spent, 0);
        const budget = counted.reduce((a, p) => a + p.unified.money.allowance, 0);
        const hours = counted.reduce((a, p) => a + p.unified.wps.total * p.unified.money.hoursPerGrant, 0);
        const margin = budget - spent;
        const within = counted.filter((p) => p.unified.money.margin >= 0).length;
        const rows = [...counted].sort((a, b) => a.unified.money.margin - b.unified.money.margin);
        return (
          <>
            <BigStat
              className={margin < 0 ? "short" : undefined}
              value={usd(Math.abs(margin))}
              unit={margin < 0 ? "over" : "under"}
              caption={`${n(within)} of ${plural(counted.length, "program")} within budget`}
            />
            <StatRow
              items={[
                { label: "Spent", value: usd(spent) },
                { label: "Earned", value: usd(budget) },
                { label: "Per hour", value: hours > 0 ? `$${(spent / hours).toFixed(2)}` : "—" },
              ]}
            />
            {props.wide && (
              <RankList
                rows={rows.slice(0, 6).map((p) => {
                  const m = p.unified.money;
                  const used = m.allowance > 0 ? m.spent / m.allowance : m.spent > 0 ? Infinity : 0;
                  return {
                    key: p.key,
                    label: p.name,
                    mark: <ProgramMark p={p} />,
                    color: p.color,
                    share: Number.isFinite(used) ? used : 1,
                    over: used > 1,
                    value:
                      m.allowance === 0
                        ? `${usd(m.spent)}, no WPs`
                        : used > 1
                          ? `${used >= 10 ? n(used) : used.toFixed(1)}× budget`
                          : `${usd(m.spent)} of ${usd(m.allowance)}`,
                  };
                })}
              />
            )}
          </>
        );
      }}
    </SternFrame>
  );
}
