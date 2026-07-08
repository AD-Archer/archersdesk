"use client";

// qBittorrent + Transmission — normalized to the same shape server-side (see
// lib/integrations.ts), so one component renders both. A summary row of the
// key totals, then a paginated list of individual torrents (swipe / arrows to
// page through), so you see several at once instead of one stat at a time.

import { WIDGET_INFO } from "@/lib/types";
import { SwipeCarousel } from "./Carousel";
import { BigStat, Empty, MI, Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface TorrentItem {
  id: string;
  name: string;
  progress: number; // 0-100
  dlspeed: number;
  upspeed: number;
  ratio: number;
  size: number;
  eta: number;
  state: string;
}

interface TorrentData {
  downloadSpeed: number;
  uploadSpeed: number;
  torrents: TorrentItem[];
}

function speedText(bytesPerSec: number) {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
}

function seedingCount(d: TorrentData) {
  return d.torrents.filter((t) => t.state === "seeding").length;
}

// seeding is the big hero number above; the row keeps three balanced stats
// so the widget reads like the others (e.g. seerr) rather than lopsided.
function summaryItems(d: TorrentData, wide: boolean | undefined) {
  const downloading = d.torrents.filter((t) => t.state === "downloading").length;
  const avgRatio = d.torrents.length ? d.torrents.reduce((sum, t) => sum + t.ratio, 0) / d.torrents.length : 0;
  const base = [
    { label: "down", value: speedText(d.downloadSpeed) },
    { label: "up", value: speedText(d.uploadSpeed) },
    { label: "ratio", value: avgRatio.toFixed(2) },
  ];
  if (!wide) return base;
  return [...base, { label: "downloading", value: downloading }, { label: "total", value: d.torrents.length }];
}

function TorrentClientWidget({
  service,
  wide,
  settings,
  integrationSettings,
}: WidgetProps & { service: "qbittorrent" | "transmission" }) {
  const payload = useIntegration<TorrentData>(service, integrationSettings ?? settings, 20 * 1000);
  const gate = integrationGate(payload, "checking the swarm…");

  if (gate)
    return (
      <Shell icon={WIDGET_INFO[service].icon} label={WIDGET_INFO[service].label}>
        {gate}
      </Shell>
    );
  const d = payload!.data!;

  return (
    <Shell icon={WIDGET_INFO[service].icon} label={WIDGET_INFO[service].label}>
      <span className="hero-tap-icon">
        <MI name={WIDGET_INFO[service].icon} className="hero-tap-mi" />
      </span>
      <BigStat value={seedingCount(d)} unit="seeding" />
      <div className="torrent-summary">
        {summaryItems(d, wide).map((it) => (
          <div key={it.label} className="torrent-summary-item">
            <b>{it.value}</b>
            <small>{it.label}</small>
          </div>
        ))}
      </div>

      {d.torrents.length === 0 ? (
        <Empty>no torrents right now</Empty>
      ) : (
        <SwipeCarousel
          items={d.torrents}
          perView={wide ? 3 : 2}
          getKey={(t) => t.id}
          renderItem={(t) => (
            <div className="torrent-row">
              <div className="torrent-row-top">
                <span className="torrent-row-name">{t.name}</span>
                <span className="torrent-row-pct">{Math.round(t.progress)}%</span>
              </div>
              <div className="torrent-bar">
                <div className="torrent-bar-fill" style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }} />
              </div>
              <div className="torrent-row-meta">
                <span>{t.state}</span>
                <span>
                  ↓ {speedText(t.dlspeed)} · ↑ {speedText(t.upspeed)} · {t.ratio.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        />
      )}
    </Shell>
  );
}

export const QbittorrentWidget = (p: WidgetProps) => <TorrentClientWidget {...p} service="qbittorrent" />;
export const TransmissionWidget = (p: WidgetProps) => <TorrentClientWidget {...p} service="transmission" />;
