"use client";

// Navidrome — a real mini player, not just a "now playing" glance. Square
// mode is compact transport controls; wide adds search + browsing. Audio
// streams through /api/navidrome/stream (the stream url itself carries no
// Subsonic credentials) and playback state lives in this component only —
// swiping away stops it, same as every other widget being a stateless view
// over its data.

import { useEffect, useRef, useState } from "react";
import type {
  NavidromeAlbum,
  NavidromeBrowseData,
  NavidromePlaylist,
  NavidromeSearchData,
  NavidromeSong,
  NavidromeTrackListData,
} from "@/lib/types";
import { WIDGET_INFO } from "@/lib/types";
import { Empty, Shell, integrationGate, useIntegration, useIntegrationAction } from "./kit";
import type { WidgetProps } from "./registry";

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function coverUrl(id: string): string {
  return `/api/navidrome/cover?id=${encodeURIComponent(id)}`;
}

export function NavidromeWidget({ wide, settings, integrationSettings }: WidgetProps) {
  const s = integrationSettings ?? settings;
  const payload = useIntegration<NavidromeBrowseData>("navidrome", s, 5 * 60 * 1000);
  const act = useIntegrationAction("navidrome");
  const gate = integrationGate(payload, "connecting to navidrome…");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<NavidromeSong[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NavidromeSearchData | null>(null);

  const track = queue[index] ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    audio.src = `/api/navidrome/stream?id=${encodeURIComponent(track.id)}`;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  function playQueue(songs: NavidromeSong[], startAt = 0) {
    if (!songs.length) return;
    setQueue(songs);
    setIndex(startAt);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function next() {
    if (index + 1 < queue.length) setIndex(index + 1);
    else setPlaying(false); // end of queue — "ended" never fires a pause event
  }

  function prev() {
    if (index > 0) setIndex(index - 1);
  }

  async function loadAlbum(id: string) {
    const res = await act("album", { id });
    const songs = (res.data as NavidromeTrackListData | undefined)?.songs ?? [];
    playQueue(songs, 0);
  }

  async function loadPlaylist(id: string) {
    const res = await act("playlist", { id });
    const songs = (res.data as NavidromeTrackListData | undefined)?.songs ?? [];
    playQueue(songs, 0);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const res = await act("search", { query: query.trim() });
    setResults((res.data as NavidromeSearchData | undefined) ?? { songs: [], albums: [] });
    setSearching(false);
  }

  function seekTo(pct: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = pct * duration;
  }

  if (gate) {
    return (
      <Shell icon={WIDGET_INFO.navidrome.icon} label="navidrome">
        <div className="navp">{gate}</div>
      </Shell>
    );
  }

  const player = (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={next}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {track ? (
        <>
          <div className="navp-ambient" style={{ backgroundImage: `url(${coverUrl(track.coverArt || track.id)})` }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="navp-art" src={coverUrl(track.coverArt || track.id)} alt="" draggable={false} />
          <div className="navp-text">
            <div className="navp-title">{track.title}</div>
            <div className="navp-artist">{track.artist}</div>
            <div
              className="navp-bar"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }}
            >
              <div className="navp-bar-fill" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            </div>
            <div className="navp-time">
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>
          <div className="navp-controls">
            <button className="navp-btn" onClick={prev} disabled={index === 0} aria-label="previous">
              ⏮
            </button>
            <button className="navp-btn navp-btn-main" onClick={togglePlay} aria-label={playing ? "pause" : "play"}>
              {playing ? "⏸" : "▶"}
            </button>
            <button className="navp-btn" onClick={next} disabled={index + 1 >= queue.length} aria-label="next">
              ⏭
            </button>
          </div>
        </>
      ) : (
        <Empty>{wide ? "search or pick a playlist below" : "open the wide view to browse your library"}</Empty>
      )}
    </>
  );

  if (!wide) {
    return (
      <Shell icon={WIDGET_INFO.navidrome.icon} label="navidrome">
        <div className="navp">{player}</div>
      </Shell>
    );
  }

  const browsePlaylists: NavidromePlaylist[] = payload?.data?.playlists ?? [];
  const browseAlbums: NavidromeAlbum[] = payload?.data?.recentAlbums ?? [];

  return (
    <Shell icon={WIDGET_INFO.navidrome.icon} label="navidrome">
      <div className="navp navp-wide">
        <div className="navp-browse">
          <form className="navp-search" onSubmit={runSearch}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search your library"
              maxLength={120}
            />
          </form>
          <div className="navp-lists">
            {searching ? (
              <Empty>searching…</Empty>
            ) : results ? (
              <>
                {results.songs.map((song, i) => (
                  <button key={song.id} className="navp-row" onClick={() => playQueue(results.songs, i)}>
                    <span className="navp-row-title">{song.title}</span>
                    <span className="navp-row-sub">{song.artist}</span>
                  </button>
                ))}
                {results.albums.map((album) => (
                  <button key={album.id} className="navp-row" onClick={() => loadAlbum(album.id)}>
                    <span className="navp-row-title">{album.name}</span>
                    <span className="navp-row-sub">{album.artist}</span>
                  </button>
                ))}
                {!results.songs.length && !results.albums.length && <Empty>no matches</Empty>}
              </>
            ) : (
              <>
                {browsePlaylists.map((pl) => (
                  <button key={pl.id} className="navp-row" onClick={() => loadPlaylist(pl.id)}>
                    <span className="navp-row-title">{pl.name}</span>
                    <span className="navp-row-sub">{pl.songCount} tracks</span>
                  </button>
                ))}
                {browseAlbums.map((album) => (
                  <button key={album.id} className="navp-row" onClick={() => loadAlbum(album.id)}>
                    <span className="navp-row-title">{album.name}</span>
                    <span className="navp-row-sub">{album.artist}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="navp-now">{player}</div>
      </div>
    </Shell>
  );
}
