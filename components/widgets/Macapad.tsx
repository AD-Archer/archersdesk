"use client";

// Macapad — a stream-deck pad for the mac. A square panel shows the small
// pad (2×2), a dual row the big one (4×2), and the desk's own pad page (the
// last page, always there) this screen's pad, in the grid chosen for it
// (settings → macapad). Each pad has its own pages, swiped sideways inside the pad, scrolled with a wheel or
// trackpad, or picked from the page dots / arrows. Keys look like
// home-screen tiles: rounded squares with a white glyph, or the app icon /
// site logo filling the tile, the label underneath. Tapping a key asks
// the desk server to press it; the server looks up the saved steps and runs
// them on the mac through macapad — the browser only ever sends a button id.
// Editing lives in settings → macapad; "Edit" (or an empty slot) opens it
// pointed at this pad and page.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { padOf, screenPad } from "@/lib/macapad";
import { WIDGET_INFO, type MacapadButton, type MacapadPadId, type ViewSettings } from "@/lib/types";
import { useWheelStep } from "../hooks";
import { KeyTile, type MacapadFocus } from "../MacapadSettings";
import { Empty, MI, plainWords, Shell, useIntegration, useIntegrationAction } from "./kit";
import type { WidgetProps } from "./registry";

/** Ask the dashboard to open settings on the macapad tab (see Dashboard.tsx). */
export function openMacapadSettings(focus: MacapadFocus) {
  window.dispatchEvent(
    new CustomEvent("archersdesk:open-settings", {
      detail: { tab: "macapad", macapad: focus },
    })
  );
}

export function MacapadWidget({ wide, settings, integrationSettings }: WidgetProps) {
  return <MacapadPad pad={wide ? "big" : "small"} settings={settings} integrationSettings={integrationSettings} />;
}

/** The desk's pad page: this screen's own pad on a panel that fills the page. */
export function MacapadPage({ settings, integrationSettings }: { settings: ViewSettings; integrationSettings?: ViewSettings }) {
  return (
    <section className="panel deck" data-widget="macapad">
      <MacapadPad pad={screenPad(settings.deviceId)} settings={settings} integrationSettings={integrationSettings} />
    </section>
  );
}

