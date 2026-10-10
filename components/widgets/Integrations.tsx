"use client";

// Integration widgets — each is a thin view over /api/integrations/<service>,
// assembled from the kit. Copy one of these to add the next service.

import { useEffect, useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { clock12 } from "../alarmUtil";
import { BigStat, Delta, Empty, MI, MiniList, Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface GithubData {
  username: string;
  today: number;
  commits: number;
  repos: number;
  latest: Array<{ verb: string; repo: string }>;
  followers: number | null;
  publicRepos: number | null;
  streak: { current: number; longest: number; total: number } | null;
}

export function GithubWidget({ settings, integrationSettings, wide }: WidgetProps) {
  const payload = useIntegration<GithubData>("github", integrationSettings ?? settings);
  const gate = integrationGate(payload, "reading the commit log…");

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.github.icon} label="GitHub">
        {gate}
      </Shell>
    );
  const d = payload!.data!;

  return (
    <Shell icon={WIDGET_INFO.github.icon} label={`GitHub · ${d.username}`}>
      {d.streak ? (
        <BigStat
          value={
            <span className="gh-streak">
              <MI name="local_fire_department" className="gh-fire" />
              {d.streak.current}
            </span>
          }
          unit="day coding streak"
          caption={`${d.commits} ${d.commits === 1 ? "change" : "changes"} saved to GitHub today`}
        />
      ) : (
        <BigStat
          value={d.commits}
          unit={d.commits === 1 ? "change today" : "changes today"}
          caption="Saved to GitHub"
        />
      )}
      {wide && (
        <MiniList
          rows={d.latest.slice(0, 3).map((e, i) => ({
            key: `${e.repo}${i}`,
            left: e.verb,
            right: e.repo,
          }))}
        />
      )}
    </Shell>
  );
}

interface ChessData {
  username: string;
  top: { mode: string; rating: number };
  modes: Array<{
    mode: string;
    rating: number;
    record: string;
    best?: number | null;
    delta?: number | null;
    results?: { win: number; loss: number; draw: number } | null;
    streak?: { kind: "win" | "loss"; n: number } | null;
    history?: Array<[number, number]>;
  }>;
  puzzles: number | null;
}

const capWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// which mode leads, remembered per site
const CHESS_MODE_KEY: Record<ChessSite, string> = {
  chess: "archersdesk.chessMode",
  lichess: "archersdesk.lichessMode",
};
type ChessSite = "chess" | "lichess";
const CHESS_SITE_NAME: Record<ChessSite, string> = { chess: "Chess.com", lichess: "Lichess" };

/** The small round "choose" mark on tap-to-pick heroes (iOS menu chevrons). */
export function ClickSettingsGlyph() {
  return (
    <span className="click-settings-glyph" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 9.5L12 5l4.5 4.5M7.5 14.5L12 19l4.5-4.5" />
      </svg>
    </span>
  );
}

export const ChessWidget = (p: WidgetProps) => <ChessRatingsWidget {...p} site="chess" />;
export const LichessWidget = (p: WidgetProps) => <ChessRatingsWidget {...p} site="lichess" />;

/** Ratings from Chess.com or Lichess: the leading mode big, the rest listed.
 *  Tap the rating to choose which mode leads. */
