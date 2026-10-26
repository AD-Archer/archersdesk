"use client";

// A figure that dithers into place, in the ordered (Bayer) dither phantom
// draws its admin charts in (DitherBars): the number is set in the panel's
// face, and its cells come on from the floor up through the 4×4 matrix, a
// ragged dithered edge climbing the digits until they're solid, the way one
// of DitherBars' columns looks. It plays when the figure first shows and
// whenever it changes, ticking at a steady frame rate so it reads as pixels,
// not a fade. Reduced motion just draws it.

import { useLayoutEffect, useRef } from "react";

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

const DURATION = 640; // ms for the edge to climb from the floor past the top
const BAND = 0.45; // how much of the figure's height the dithered edge spans
const FRAME = 40; // ms between steps: crunchy, like an old screen, and light on the Echo

export function DitherFigure({ text }: { text: string }) {
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
      // the size, weight and face the figure would have had as text
      const css = getComputedStyle(el);
      const size = parseFloat(css.fontSize);
      const font = `${css.fontWeight} ${size}px ${css.fontFamily}`;
      await document.fonts?.load(font).catch(() => undefined);
      if (cancelled) return;

      const probe = document.createElement("canvas").getContext("2d");
      if (!probe) return;
      probe.font = font;
      const m = probe.measureText(text);
      const ascent = Math.ceil(probe.measureText("0123456789%$").actualBoundingBoxAscent);
      const descent = Math.max(0, Math.ceil(m.actualBoundingBoxDescent));
      // a dither cell: the charts' 2px on a small figure, chunkier on a big one
      const cell = Math.max(2, Math.round(size / 26));
      const w = Math.ceil(m.width) + cell;
      const h = ascent + descent + cell;

      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      // the box's foot sits on the baseline (as ShapeFigure's does); nudge
      // the drawing down by what hangs below it, a comma's tail
      c.style.top = `${descent + cell / 2}px`;
      const ctx = c.getContext("2d");
      if (!ctx) return;

      // the figure, solid, kept aside: each frame copies it through the mask
      const ink = document.createElement("canvas");
      ink.width = c.width;
      ink.height = c.height;
      const ictx = ink.getContext("2d");
      if (!ictx) return;
      ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ictx.font = font;
      ictx.textBaseline = "alphabetic";
      ictx.fillStyle = getComputedStyle(c).color;
      ictx.fillText(text, cell / 2, ascent + cell / 2);

      // one pixel a cell, scaled up crisp: which cells are on this frame
      const cols = Math.ceil(w / cell);
      const rows = Math.ceil(h / cell);
      const mask = document.createElement("canvas");
      mask.width = cols;
      mask.height = rows;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      const cells = mctx.createImageData(cols, rows);

      const still = !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const paint = (t: number) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        if (t >= 1) {
          ctx.drawImage(ink, 0, 0);
          return;
        }
        // the edge climbs from below the floor to above the top
        const front = t * (1 + BAND);
        for (let y = 0; y < rows; y++) {
          const height = (rows - y - 0.5) / rows; // 0 at the floor, 1 at the top
          const density = Math.min(1, Math.max(0, (front - height) / BAND));
          for (let x = 0; x < cols; x++) cells.data[(y * cols + x) * 4 + 3] = density > BAYER[y & 3][x & 3] ? 255 : 0;
        }
        mctx.putImageData(cells, 0, 0);
        ctx.drawImage(ink, 0, 0);
        ctx.globalCompositeOperation = "destination-in";
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(mask, 0, 0, cols * cell * dpr, rows * cell * dpr);
        ctx.globalCompositeOperation = "source-over";
      };

      if (still) return paint(1);
      const start = performance.now();
      let shown = -Infinity;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        if (now - shown >= FRAME || t === 1) {
          shown = now;
          paint(t);
        }
        if (t < 1 && !cancelled) raf = requestAnimationFrame(tick);
      };
      paint(0);
      raf = requestAnimationFrame(tick);
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
  }, [text]);

  return (
    <span ref={box} className="dither-figure" role="img" aria-label={text}>
      <canvas ref={canvas} />
    </span>
  );
}
