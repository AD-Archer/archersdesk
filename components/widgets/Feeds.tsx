"use client";

// Keyless feed widgets — critter cams, facts, headlines, and location-aware
// feeds. Each is a thin view over /api/integrations/<service> via the kit.

import type { FeedService } from "@/lib/types";
import { WIDGET_INFO } from "@/lib/types";
import { BigStat, Empty, MiniList, Shell, integrationGate, useIntegration } from "./kit";
import { lengthClass } from "./Quote";
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
  const icon = WIDGET_INFO[service as keyof typeof WIDGET_INFO]?.icon ?? "pets";

  // a photo owns the whole half, edge to edge like StandBy's photos widget
  if (payload?.configured && payload.data) {
    return (
      <div className="pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={payload.data.src} className="pic-img" src={payload.data.src} alt={label} draggable={false} />
        {payload.data.caption && <span className="pic-caption">{payload.data.caption}</span>}
      </div>
    );
  }

  return (
    <Shell icon={icon} label={label}>
      <Empty>{!payload ? "Fetching a good one…" : (payload.reason ?? "This feed isn’t answering right now")}</Empty>
    </Shell>
  );
}

export const DogWidget = (p: WidgetProps) => <PictureWidget {...p} service="dog" label="Dog cam" />;
export const CatWidget = (p: WidgetProps) => <PictureWidget {...p} service="cat" label="Cat cam" />;
export const FoxWidget = (p: WidgetProps) => <PictureWidget {...p} service="fox" label="Fox cam" />;
export const DuckWidget = (p: WidgetProps) => <PictureWidget {...p} service="duck" label="Duck cam" />;
export const ShibeWidget = (p: WidgetProps) => <PictureWidget {...p} service="shibe" label="Shibe cam" />;

/* ── facts ───────────────────────────────────────────────────────── */

interface FactData {
  fact: string;
  source: string;
}

function FactWidget({
  service,
  label,
  wide,
  settings,
  integrationSettings,
}: WidgetProps & { service: FeedService; label: string }) {
  const payload = useIntegration<FactData>(service, integrationSettings ?? settings, 10 * 60 * 1000);
  const gate = integrationGate(payload, "digging up trivia…");

  return (
    <Shell icon={WIDGET_INFO[service as keyof typeof WIDGET_INFO]?.icon} label={label}>
      {gate ?? (
        <div className={`qt fact ${lengthClass(payload!.data!.fact)}${wide ? " wide" : ""}`}>
          <div className="qt-text">{payload!.data!.fact}</div>
          <div className="qt-author">{payload!.data!.source}</div>
        </div>
      )}
    </Shell>
  );
}

export const CatFactWidget = (p: WidgetProps) => <FactWidget {...p} service="catfact" label="Cat facts" />;
export const DogFactWidget = (p: WidgetProps) => <FactWidget {...p} service="dogfact" label="Dog facts" />;

/* ── spaceflight news ────────────────────────────────────────────── */

interface SpaceNewsData {
  articles: Array<{ title: string; site: string; at: string }>;
}

export function SpaceNewsWidget({ settings, integrationSettings, wide }: WidgetProps) {
  const payload = useIntegration<SpaceNewsData>("spacenews", integrationSettings ?? settings, 10 * 60 * 1000);
  const gate = integrationGate(payload, "checking the launchpad…");

  return (
    <Shell icon={WIDGET_INFO.spacenews.icon} label="Space news">
      {gate ?? (
        <div className={`headlines${wide ? " wide" : ""}`}>
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

  if (gate) return <Shell icon={WIDGET_INFO.f1.icon} label="Formula 1">{gate}</Shell>;
  const { next, top } = payload!.data!;
  const raceDate = next
    ? new Date(`${next.date}T${next.time || "12:00:00Z"}`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Shell icon={WIDGET_INFO.f1.icon} label="Formula 1">
      <div className="f1-next">
        <span className="f1-when">{next ? raceDate : "Season over"}</span>
        <span className="f1-name">{next ? next.name.replace(" Grand Prix", " GP") : "Final standings"}</span>
        {next && <span className="f1-where">{next.circuit}</span>}
      </div>
      {top.length > 0 && (
        <MiniList
          rows={top.map((t) => ({
            key: t.pos,
            left: (
              <>
                <span className="f1-pos">{t.pos}</span> {t.driver}
              </>
            ),
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
      label={`City bikes${payload?.data ? ` · ${payload.data.network}` : ""}`}
    >
      {gate ?? (
        <MiniList
          rows={payload!.data!.stations.map((s) => ({
            key: s.name,
            left: s.name,
            right: (
              <>
                <b>{s.bikes}</b> <small>bikes, {s.km} km</small>
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
      label={`Overhead · ${settings.location.name}`}
    >
      {gate ?? (
        <>
          <BigStat
            value={payload!.data!.count}
            unit="aircraft"
            caption="Within about 50 miles"
          />
          {payload!.data!.planes.length > 0 && (
            <MiniList
              rows={payload!.data!.planes.map((p) => ({
                key: p.callsign,
                left: <span className="k-strong">{p.callsign}</span>,
                right: p.altFt ? <b>{p.altFt.toLocaleString()} ft</b> : <small>On the ground</small>,
              }))}
            />
          )}
        </>
      )}
    </Shell>
  );
}
