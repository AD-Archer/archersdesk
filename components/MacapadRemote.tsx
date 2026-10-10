"use client";

// The macapad pad on the phone remote: the same keys as the desk's pads, in a
// grid sized for a thumb. Presses go through the desk server like the widget
// (only a key id leaves the phone); "edit keys" opens settings → macapad.

import { useRef, useState } from "react";
import { MACAPAD_SLOTS, type MacapadButton, type MacapadSize, type Settings } from "@/lib/types";
import { KeyFace } from "./MacapadSettings";
import { openMacapadSettings } from "./widgets/Macapad";
import { MI, useIntegrationAction } from "./widgets/kit";

const PAD_NAMES: Record<MacapadSize, string> = { big: "Big pad", small: "Small pad" };

export function RemotePad({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const act = useIntegrationAction("macapad");
  const has = (s: MacapadSize) => settings.macapad[s].some((p) => p.buttons.some(Boolean));
  const [size, setSize] = useState<MacapadSize>(has("big") || !has("small") ? "big" : "small");
  const [pageIndex, setPageIndex] = useState(0);
  const [flash, setFlash] = useState<Record<string, "busy" | "ok" | "err">>({});
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pages = settings.macapad[size];
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const slots = Array.from({ length: MACAPAD_SLOTS[size] }, (_, i) => page?.buttons[i] ?? null);

  function say(text: string) {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4000);
  }

  async function press(b: MacapadButton) {
    navigator.vibrate?.(10);
    setFlash((f) => ({ ...f, [b.id]: "busy" }));
    let ok = false;
    try {
      const res = await act("press", { id: b.id });
      ok = Boolean((res.data as { ok?: boolean } | undefined)?.ok);
      if (!ok) say(res.reason ?? "That didn't work.");
    } catch {
      say("Couldn't reach the desk.");
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

  function edit(index?: number) {
    onClose();
    openMacapadSettings({ size, page: page?.id, index });
  }

  return (
    <div className="remote-sheet" role="dialog" aria-modal="true">
      <div className="remote-sheet-head">
        <b>pad</b>
        <button onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="remote-sheet-body rpad">
        <div className="rpad-bar">
          <div className="rpad-switch" role="tablist">
            {(["big", "small"] as MacapadSize[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={s === size}
                className={s === size ? "on" : ""}
                onClick={() => {
                  setSize(s);
                  setPageIndex(0);
                }}
              >
                {PAD_NAMES[s]}
              </button>
            ))}
          </div>
          <button className="rpad-edit" onClick={() => edit()}>
            <MI name="edit" /> Edit keys
          </button>
        </div>

        {pages.length > 1 && (
          <div className="rpad-pages">
            {pages.map((p, i) => (
              <button key={p.id} className={p.id === page?.id ? "on" : ""} onClick={() => setPageIndex(i)}>
                {p.name || `page ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        <div className={`rpad-grid ${size}`}>
          {slots.map((b, i) =>
            b ? (
              <button
                key={b.id}
                className={`rpad-key${flash[b.id] ? ` ${flash[b.id]}` : ""}`}
                onClick={() => press(b)}
                aria-label={b.label || "key"}
              >
                <KeyFace button={b} />
                {b.label && <span>{b.label}</span>}
              </button>
            ) : (
              <button key={`empty-${i}`} className="rpad-key empty" onClick={() => edit(i)} aria-label="Add a key here">
                <MI name="add" />
              </button>
            )
          )}
        </div>

        {message && (
          <p className="rpad-msg" role="status">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
