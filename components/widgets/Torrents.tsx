"use client";

// qBittorrent + Transmission — normalized to the same shape server-side (see
// lib/integrations.ts), so one component renders both. A summary row of the
// key totals, then a paginated list of individual torrents (swipe / arrows to
// page through), so you see several at once instead of one stat at a time.

import { WIDGET_INFO } from "@/lib/types";
import { BigStat, Shell, integrationGate, useIntegration } from "./kit";
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

/** a torrent name a person can read: no extension, separators as spaces */
function plainName(name: string) {
  return name
    .replace(/\.(iso|mkv|mp4|avi|zip|rar|7z|tar|gz|img|dmg)$/i, "")
    .replace(/_+/g, " ")
    // dots become spaces, except inside version numbers (24.04.1 stays)
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
      <Shell icon={WIDGET_INFO[service].icon} label={service === "qbittorrent" ? "qBittorrent" : "Transmission"}>
        {gate}
      </Shell>
    );
  const d = payload!.data!;

  // one figure, one plain line: what's downloading now, else what's shared
  const downloading = d.torrents.filter((t) => t.state === "downloading");
  const busy = downloading.length > 0;
  const line = busy
    ? `Downloading at ${speedText(d.downloadSpeed)}`
    : d.torrents.length
      ? "All finished, sharing with others"
      : "Nothing downloading";
  const rows = (busy ? downloading : d.torrents).slice(0, 3);

  return (
    <Shell icon={WIDGET_INFO[service].icon} label="Downloads">
      <BigStat value={busy ? downloading.length : seedingCount(d)} unit={busy ? "downloading" : "sharing"} caption={line} />
      {wide && rows.length > 0 && (
        <div className="torrent-rows">
          {rows.map((t) => (
            <div key={t.id} className="torrent-row">
              <div className="torrent-row-top">
                <span className="torrent-row-name">{plainName(t.name)}</span>
                <span className="torrent-row-pct">{Math.round(t.progress)}%</span>
              </div>
              <div className="torrent-bar">
                <div className="torrent-bar-fill" style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

export const QbittorrentWidget = (p: WidgetProps) => <TorrentClientWidget {...p} service="qbittorrent" />;
export const TransmissionWidget = (p: WidgetProps) => <TorrentClientWidget {...p} service="transmission" />;
