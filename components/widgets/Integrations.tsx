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
  modes: Array<{ mode: string; rating: number; record: string }>;
  puzzles: number | null;
}

const CHESS_MODE_KEY = "archersdesk.chessMode";

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

export function ChessWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<ChessData>("chess", integrationSettings ?? settings);
  const [pref, setPref] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const gate = integrationGate(payload, "setting up the board…");

  useEffect(() => {
    setPref(window.localStorage.getItem(CHESS_MODE_KEY));
  }, []);

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.chess.icon} label="Chess.com">
        {gate}
      </Shell>
    );
  const d = payload!.data!;
  const hero = d.modes.find((m) => m.mode === pref) ?? d.top;

  function pick(mode: string) {
    window.localStorage.setItem(CHESS_MODE_KEY, mode);
    setPref(mode);
    setOpen(false);
  }

  return (
    <Shell icon={WIDGET_INFO.chess.icon} label={`Chess.com · ${d.username}`}>
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
    </Shell>
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
