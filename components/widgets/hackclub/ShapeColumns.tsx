"use client";

// One column a day, lit out of the field cont.d's landing page and intro sit
// on (ShapeWaves over there): a faint grey grid of mixed shapes, and each
// day's value lit from the floor up in the widget's own shape and the panel's
// tint, so the shipped chart lights circles and the remakes chart squares.
// The cont.d counterpart of DitherBars, with the same props plus `shape`.

import { useLayoutEffect, useRef } from "react";
import { drawCell, FIELD_RGB, shapeAt, type ShapeKind } from "./shapes";

const CELL = 6; // css px per cell: the shape and its gap
const SIZE = 4.2; // css px, the shape itself
const FIELD = 0.2; // an unlit cell: the hero's grey, faint

/** Oldest left, today right at full strength; the rest recede so the eye
 *  lands on today. A zero day is just the field, so it reads as "none". */
export function ShapeColumns({ days, label, shape = "mixed" }: { days: number[]; label: string; shape?: ShapeKind }) {
  const plot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const wrap = plot.current;
    const c = canvas.current;
    if (!wrap || !c || days.length === 0) return;
    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const rgb = getComputedStyle(c).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).join(",") ?? "255,255,255";
      const max = Math.max(1, ...days);
      const rows = Math.max(4, Math.floor(h / CELL));
      const step = w / days.length;
      // a cell's gap between days once they're wide enough to spare it
      const across = Math.max(1, Math.floor(step / CELL) - (step >= CELL * 3 ? 1 : 0));
      days.forEach((v, i) => {
        const lit = v > 0 ? Math.max(1, Math.round((v / max) * rows)) : 0;
        const strength = i === days.length - 1 ? 1 : 0.68;
        const x0 = Math.round(i * step);
        for (let col = 0; col < across; col++) {
          for (let row = 0; row < rows; row++) {
            const on = row < lit;
            const gx = i * across + col;
            ctx.fillStyle = on ? `rgba(${rgb},${strength})` : `rgba(${FIELD_RGB},${FIELD})`;
            drawCell(
              ctx,
              shapeAt(on ? shape : "mixed", gx, row),
              x0 + col * CELL + CELL / 2,
              h - row * CELL - CELL / 2,
              on ? SIZE : SIZE * 0.72,
            );
          }
        }
      });
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [days, shape]);

  if (days.length === 0) return null;
  const total = days.reduce((a, b) => a + b, 0);
  const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return (
    <figure
      className="shape-columns"
      role="img"
      aria-label={`${label}: ${n(total)} over ${days.length} days, ${n(days[days.length - 1])} today`}
    >
      <div ref={plot} className="shape-columns-plot">
        <canvas ref={canvas} />
      </div>
      <figcaption className="shape-columns-x">
        <span>{days.length} days ago</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
