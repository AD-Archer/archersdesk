"use client";

// Integration widgets — each is a thin view over /api/integrations/<service>,
// assembled from the kit. Copy one of these to add the next service.

import { useEffect, useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { clock12 } from "../alarmUtil";
import { BigStat, Delta, Empty, MI, MiniList, Shell, StatRow, integrationGate, useIntegration } from "./kit";
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

export function GithubWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<GithubData>("github", integrationSettings ?? settings);
  const gate = integrationGate(payload, "reading the commit log…");

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.github.icon} label="github">
        {gate}
      </Shell>
    );
  const d = payload!.data!;

  return (
    <Shell icon={WIDGET_INFO.github.icon} label={`github · ${d.username}`}>
      {d.streak ? (
        <>
          <BigStat
            value={
              <span className="gh-streak">
                <MI name="local_fire_department" className="gh-fire" />
                {d.streak.current}
              </span>
            }
            unit="day streak"
            caption={`${d.commits} commits · last 24h`}
          />
          <StatRow
            items={[
              { label: "longest", value: d.streak.longest },
              { label: "total", value: d.streak.total.toLocaleString() },
              ...(d.publicRepos !== null ? [{ label: "repos", value: d.publicRepos }] : []),
            ]}
          />
        </>
      ) : (
        <BigStat
          value={d.today}
          unit={d.today === 1 ? "event" : "events"}
          caption={`${d.commits} commits · last 24h`}
        />
      )}
      {!d.streak && (
        <StatRow
          items={[
            { label: "events 24h", value: d.today },
            ...(d.followers !== null ? [{ label: "followers", value: d.followers }] : []),
            ...(d.publicRepos !== null ? [{ label: "repos", value: d.publicRepos }] : []),
          ]}
        />
      )}
      <MiniList
        rows={d.latest.slice(0, 2).map((e, i) => ({
          key: `${e.repo}${i}`,
          left: e.verb,
          right: e.repo,
        }))}
      />
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
      <Shell icon={WIDGET_INFO.chess.icon} label="chess.com">
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
    <Shell icon={WIDGET_INFO.chess.icon} label={`chess.com · ${d.username}`}>
      <button className="chess-hero" onClick={() => setOpen(true)} aria-label="choose mode">
        <span className="chess-hero-icon">
          <MI name="chess" className="chess-hero-mi" />
          <span className="chess-hero-caret" aria-hidden />
        </span>
        <BigStat
          value={hero.rating}
          unit={hero.mode}
          caption={d.puzzles ? `puzzle best ${d.puzzles}` : undefined}
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
      <EditablePopup open={open} title="show first" onClose={() => setOpen(false)}>
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
    <Shell icon={WIDGET_INFO.stocks.icon} label="stocks">
      {gate ?? (
        <MiniList
          rows={payload!.data!.quotes.map((q) => ({
            key: q.sym,
            left: q.sym.toLowerCase(),
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
      label={`anilist${payload?.data ? ` · ${payload.data.username}` : ""}`}
    >
      {gate ?? (
        <>
          <BigStat
            value={payload!.data!.daysWatched}
            unit="days watched"
            caption={payload!.data!.meanScore ? `mean score ${payload!.data!.meanScore}` : undefined}
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
      label={`septa${payload?.data ? ` · ${payload.data.station.toLowerCase()}` : ""}`}
    >
      {gate ?? (
        <MiniList
          rows={payload!.data!.trains.map((t, i) => {
            const c = clock12(new Date(t.at));
            return {
              key: `${t.line}${i}`,
              left: t.destination.toLowerCase(),
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
    <Shell icon={WIDGET_INFO[service].icon} label={service}>
      {gate ??
        (payload!.data!.playing.length === 0 ? (
          <Empty>nothing streaming right now</Empty>
        ) : (
          <>
            <BigStat
              value={payload!.data!.playing.length}
              unit={payload!.data!.playing.length === 1 ? "stream" : "streams"}
            />
            <MiniList
              rows={payload!.data!.playing.slice(0, 3).map((p, i) => ({
                key: `${p.user}${i}`,
                left: p.user.toLowerCase(),
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

const WAKATIME_MODE_KEY = "archersdesk.wakatimeMode";
const WAKATIME_MODES = [
  { key: "total", label: "Today", title: "Coding Today" },
  { key: "languages", label: "Languages", title: "Top Language" },
  { key: "projects", label: "Projects", title: "Top Project" },
  { key: "os", label: "OS", title: "Top OS" },
  { key: "editors", label: "Editors", title: "Top Editor" },
  { key: "categories", label: "Categories", title: "Top Category" },
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
    <Shell icon={WIDGET_INFO.wakatime.icon} label="wakatime · today">
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
                  <span className="waka-hero-icon">
                    <MI name={WIDGET_INFO.wakatime.icon} className="waka-hero-mi" />
                    <span className="chess-hero-caret" aria-hidden />
                  </span>
                  <BigStat
                    value={mode === "total" ? d.total : (top?.name ?? "no data")}
                    unit={mode === "total" ? undefined : top?.text}
                    caption={meta.title}
                  />
                </button>
                {rows.length > 0 && (
                  <MiniList
                    rows={rows.map((item) => ({
                      key: item.name,
                      left: item.name.toLowerCase(),
                      right: (
                        <>
                          <b>{item.text}</b>
                          {item.percent !== null && <small>{Math.round(item.percent)}%</small>}
                        </>
                      ),
                    }))}
                  />
                )}
                <EditablePopup open={open} title="show wakatime" onClose={() => setOpen(false)}>
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