function ChessRatingsWidget({ settings, integrationSettings, site, wide }: WidgetProps & { site: ChessSite }) {
  const payload = useIntegration<ChessData>(site, integrationSettings ?? settings);
  const name = CHESS_SITE_NAME[site];
  const [pref, setPref] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const gate = integrationGate(payload, "setting up the board…");

  useEffect(() => {
    setPref(window.localStorage.getItem(CHESS_MODE_KEY[site]));
  }, [site]);

  if (gate)
    return (
      <Shell icon={WIDGET_INFO[site].icon} label={name}>
        {gate}
      </Shell>
    );
  const d = payload!.data!;
  const hero = d.modes.find((m) => m.mode === pref) ?? d.modes.find((m) => m.mode === d.top.mode) ?? d.modes[0];

  const modePicker = (
  <EditablePopup open={open} title="Show first" onClose={() => setOpen(false)}>
    <div className="mood-grid">
      {d.modes.map((m) => (
        <button
          key={m.mode}
          className={`mood-card${hero.mode === m.mode ? " on" : ""}`}
          onClick={() => pick(m.mode)}
        >
          <b>{m.mode}</b>
          <small>
            {m.rating} · {m.record}
          </small>
        </button>
      ))}
    </div>
  </EditablePopup>
  );

  // wide: the leading mode's story — rating, its last months as a chart,
  // and how its games have gone; the other modes sit underneath as a row
  if (wide) {
    const others = d.modes.filter((m) => m.mode !== hero.mode);
    return (
      <Shell icon={WIDGET_INFO[site].icon} label={`${name} · ${d.username}`}>
        <div className="chess-wide">
          <div className="chess-wide-head">
            <button className="chess-wide-mode" onClick={() => setOpen(true)} aria-label="choose mode">
              {capWord(hero.mode)}
              <ClickSettingsGlyph />
            </button>
            <div className="chess-wide-rating">{hero.rating}</div>
            <ChessTrend mode={hero} />
            {others.length > 0 && (
              <div className="chess-wide-others">
                {others.map((m) => (
                  <button key={m.mode} className="chess-other" onClick={() => pick(m.mode)}>
                    <span>{capWord(m.mode)}</span>
                    <b>{m.rating}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ChessChart history={hero.history ?? []} mode={hero.mode} />
          <ChessResults mode={hero} who={`${d.username} on ${name}`} />
        </div>
        {modePicker}
      </Shell>
    );
  }

  function pick(mode: string) {
    window.localStorage.setItem(CHESS_MODE_KEY[site], mode);
    setPref(mode);
    setOpen(false);
  }

  return (
    <Shell icon={WIDGET_INFO[site].icon} label={`${name} · ${d.username}`}>
      <button className="chess-hero" onClick={() => setOpen(true)} aria-label="choose mode">
        <BigStat
          value={hero.rating}
          unit={hero.mode.charAt(0).toUpperCase() + hero.mode.slice(1)}
          caption={
            <>
              {d.puzzles ? `Puzzle best ${d.puzzles}` : "Show another mode"}
              <ClickSettingsGlyph />
            </>
          }
        />
      </button>
      <MiniList
        rows={d.modes
          .filter((m) => m.mode !== hero.mode)
          .map((m) => ({
            key: m.mode,
            left: m.mode,
            right: (
              <>
                <b>{m.rating}</b> <small>{m.record}</small>
              </>
            ),
          }))}
      />
      {modePicker}
    </Shell>
  );
}

const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const DAY_MS = 24 * 60 * 60 * 1000;

/** How the rating moved: over the last 30 days if they've played lately,
 *  otherwise when they last played. */
function ChessTrend({ mode }: { mode: ChessData["modes"][number] }) {
  const h = mode.history ?? [];
  const last = h[h.length - 1];
  if (!last) return null;
  const recent = Date.now() - last[0] < 45 * DAY_MS;
  if (!recent) return <div className="chess-trend">Last played {MONTH_YEAR.format(last[0])}</div>;
  if (typeof mode.delta !== "number" || mode.delta === 0) return <div className="chess-trend">Steady this month</div>;
  return (
    <div className="chess-trend">
      <span className={`chess-trend-n ${mode.delta > 0 ? "up" : "down"}`}>
        {mode.delta > 0 ? "+" : "−"}
        {Math.abs(mode.delta)}
      </span>{" "}
      in the last 30 days
    </div>
  );
}

/** One series, so no legend: a 2px line in the tint over a faint wash, the
 *  high and low as quiet guides, and a dot on today's rating. */
function ChessChart({ history, mode }: { history: Array<[number, number]>; mode: string }) {
  if (history.length < 2) {
    return <div className="chess-chart empty">Not enough recent games for a chart</div>;
  }
  const W = 600;
  const H = 200;
  const t0 = history[0][0];
  const t1 = history[history.length - 1][0];
  const ratings = history.map((p) => p[1]);
  const lo = Math.min(...ratings);
  const hi = Math.max(...ratings);
  const pad = Math.max(6, (hi - lo) * 0.14);
  const y0 = lo - pad;
  const y1 = hi + pad;
  const x = (t: number) => (t1 === t0 ? W : ((t - t0) / (t1 - t0)) * W);
  const y = (r: number) => H - ((r - y0) / (y1 - y0)) * H;
  const line = history.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const end = history[history.length - 1];
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <figure
      className="chess-chart"
      role="img"
      aria-label={`${capWord(mode)} rating from ${history[0][1]} to ${end[1]}, ${MONTH_SHORT.format(t0)} to now; high ${hi}, low ${lo}`}
    >
      <div className="chess-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <line className="chess-guide" x1="0" x2={W} y1={y(hi)} y2={y(hi)} vectorEffect="non-scaling-stroke" />
          <line className="chess-guide" x1="0" x2={W} y1={y(lo)} y2={y(lo)} vectorEffect="non-scaling-stroke" />
          <path className="chess-area" d={area} />
          <path className="chess-line" d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="chess-dot" style={{ left: pct(x(end[0]), W), top: pct(y(end[1]), H) }} />
        <span className="chess-tick" style={{ top: pct(y(hi), H) }}>{hi}</span>
        {hi !== lo && <span className="chess-tick" style={{ top: pct(y(lo), H) }}>{lo}</span>}
      </div>
      <figcaption className="chess-x">
        <span>{MONTH_SHORT.format(t0)}</span>
        <span>{Date.now() - t1 < 2 * DAY_MS ? "Today" : MONTH_SHORT.format(t1)}</span>
      </figcaption>
    </figure>
  );
}

/** Won / lost / drawn as one split bar, each part keyed by a letter as well
 *  as its color (red and green alone fail for color-blind readers and in
 *  night mode), with the counts and any current streak beside it. */
function ChessResults({ mode, who }: { mode: ChessData["modes"][number]; who: string }) {
  const r = mode.results;
  const total = r ? r.win + r.loss + r.draw : 0;
  const parts = r
    ? ([
        { key: "win", letter: "W", label: "won", n: r.win },
        { key: "loss", letter: "L", label: "lost", n: r.loss },
        { key: "draw", letter: "D", label: "drawn", n: r.draw },
      ] as const)
    : [];
  return (
    <div className="chess-results">
      {total > 0 && (
        <>
          <div className="chess-bar" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(", ")}>
            {parts
              .filter((p) => p.n > 0)
              .map((p) => (
                <span key={p.key} className={`chess-seg ${p.key}`} style={{ flexGrow: p.n }} />
              ))}
          </div>
          <div className="chess-keys">
            {parts.map((p) => (
              <span key={p.key} className="chess-key">
                <i className={`chess-key-mark ${p.key}`} aria-hidden>
                  {p.letter}
                </i>
                <b>{p.n.toLocaleString("en-US")}</b> {p.label}
              </span>
            ))}
            {mode.streak && (
              <span className="chess-streak">
                {mode.streak.n} {mode.streak.kind === "win" ? "wins" : "losses"} in a row
              </span>
            )}
          </div>
        </>
      )}
      <p className="chess-who">{who}</p>
    </div>
  );
}

interface StocksData {
  quotes: Array<{ sym: string; price?: number; changePct?: number; error?: boolean }>;
}

export function StocksWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<StocksData>("stocks", integrationSettings ?? settings, 2 * 60 * 1000);
  const gate = integrationGate(payload, "checking the tape…");

  return (
    <Shell icon={WIDGET_INFO.stocks.icon} label="Stocks">
      {gate ?? (
        <MiniList
          rows={payload!.data!.quotes.map((q) => ({
            key: q.sym,
            left: <span className="k-strong">{q.sym}</span>,
            right: q.error ? (
              <small>—</small>
            ) : (
              <>
                <b>{q.price!.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b>{" "}
                <Delta pct={q.changePct!} />
              </>
            ),
          }))}
        />
      )}
    </Shell>
  );
}

interface AnilistData {
  username: string;
  animeCount: number;
  episodes: number;
  daysWatched: number;
  meanScore: number;
  mangaCount: number;
  chapters: number;
}

export function AnilistWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<AnilistData>("anilist", integrationSettings ?? settings);
  const gate = integrationGate(payload, "checking the watchlist…");

  return (
    <Shell
      icon={WIDGET_INFO.anilist.icon}
      label={`AniList${payload?.data ? ` · ${payload.data.username}` : ""}`}
    >
      {gate ?? (
        <>
          <BigStat
            value={payload!.data!.daysWatched}
            unit="days watched"
            caption={payload!.data!.meanScore ? `Mean score ${payload!.data!.meanScore}` : undefined}
          />
          <MiniList
            rows={[
              {
                key: "anime",
                left: "anime",
                right: (
                  <>
                    <b>{payload!.data!.animeCount}</b>{" "}
                    <small>{payload!.data!.episodes.toLocaleString()} eps</small>
                  </>
                ),
              },
              {
                key: "manga",
                left: "manga",
                right: (
                  <>
                    <b>{payload!.data!.mangaCount}</b>{" "}
                    <small>{payload!.data!.chapters.toLocaleString()} ch</small>
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </Shell>
  );
}

interface SeptaData {
  station: string;
  trains: Array<{ line: string; destination: string; at: number; status: string; track: string }>;
}

export function SeptaWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<SeptaData>("septa", integrationSettings ?? settings, 60 * 1000);
  const gate = integrationGate(payload, "checking the rails…");

  return (
    <Shell
      icon={WIDGET_INFO.septa.icon}
      label={`SEPTA${payload?.data ? ` · ${payload.data.station}` : ""}`}
    >
      {gate ?? (
        <MiniList
          rows={payload!.data!.trains.map((t, i) => {
            const c = clock12(new Date(t.at));
            return {
              key: `${t.line}${i}`,
              left: t.destination,
              right: (
                <>
                  <b>
                    {c.time} {c.ampm}
                  </b>{" "}
                  <small>{t.status}</small>
                </>
              ),
            };
          })}
        />
      )}
    </Shell>
  );
}

interface MediaData {
  server: string;
  playing: Array<{ user: string; title: string }>;
}

function MediaWidget({
  service,
  settings,
  integrationSettings,
}: WidgetProps & { service: "jellyfin" | "plex" }) {
  const payload = useIntegration<MediaData>(service, integrationSettings ?? settings, 60 * 1000);
  const gate = integrationGate(payload, "pinging the server…");

  return (
    <Shell icon={WIDGET_INFO[service].icon} label={service === "plex" ? "Plex" : "Jellyfin"}>
      {gate ??
        (payload!.data!.playing.length === 0 ? (
          <Empty>Nothing is streaming right now</Empty>
        ) : (
          <>
            <BigStat
              value={payload!.data!.playing.length}
              unit={payload!.data!.playing.length === 1 ? "stream" : "streams"}
            />
            <MiniList
              rows={payload!.data!.playing.slice(0, 3).map((p, i) => ({
                key: `${p.user}${i}`,
                left: p.user,
                right: <b>{p.title}</b>,
              }))}
            />
          </>
        ))}
    </Shell>
  );
}

export const JellyfinWidget = (p: WidgetProps) => <MediaWidget {...p} service="jellyfin" />;
export const PlexWidget = (p: WidgetProps) => <MediaWidget {...p} service="plex" />;

interface WakatimeData {
  total: string;
  langs: WakatimeItem[];
  projects: WakatimeItem[];
  operatingSystems: WakatimeItem[];
  editors: WakatimeItem[];
  categories: WakatimeItem[];
}

interface WakatimeItem {
  name: string;
  text: string;
  percent: number | null;
}

/** "3 hrs 12 mins" as a figure: 3h 12m with small unit letters. */
function DurationFigure({ text }: { text: string }) {
  const h = text.match(/(\d+)\s*hr/);
  const m = text.match(/(\d+)\s*min/);
  if (!h && !m) return <>{text}</>;
  return (
    <span>
      {h && (
        <>
          {h[1]}
          <small>h</small>
        </>
      )}
      {h && m && " "}
      {m && (
        <>
          {m[1]}
          <small>m</small>
        </>
      )}
    </span>
  );
}

const WAKATIME_MODE_KEY = "archersdesk.wakatimeMode";
const WAKATIME_MODES = [
  { key: "total", label: "Today", title: "Coding today" },
  { key: "languages", label: "Languages", title: "Top language" },
  { key: "projects", label: "Projects", title: "Top project" },
  { key: "os", label: "OS", title: "Top OS" },
  { key: "editors", label: "Editors", title: "Top editor" },
  { key: "categories", label: "Categories", title: "Top category" },
] as const;
type WakatimeMode = (typeof WAKATIME_MODES)[number]["key"];

export function WakatimeWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<WakatimeData>("wakatime", integrationSettings ?? settings);
  const [pref, setPref] = useState<WakatimeMode>("total");
  const [open, setOpen] = useState(false);
  const gate = integrationGate(payload, "tallying the keystrokes…");

  useEffect(() => {
    const saved = window.localStorage.getItem(WAKATIME_MODE_KEY);
    if (WAKATIME_MODES.some((m) => m.key === saved)) setPref(saved as WakatimeMode);
  }, []);

  function pick(mode: WakatimeMode) {
    window.localStorage.setItem(WAKATIME_MODE_KEY, mode);
    setPref(mode);
    setOpen(false);
  }

  function itemsFor(d: WakatimeData, mode: WakatimeMode) {
    if (mode === "languages") return d.langs;
    if (mode === "projects") return d.projects;
    if (mode === "os") return d.operatingSystems;
    if (mode === "editors") return d.editors;
    if (mode === "categories") return d.categories;
    return [];
  }

  function fallbackMode(d: WakatimeData) {
    return itemsFor(d, pref).length || pref === "total" ? pref : "total";
  }

  return (
    <Shell icon={WIDGET_INFO.wakatime.icon} label="WakaTime · today">
      {gate ?? (
        <>
          {(() => {
            const d = payload!.data!;
            const mode = fallbackMode(d);
            const meta = WAKATIME_MODES.find((m) => m.key === mode)!;
            const rows = itemsFor(d, mode);
            const top = rows[0];
            return (
              <>
                <button className="waka-hero" onClick={() => setOpen(true)} aria-label="choose wakatime stat">
                  <BigStat
                    className={mode === "total" ? undefined : "text"}
                    value={mode === "total" ? <DurationFigure text={d.total} /> : (top?.name ?? "Nothing yet")}
                    unit={mode === "total" ? undefined : top?.text}
                    caption={
                      <>
                        {meta.title}
                        <ClickSettingsGlyph />
                      </>
                    }
                  />
                </button>
                {rows.length > 0 && (
                  <MiniList
                    rows={rows.map((item) => ({
                      key: item.name,
                      left: item.name,
                      right: (
                        <>
                          <b>{item.text}</b>
                          {item.percent !== null && <small>{Math.round(item.percent)}%</small>}
                        </>
                      ),
                    }))}
                  />
                )}
                <EditablePopup open={open} title="Show first" onClose={() => setOpen(false)}>
                  <div className="mood-grid">
                    {WAKATIME_MODES.map((m) => {
                      const rows = itemsFor(d, m.key);
                      const value = m.key === "total" ? d.total : (rows[0]?.name ?? "no data");
                      const detail = m.key === "total" ? "total coding time" : (rows[0]?.text ?? "nothing today");
                      return (
                        <button
                          key={m.key}
                          className={`mood-card${mode === m.key ? " on" : ""}`}
                          onClick={() => pick(m.key)}
                        >
                          <b>{m.label}</b>
                          <small>
                            {value} · {detail}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </EditablePopup>
              </>
            );
          })()}
        </>
      )}
    </Shell>
  );
}
