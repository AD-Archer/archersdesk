"use client";

// Keyless feed widgets — critter cams, facts, headlines, and location-aware
// feeds. Each is a thin view over /api/integrations/<service> via the kit.

import type { FeedService } from "@/lib/types";
import { WIDGET_INFO } from "@/lib/types";
import { BigStat, Empty, MI, MiniList, Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

/* ── critter cams ────────────────────────────────────────────────── */

interface PictureData {
  src: string;
  caption?: string;
}

function PictureWidget({
  service,
  label,
  settings,
  integrationSettings,
}: WidgetProps & { service: FeedService; label: string }) {
  const payload = useIntegration<PictureData>(service, integrationSettings ?? settings, 100 * 1000);

  return (
    <>
      <span className="w-label has-icon">
        <MI name={WIDGET_INFO[service as keyof typeof WIDGET_INFO]?.icon ?? "pets"} />
        {label}
      </span>
      {!payload ? (
        <div className="w-body">
          <Empty>fetching a good one…</Empty>
        </div>
      ) : !payload.configured || !payload.data ? (
        <div className="w-body">
          <Empty>{payload.reason ?? "feed unavailable"}</Empty>
        </div>
      ) : (
        <div className="pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={payload.data.src} className="pic-img" src={payload.data.src} alt="" draggable={false} />
          {payload.data.caption && <span className="pic-caption">{payload.data.caption}</span>}
        </div>
      )}
    </>
  );
}

export const DogWidget = (p: WidgetProps) => <PictureWidget {...p} service="dog" label="dog cam" />;
export const CatWidget = (p: WidgetProps) => <PictureWidget {...p} service="cat" label="cat cam" />;
export const FoxWidget = (p: WidgetProps) => <PictureWidget {...p} service="fox" label="fox cam" />;
export const DuckWidget = (p: WidgetProps) => <PictureWidget {...p} service="duck" label="duck cam" />;
export const ShibeWidget = (p: WidgetProps) => <PictureWidget {...p} service="shibe" label="shibe cam" />;

/* ── facts ───────────────────────────────────────────────────────── */

interface FactData {
  fact: string;
  source: string;
}

function FactWidget({
  service,
  label,
  settings,
  integrationSettings,
}: WidgetProps & { service: FeedService; label: string }) {
  const payload = useIntegration<FactData>(service, integrationSettings ?? settings, 10 * 60 * 1000);
  const gate = integrationGate(payload, "digging up trivia…");

  return (
    <Shell icon={WIDGET_INFO[service as keyof typeof WIDGET_INFO]?.icon} label={label}>
      {gate ?? (
        <div className="qt">
          <span className="qt-mark">&ldquo;</span>
          <div className="qt-text">{payload!.data!.fact}</div>
          <div className="qt-author">{payload!.data!.source}</div>
        </div>
      )}
    </Shell>
  );
}

export const CatFactWidget = (p: WidgetProps) => <FactWidget {...p} service="catfact" label="cat facts" />;
export const DogFactWidget = (p: WidgetProps) => <FactWidget {...p} service="dogfact" label="dog facts" />;

/* ── spaceflight news ────────────────────────────────────────────── */

interface SpaceNewsData {
  articles: Array<{ title: string; site: string; at: string }>;
}

export function SpaceNewsWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<SpaceNewsData>("spacenews", integrationSettings ?? settings, 10 * 60 * 1000);
  const gate = integrationGate(payload, "checking the launchpad…");

  return (
    <Shell icon={WIDGET_INFO.spacenews.icon} label="space news">
      {gate ?? (
        <div className="headlines">
          {payload!.data!.articles.map((a, i) => (
            <div key={i} className="headline">
              <div className="headline-title">{a.title}</div>
              <div className="headline-site">{a.site}</div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* ── formula 1 ───────────────────────────────────────────────────── */

interface F1Data {
  next: { name: string; circuit: string; date: string; time: string } | null;
  top: Array<{ pos: string; driver: string; points: string }>;
}

export function F1Widget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<F1Data>("f1", integrationSettings ?? settings, 30 * 60 * 1000);
  const gate = integrationGate(payload, "warming the tyres…");

  if (gate) return <Shell icon={WIDGET_INFO.f1.icon} label="formula 1">{gate}</Shell>;
  const { next, top } = payload!.data!;
  const raceDate = next
    ? new Date(`${next.date}T${next.time || "12:00:00Z"}`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Shell icon={WIDGET_INFO.f1.icon} label="formula 1">
      {next ? (
        <BigStat
          value={<span style={{ fontSize: "0.55em" }}>{next.name.replace(" Grand Prix", " GP")}</span>}
          caption={`${raceDate} · ${next.circuit}`}
        />
      ) : (
        <BigStat value="season over" caption="final standings" />
      )}
      {top.length > 0 && (
        <MiniList
          rows={top.map((t) => ({
            key: t.pos,
            left: `${t.pos}. ${t.driver}`,
            right: <b>{t.points} pts</b>,
          }))}
        />
      )}
    </Shell>
  );
}

/* ── city bikes ──────────────────────────────────────────────────── */

interface CityBikesData {
  network: string;
  stations: Array<{ name: string; bikes: number; slots: number; km: number }>;
}

export function CityBikesWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<CityBikesData>("citybikes", integrationSettings ?? settings, 3 * 60 * 1000);
  const gate = integrationGate(payload, "counting bikes…");

  return (
    <Shell
      icon={WIDGET_INFO.citybikes.icon}
      label={`bikes${payload?.data ? ` · ${payload.data.network}` : ""}`}
    >
      {gate ?? (
        <MiniList
          rows={payload!.data!.stations.map((s) => ({
            key: s.name,
            left: s.name.toLowerCase(),
            right: (
              <>
                <b>{s.bikes}</b> <small>bikes · {s.km}km</small>
              </>
            ),
          }))}
        />
      )}
    </Shell>
  );
}

/* ── aircraft overhead ───────────────────────────────────────────── */

interface FlightsData {
  count: number;
  planes: Array<{ callsign: string; altFt: number | null; country: string }>;
}

export function FlightsWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<FlightsData>("flights", integrationSettings ?? settings, 5 * 60 * 1000);
  const gate = integrationGate(payload, "scanning the sky…");

  return (
    <Shell
      icon={WIDGET_INFO.flights.icon}
      label={`overhead · ${settings.location.name.toLowerCase()}`}
    >
      {gate ?? (
        <>
          <BigStat
            value={payload!.data!.count}
            unit={payload!.data!.count === 1 ? "aircraft" : "aircraft"}
            caption="within ~50 miles"
          />
          {payload!.data!.planes.length > 0 && (
            <MiniList
              rows={payload!.data!.planes.map((p) => ({
                key: p.callsign,
                left: p.callsign.toLowerCase(),
                right: p.altFt ? <b>{p.altFt.toLocaleString()} ft</b> : <small>on ground</small>,
              }))}
            />
          )}
        </>
      )}
    </Shell>
  );
}
