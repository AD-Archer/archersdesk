"use client";

// One column a day in an ordered (Bayer) dither, the way phantom draws its
// admin charts. The painter is dither-kit's (https://tripwire.sh/dither-kit,
// MIT), cut down to the one fill these widgets use: every cell is the tint at
// some opacity, dense at the floor and thinning toward a soft top edge.
// Drawn small and scaled up `pixelated`, so a cell stays a crisp 2px square.
// The colour is the canvas's own css `color` (the panel's --tint), so each
// program's widgets paint in that program's colour with no prop to pass.

import { useLayoutEffect, useRef } from "react";

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

const CELL = 2; // css px per dither cell
const EDGE = 0.72; // the top edge, just under solid
const OFF = 0.4; // an "off" cell is the same colour, fainter, never a hole

/** Fill column `x` from `top` down to `floor`: solid at the floor, dissolving
 *  upward, capped with a soft edge. `dim` fades the whole column. */
function paintColumn(ctx: CanvasRenderingContext2D, x: number, top: number, floor: number, rgb: string, dim: number) {
  const t = Math.round(top);
  const depth = floor - t;
  ctx.fillStyle = `rgba(${rgb},${EDGE * dim})`;
  ctx.fillRect(x, t, 1, 1);
  for (let y = t + 1; y < floor; y++) {
    const density = (y - t) / depth;
    const lit = density > BAYER[y & 3][x & 3];
    const k = 0.3 + density * 0.7;
    ctx.fillStyle = `rgba(${rgb},${Math.min(1, (lit ? k : k * OFF) * dim)})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Oldest left, today right at full strength; the rest recede so the eye
 *  lands on today. A zero day keeps its edge, so it reads as "none". */
export function DitherBars({ days, label }: { days: number[]; label: string }) {
  const plot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const wrap = plot.current;
    const c = canvas.current;
    if (!wrap || !c || days.length === 0) return;
    const paint = () => {
      const cols = Math.max(8, Math.round(wrap.clientWidth / CELL));
      const rows = Math.max(8, Math.round(wrap.clientHeight / CELL));
      c.width = cols;
      c.height = rows;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const rgb = getComputedStyle(c).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).join(",") ?? "255,255,255";
      const max = Math.max(1, ...days);
      const step = cols / days.length;
      // a one-cell gap between columns once they're wide enough to spare it
      const gap = step >= 3 ? 1 : 0;
      const floor = rows;
      days.forEach((v, i) => {
        const x0 = Math.round(i * step);
        const x1 = Math.max(x0 + 1, Math.round((i + 1) * step) - gap);
        const top = (1 - v / max) * (floor - 1);
        for (let x = x0; x < x1; x++) paintColumn(ctx, x, top, floor, rgb, i === days.length - 1 ? 1 : 0.6);
      });
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [days]);

  if (days.length === 0) return null;
  const total = days.reduce((a, b) => a + b, 0);
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <figure
      className="dither-bars"
      role="img"
      aria-label={`${label}: ${n(total)} over ${days.length} days, ${n(days[days.length - 1])} today`}
    >
      <div ref={plot} className="dither-bars-plot">
        <canvas ref={canvas} />
      </div>
      <figcaption className="dither-bars-x">
        <span>{days.length} days ago</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
