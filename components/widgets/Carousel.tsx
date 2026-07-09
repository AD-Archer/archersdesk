"use client";

// Swipe between items INSIDE a widget (e.g. torrents, pending requests)
// without hijacking the outer page-swipe in Dashboard.tsx. Horizontal drags
// stop propagation once the gesture locks onto that axis, so the outer
// `.stage` pointer handlers never see them; vertical drags are left alone
// so dual-row switching over a carousel still works.
//
// `perView` shows several items per page (stacked); arrows/dots/swipe page
// through the groups. Tap-vs-swipe is decided here (a gesture that never
// locks the horizontal axis is a tap) rather than relying on the browser's
// synthetic click, which fires even after a drag and fights pointer capture.

import { useRef, useState } from "react";

interface DragState {
  x: number;
  y: number;
  id: number;
  axis: "h" | "v" | null;
  idx: number | null; // global item index the gesture started on (for taps)
}

export function SwipeCarousel<T>({
  items,
  getKey,
  renderItem,
  perView = 1,
  layout = "column",
  onItemTap,
}: {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  perView?: number;
  layout?: "column" | "row";
  onItemTap?: (item: T, index: number) => void;
}) {
  const [page, setPage] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null);
  const start = useRef<DragState | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perView) pages.push(items.slice(i, i + perView));
  const pageCount = Math.max(1, pages.length);
  const clamped = Math.min(page, pageCount - 1);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, input, textarea, a, label")) return;
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-idx]");
    const idx = cell ? Number(cell.dataset.idx) : null;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, idx };
    // capture so move/up keep routing here even if the finger drifts off the
    // track mid-swipe (e.g. onto the dots/arrows) — without this, a drifted
    // pointerup never fires and the drag position gets stuck.
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      s.axis = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (s.axis === "h") {
      e.stopPropagation();
      setDragX(dx);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const dx = e.clientX - s.x;
    const axis = s.axis;
    start.current = null;
    setDragX(null);
    if (axis === "h") {
      e.stopPropagation();
      const width = viewportRef.current?.clientWidth || 1;
      const threshold = Math.min(80, width * 0.18);
      if (dx < -threshold) setPage((p) => Math.min(pageCount - 1, p + 1));
      else if (dx > threshold) setPage((p) => Math.max(0, p - 1));
    } else if (axis === null && s.idx !== null && onItemTap) {
      // never locked an axis → it was a tap, not a swipe
      onItemTap(items[s.idx], s.idx);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="swipe-carousel">
      <div className="swipe-row">
        <button
          type="button"
          className="swipe-arrow"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={clamped === 0}
          aria-label="previous"
        >
          ‹
        </button>
        <div
          ref={viewportRef}
          className="swipe-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className={`swipe-track${dragX === null ? " animate" : ""}`}
            style={{ transform: `translateX(calc(${-clamped * 100}% + ${dragX ?? 0}px))` }}
          >
            {pages.map((group, p) => (
              <div className="swipe-item" key={p}>
                <div className={`swipe-page${layout === "row" ? " row" : ""}`}>
                  {group.map((item, j) => {
                    const gi = p * perView + j;
                    return (
                      <div className="swipe-cell" data-idx={gi} key={getKey(item, gi)}>
                        {renderItem(item, gi)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="swipe-arrow"
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          disabled={clamped === pageCount - 1}
          aria-label="next"
        >
          ›
        </button>
      </div>
      {pageCount > 1 && (
        <div className="swipe-dots">
          {pages.map((_, p) => (
            <button
              key={p}
              className={`swipe-dot${p === clamped ? " on" : ""}`}
              onClick={() => setPage(p)}
              aria-label={`page ${p + 1} of ${pageCount}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