function MacapadPad({
  pad,
  settings,
  integrationSettings,
}: {
  pad: MacapadPadId;
  settings: ViewSettings;
  integrationSettings?: ViewSettings;
}) {
  const status = useIntegration<{ online: boolean }>("macapad", integrationSettings ?? settings, 30 * 1000);
  const act = useIntegrationAction("macapad");

  const found = padOf(settings.macapad, pad);
  const pages = found?.pages ?? [];
  const cols = found?.cols ?? 2;
  const rows = found?.rows ?? 2;
  const slots = cols * rows;
  const [pageIndex, setPageIndex] = useState(0);
  const current = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const page = pages[current];
  const last = pages.length - 1;

  // per-button press feedback: busy while the mac runs it, then ok/err briefly
  const [flash, setFlash] = useState<Record<string, "busy" | "ok" | "err">>({});
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    []
  );

  // sideways swipe between pad pages. like SwipeCarousel: once a drag locks
  // horizontal it stops propagating so the desk doesn't change page, and the
  // click that follows a swipe is swallowed so it doesn't press a button.
  // Past the first or last page the drag is left to the desk ("pass"), so
  // the desk's pages are one continuous swipe away. A mouse drag captures
  // the pointer, so letting go outside the pad still ends it.
  const drag = useRef<{
    x: number;
    y: number;
    id: number;
    axis: "h" | "v" | "pass" | null;
  } | null>(null);
  const swiped = useRef(false);
  const [dragX, setDragX] = useState<number | null>(null);

  // wheel / trackpad: a page per gesture, either direction (handed to the
  // desk at the ends, like a drag)
  const onWheel = useWheelStep({
    axis: "both",
    canStep: (dir) => (dir > 0 ? current < last : current > 0),
    onStep: (dir) => setPageIndex(Math.min(last, Math.max(0, current + dir))),
  });

  // tiles are sized to the panel: measure the pad's box and fit the grid
  // (tile + its label under it) the way a home screen does, then stretch it
  // to fill
  const viewport = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState<React.CSSProperties | undefined>(undefined);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      // the dots / offline note under the pad take their share first
      const note = el.querySelector<HTMLElement>(".mpad-dots, .mpad-msg");
      const below = note ? note.offsetHeight + 8 : 0;
      const h = el.clientHeight - below;
      if (!w || !h) return;
      const fitT = (lab: number) =>
        Math.min(w / (cols + (cols - 1) * 0.2), (h - rows * lab) / (rows + (rows - 1) * 0.12));
      let lab = 30;
      let t = fitT(lab);
      if (t < 120) t = fitT((lab = 22));
      if (t < 64) t = fitT((lab = 18)); // dense grids: smaller labels
      t = Math.max(40, Math.floor(t));
      // then fill the pad both ways: keys stretch up to 1.4× in whichever
      // direction has room left, and anything past that goes into the gaps
      // (the grid is spread edge to edge in css), so there's never a band of
      // empty pad around the keys
      const tw = Math.max(t, Math.floor(Math.min(t * 1.4, (w - (cols - 1) * t * 0.2) / cols)));
      const th = Math.max(t, Math.floor(Math.min(t * 1.4, (h - rows * lab - (rows - 1) * t * 0.12) / rows)));
      setTile({
        "--t": `${t}px`,
        "--tw": `${tw}px`,
        "--th": `${th}px`,
        "--lab": `${lab}px`,
        "--cols": cols,
      } as React.CSSProperties);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows, status?.configured, status?.data?.online, pages.length]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null };
    swiped.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    // a mouse that let go somewhere we didn't hear about: that drag is over
    if (e.pointerType === "mouse" && e.buttons === 0) {
      drag.current = null;
      setDragX(null);
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      if (Math.abs(dx) < Math.abs(dy)) d.axis = "v";
      else if (pages.length < 2 || (dx > 0 ? current === 0 : current === last)) d.axis = "pass";
      else {
        d.axis = "h";
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // pointer already gone
        }
      }
    }
    if (d.axis === "h") {
      e.stopPropagation();
      setDragX(dx);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragX(null);
    // any drag, ours or the desk's, isn't a press
    if (d.axis) swiped.current = true;
    if (d.axis !== "h") return;
    e.stopPropagation();
    const dx = e.clientX - d.x;
    const threshold = Math.min(60, e.currentTarget.clientWidth * 0.15);
    if (dx < -threshold) setPageIndex(Math.min(last, current + 1));
    else if (dx > threshold) setPageIndex(Math.max(0, current - 1));
  }

  function say(text: string) {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 4000);
  }

  async function press(b: MacapadButton) {
    navigator.vibrate?.(10);
    setFlash((f) => ({ ...f, [b.id]: "busy" }));
    let ok = false;
    try {
      const res = await act("press", { id: b.id });
      ok = Boolean((res.data as { ok?: boolean } | undefined)?.ok);
      if (!ok) say(res.reason ?? "that didn't work");
    } catch {
      say("couldn't reach the desk");
    }
    setFlash((f) => ({ ...f, [b.id]: ok ? "ok" : "err" }));
    setTimeout(
      () =>
        setFlash((f) => {
          const next = { ...f };
          delete next[b.id];
          return next;
        }),
      ok ? 350 : 900
    );
  }

  function tap(b: MacapadButton | null, index: number) {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (b) press(b);
    else openMacapadSettings({ pad, page: page?.id, index });
  }

  if (!status) {
    return (
      <Shell icon={WIDGET_INFO.macapad.icon} label="macapad">
        <Empty>finding your mac…</Empty>
      </Shell>
    );
  }
  if (!status.configured) {
    return (
      <Shell icon={WIDGET_INFO.macapad.icon} label="macapad">
        <Empty>{status.reason}</Empty>
      </Shell>
    );
  }

  // configured but unreachable / bad token: keep the pad usable, say why
  const offline = !status.data?.online;
  // the heading names the page; a press that didn't work borrows it briefly
  const label = message ? (
    <span className="mpad-say" role="status">
      {message}
    </span>
  ) : (
    [page && pages.length > 1 ? page.name : "macapad", offline ? "offline" : null].filter(Boolean).join(" · ")
  );

  return (
    <Shell icon={WIDGET_INFO.macapad.icon} label={label}>
      <button
        className="mpad-edit"
        onClick={() => openMacapadSettings({ pad, page: page?.id })}
        aria-label="edit keys"
      >
        Edit
      </button>
      <div ref={viewport} className="mpad-fit" style={tile}>
        <div
          className={`mpad-viewport${offline ? " offline" : ""}${rows === 1 ? " one-row" : ""}`}
          data-swipe-through
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <div
            className={`mpad-track${dragX === null ? " animate" : ""}`}
            style={{
              transform: `translateX(calc(${-current * 100}% + ${dragX ?? 0}px))`,
            }}
          >
            {pages.map((pg) => (
              <div key={pg.id} className="mpad">
                {Array.from({ length: slots }, (_, i) => pg.buttons[i] ?? null).map((b, i) =>
                  b ? (
                    <button
                      key={b.id}
                      className={`mpad-key${flash[b.id] ? ` ${flash[b.id]}` : ""}`}
                      onClick={() => tap(b, i)}
                      aria-label={b.label || "button"}
                    >
                      <KeyTile button={b} />
                      <span className="mpad-label">{b.label}</span>
                    </button>
                  ) : (
                    <button
                      key={`empty-${i}`}
                      className="mpad-key empty"
                      onClick={() => tap(null, i)}
                      aria-label="add a key"
                    >
                      <span className="mtile socket">
                        <MI name="add" />
                      </span>
                      <span className="mpad-label" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        {offline && status.reason ? (
          <div className="mpad-msg" role="status">
            {plainWords(status.reason)}
          </div>
        ) : (
          pages.length > 1 && (
            <div className="mpad-dots">
              {/* arrows for a mouse; touch screens swipe (hidden there in css) */}
              <button
                className="mpad-arrow"
                onClick={() => setPageIndex(Math.max(0, current - 1))}
                disabled={current === 0}
                aria-label="previous page"
              >
                <MI name="chevron_left" />
              </button>
              {pages.map((pg, i) => (
                <button
                  key={pg.id}
                  className={`mpad-dot${i === current ? " on" : ""}`}
                  onClick={() => setPageIndex(i)}
                  aria-label={`${pg.name} (page ${i + 1} of ${pages.length})`}
                />
              ))}
              <button
                className="mpad-arrow"
                onClick={() => setPageIndex(Math.min(last, current + 1))}
                disabled={current === last}
                aria-label="next page"
              >
                <MI name="chevron_right" />
              </button>
            </div>
          )
        )}
      </div>
    </Shell>
  );
}
