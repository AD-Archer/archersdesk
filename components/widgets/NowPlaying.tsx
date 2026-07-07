"use client";

import type { NowPlayingData } from "@/lib/types";
import { usePoll } from "../hooks";
import type { WidgetProps } from "./registry";

export function NowPlayingWidget({ config }: WidgetProps) {
  const np = usePoll<NowPlayingData>("/api/nowplaying", 15_000, [config.lastfm.username]);

  let body: React.ReactNode;
  if (!np) {
    body = <div className="np-idle">tuning in…</div>;
  } else if (!np.configured) {
    body = <div className="np-idle">{np.reason ?? "set lastfm.username in your config"}</div>;
  } else if (!np.track) {
    body = <div className="np-idle">nothing scrobbled yet — spin something on navidrome</div>;
  } else {
    const t = np.track;
    body = (
      <>
        {t.art && <div className="np-ambient" style={{ backgroundImage: `url(${t.art})` }} />}
        {t.art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="np-art" src={t.art} alt="" draggable={false} />
        ) : (
          <div className="np-art" />
        )}
        <div className="np-text">
          {np.playing ? (
            <div className="eq" aria-label="playing">
              <i />
              <i />
              <i />
              <i />
            </div>
          ) : (
            <div className="np-last">last played</div>
          )}
          <div className="np-title">{t.name}</div>
          <div className="np-artist">{t.artist}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <span className="w-label">now playing</span>
      <div className={`np${np?.playing ? "" : " paused"}`}>{body}</div>
    </>
  );
}
