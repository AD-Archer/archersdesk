"use client";

// A big figure drawn out of shapes, the way cont.d's landing page draws its
// wordmark out of its field (ShapeWaves over there): the number is set in the
// panel's face, sampled on a grid, and every cell inside a stroke becomes one
// shape in the panel's tint. A widget's shape is its stage's, so "shipped" is
// built from circles and "remakes" from squares. It ripples in from its centre
// when it first shows and whenever it changes, as the hero does on load;
// reduced motion just draws it.

import { useLayoutEffect, useRef } from "react";
import { drawCell, shapeAt, type ShapeKind } from "./shapes";

const CELLS_TALL = 17; // cells from the top of a digit to the baseline: enough to read from across a room
const RIPPLE = 520; // ms for the ripple to reach the far edge
const GROW = 360; // ms for one cell to grow in
const smooth = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

export function ShapeFigure({ text, shape = "mixed" }: { text: string; shape?: ShapeKind }) {
  const box = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    const c = canvas.current;
    if (!el || !c) return;
    let raf = 0;
    let cancelled = false;

    // `animate` false: just redraw, for a panel that changed size
    const run = async (animate: boolean) => {
      cancelAnimationFrame(raf);
      // the size and face the figure would have had as text
      const css = getComputedStyle(el);
      const size = parseFloat(css.fontSize);
      const font = `700 ${size}px ${css.fontFamily}`;
      await document.fonts?.load(font).catch(() => undefined);
      if (cancelled) return;

      const probe = document.createElement("canvas").getContext("2d");
      if (!probe) return;
      probe.font = font;
      const m = probe.measureText(text);
      const ascent = Math.ceil(probe.measureText("0123456789%").actualBoundingBoxAscent);
      const cell = Math.max(3, ascent / CELLS_TALL);
      const w = Math.ceil(m.width + cell);
      const h = Math.ceil(ascent + cell * 0.5);

      // the text at full size, read back as a mask: a cell is in when most of it is ink
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.font = font;
      octx.textBaseline = "alphabetic";
      octx.fillStyle = "#000";
      octx.fillText(text, cell / 2, h - cell * 0.25);
      const ink = octx.getImageData(0, 0, w, h).data;
      const cols = Math.floor(w / cell);
      const rows = Math.floor(h / cell);
      const cells: { x: number; y: number; d: number }[] = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let hit = 0;
          for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]]) {
            const px = Math.floor((x + fx) * cell);
            const py = Math.floor((y + fy) * cell);
            if (ink[(py * w + px) * 4 + 3] > 120) hit++;
          }
          if (hit >= 3) cells.push({ x, y, d: Math.hypot(x - cols / 2, (y - rows / 2) * 1.2) });
        }
      }
      const far = Math.max(1, ...cells.map((k) => k.d));

      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const still = !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const start = performance.now();
      const paint = (now: number) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = getComputedStyle(c).color;
        let done = true;
        for (const k of cells) {
          const t = still ? 1 : smooth((now - start - (k.d / far) * RIPPLE) / GROW);
          if (t < 1) done = false;
          if (t <= 0) continue;
          drawCell(ctx, shapeAt(shape, k.x, k.y), (k.x + 0.5) * cell, (k.y + 0.5) * cell, cell * 0.86 * t);
        }
        if (!done && !cancelled) raf = requestAnimationFrame(paint);
      };
      raf = requestAnimationFrame(paint);
    };
    run(true);
    // the panel's size sets the figure's; ResizeObserver reports once on observe, which isn't a change
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) first = false;
      else run(false);
    });
    ro.observe(el.closest(".panel") ?? el.parentElement ?? el);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [text, shape]);

  return (
    <span ref={box} className="shape-figure" role="img" aria-label={text}>
      <canvas ref={canvas} />
    </span>
  );
}
