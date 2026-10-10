"use client";

// The sign-in page's hero: the live StandBy clock, the same two-tone rounded
// digits the desk shows once you're in, with today's date above. It's drawn
// only after mount — the server doesn't know this screen's time zone — and a
// blank box of the same size holds its place until then.

import { useMounted, useNow } from "./hooks";
import { clock12 } from "./alarmUtil";
import { BigTime } from "./widgets/kit";

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function LanderClock() {
  const mounted = useMounted();
  const now = useNow(1000);
  const { time, ampm } = clock12(now);
  return (
    <div className="lander-clock">
      <p className="lander-date">{mounted ? DATE_FMT.format(now) : " "}</p>
      {mounted ? (
        <BigTime className="lander-time" time={time} ampm={ampm} tone />
      ) : (
        <span className="lander-time tt" aria-hidden>
          <span className="tt-d">&nbsp;</span>
        </span>
      )}
    </div>
  );
}
