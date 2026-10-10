"use client";

import type { NowPlayingData } from "@/lib/types";
import { usePoll } from "../hooks";
import type { WidgetProps } from "./registry";

/** StandBy's music widget: album art, title and artist, with a small
 *  playing / paused icon in the corner. */
export function NowPlayingWidget({ settings, wide }: WidgetProps) {
  const np = usePoll<NowPlayingData>("/api/nowplaying", 15_000, [settings.lastfm.username]);

  if (!np || !np.configured || !np.track) {
    return (
      <div className="hero-np empty">
        <span className="hero-np-glyph" aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 17.5a3 3 0 1 1-2-2.83V5.6a1 1 0 0 1 .76-.97l10-2.5A1 1 0 0 1 19 3.1v11.4a3 3 0 1 1-2-2.83V7.28l-8 2v8.22z" />
          </svg>
        </span>
        {/* setup lives in settings; the board only says what's playing */}
        <p className="w-empty">{!np ? "" : "Nothing playing"}</p>
      </div>
    );
  }

  const t = np.track;
  return (
    <div className={`hero-np${wide ? " wide" : ""}${np.playing ? " playing" : ""}`}>
      <div className="hero-np-cover">
        {t.art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-np-art" src={t.art} alt="" draggable={false} />
        ) : (
          <div className="hero-np-art blank" aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 17.5a3 3 0 1 1-2-2.83V5.6a1 1 0 0 1 .76-.97l10-2.5A1 1 0 0 1 19 3.1v11.4a3 3 0 1 1-2-2.83V7.28l-8 2v8.22z" />
            </svg>
          </div>
        )}
        {/* playing or not: one small badge on the art, so the art and words get the room */}
        <span
          className="hero-np-status"
          role="img"
          aria-label={np.playing ? "Playing now" : "Last played"}
          title={np.playing ? "Playing now" : "Last played"}
        >
          {np.playing ? (
            <span className="hero-np-bars" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          )}
        </span>
      </div>
      <div className="hero-np-text">
        <div className="hero-np-title">{t.name}</div>
        <div className="hero-np-artist">{t.artist}</div>
      </div>
    </div>
  );
}
