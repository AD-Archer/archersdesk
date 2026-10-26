"use client";

// A figure that decrypts into place, the way cont.d's admin titles do
// (DecryptedText over there): each digit flickers through others, dimmed, and
// settles left to right. It plays when the figure first shows and whenever it
// changes, so a number moving on the desk is the thing that catches the eye.
// Only digits flicker, and the figures are tabular, so nothing shifts while it
// plays. Reduced motion just shows the number.

import { useEffect, useState } from "react";

const DURATION = 700; // ms from first flicker to the last digit settling
const FRAME = 45; // ms between flickers: steady, not a blur, and light on the Echo

/** How far `text`'s reveal has got. Kept with the text it belongs to, so a new
 *  number starts unsettled instead of flashing in whole before it plays. */
type Reveal = { text: string; settled: number; noise: string };

export function Decrypt({ text }: { text: string }) {
  const [reveal, setReveal] = useState<Reveal | null>(null);

  useEffect(() => {
    const chars = [...text];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReveal({ text, settled: chars.length, noise: text });
      return;
    }
    const start = performance.now();
    let raf = 0;
    let shown = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      if (now - shown >= FRAME || t === 1) {
        shown = now;
        setReveal({
          text,
          settled: t === 1 ? chars.length : Math.floor(t * chars.length),
          noise: chars.map((c) => (/\d/.test(c) ? String(Math.floor(Math.random() * 10)) : c)).join(""),
        });
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  const r = reveal?.text === text ? reveal : { text, settled: 0, noise: text };
  const noisy = [...r.noise];
  return (
    <span className="decrypt" aria-label={text}>
      <span aria-hidden>
        {[...text].map((c, i) =>
          i < r.settled || !/\d/.test(c) ? (
            c
          ) : (
            <span key={i} className="decrypt-on">
              {noisy[i] ?? c}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
