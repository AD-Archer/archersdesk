"use client";

// Epic Games Store free games — one card per game (free now + upcoming),
// swipe/arrows between them so each title gets the full panel width and can
// wrap instead of truncating. Data via the server-side epic-free-games fetcher.

import { WIDGET_INFO } from "@/lib/types";
import { SwipeCarousel } from "./Carousel";
import { Empty, Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface EpicGame {
  title: string;
  image: string | null;
  url: string;
  free: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

interface EpicData {
  current: EpicGame[];
  next: EpicGame[];
}

function shortDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EpicGamesWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<EpicData>("epicgames", integrationSettings ?? settings, 30 * 60 * 1000);
  const gate = integrationGate(payload, "checking the epic store…");

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.epicgames.icon} label="epic free games">
        {gate}
      </Shell>
    );

  const { current, next } = payload!.data!;
  const games = [...current, ...next];

  return (
    <Shell icon={WIDGET_INFO.epicgames.icon} label="epic free games">
      {games.length === 0 ? (
        <Empty>nothing free right now</Empty>
      ) : (
        <SwipeCarousel
          items={games}
          getKey={(g, i) => `${g.title}${i}`}
          renderItem={(g) => (
            <div className="epic-card">
              {g.image && <img className="epic-art" src={g.image} alt="" draggable={false} />}
              <span className={`epic-badge${g.free ? " now" : ""}`}>{g.free ? "free now" : "coming soon"}</span>
              <span className="epic-title">{g.title}</span>
              <span className="epic-meta">
                {g.free ? `claim by ${shortDate(g.endsAt)}` : `free ${shortDate(g.startsAt)}`}
              </span>
            </div>
          )}
        />
      )}
    </Shell>
  );
}
