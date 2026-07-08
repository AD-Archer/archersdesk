"use client";

// Jellyseerr / Overseerr — approve or decline pending media requests. Swiping
// cycles which request card is showing (via SwipeCarousel); the two buttons
// on the card perform the action, so browsing and acting stay unambiguous.

import { useEffect, useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { SwipeCarousel } from "./Carousel";
import { BigStat, Empty, MI, Shell, integrationGate, useIntegration, useIntegrationAction } from "./kit";
import type { WidgetProps } from "./registry";

interface SeerrRequest {
  id: number;
  title: string;
  poster: string | null;
  mediaType: "movie" | "tv";
  requestedBy: string;
  overview: string;
  releaseDate: string;
  voteAverage: number | null;
}

interface SeerrData {
  counts: { pending: number; approved: number; declined: number; available: number; total: number };
  pending: SeerrRequest[];
}

export function SeerrWidget({ wide, settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<SeerrData>("seerr", integrationSettings ?? settings, 30 * 1000);
  const act = useIntegrationAction("seerr");
  const [localPending, setLocalPending] = useState<SeerrRequest[] | null>(null);
  const [detail, setDetail] = useState<SeerrRequest | null>(null);
  const gate = integrationGate(payload, "checking the queue…");

  useEffect(() => {
    setLocalPending(payload?.data?.pending ?? null);
  }, [payload?.data?.pending]);

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.seerr.icon} label="seerr">
        {gate}
      </Shell>
    );
  const d = payload!.data!;
  const list = localPending ?? d.pending;

  function respond(id: number, action: "approve" | "decline") {
    setLocalPending((cur) => (cur ?? d.pending).filter((r) => r.id !== id));
    setDetail((cur) => (cur?.id === id ? null : cur));
    void act(action, { requestId: id });
  }

  return (
    <Shell icon={WIDGET_INFO.seerr.icon} label="seerr">
      <span className="hero-tap-icon">
        <MI name={WIDGET_INFO.seerr.icon} className="hero-tap-mi" />
      </span>
      <BigStat
        value={d.counts.pending}
        unit="pending"
        caption={`${d.counts.approved} approved · ${d.counts.available} available`}
      />
      {list.length === 0 ? (
        <Empty>no pending requests</Empty>
      ) : (
        <SwipeCarousel
          items={list}
          perView={wide ? 3 : 2}
          getKey={(r) => String(r.id)}
          onItemTap={(r) => setDetail(r)}
          renderItem={(r) => (
            <div className="seerr-row">
              {r.poster && <img className="seerr-row-thumb" src={r.poster} alt="" draggable={false} />}
              <div className="seerr-row-body">
                <span className="seerr-row-title">{r.title}</span>
                <span className="seerr-row-meta">
                  {r.mediaType} · {r.requestedBy}
                </span>
              </div>
              <div className="seerr-row-actions">
                <button className="seerr-icon-btn approve" onClick={() => respond(r.id, "approve")} aria-label="approve">
                  ✓
                </button>
                <button className="seerr-icon-btn reject" onClick={() => respond(r.id, "decline")} aria-label="reject">
                  ✕
                </button>
              </div>
            </div>
          )}
        />
      )}

      <EditablePopup
        open={detail !== null}
        title={detail?.title ?? ""}
        onClose={() => setDetail(null)}
        footer={
          detail && (
            <>
              <button className="edit-pop-muted" onClick={() => respond(detail.id, "decline")}>
                reject
              </button>
              <span style={{ flex: 1 }} />
              <button className="edit-pop-primary" onClick={() => respond(detail.id, "approve")}>
                approve
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="seerr-detail">
            {detail.poster && <img className="seerr-detail-poster" src={detail.poster} alt="" draggable={false} />}
            <div className="seerr-detail-meta">
              <div className="seerr-detail-sub">
                {detail.mediaType} · requested by {detail.requestedBy}
              </div>
              <div className="seerr-detail-sub">
                {detail.releaseDate && <span>{detail.releaseDate.slice(0, 4)}</span>}
                {detail.voteAverage !== null && <span> · ★ {detail.voteAverage.toFixed(1)}</span>}
              </div>
              {detail.overview && <p className="seerr-detail-overview">{detail.overview}</p>}
            </div>
          </div>
        )}
      </EditablePopup>
    </Shell>
  );
}
