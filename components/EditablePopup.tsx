"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// An iOS-style sheet over the board (rendered via portal): a #1c1c1e sheet
// with a nav bar. Popups that apply changes as you tap get "Done"; popups with
// their own footer buttons (Save, Clear…) get "Cancel" instead. Phone: a
// bottom sheet. Short landscape (Echo Show 5): a centered form sheet.

export default function EditablePopup({
  open,
  title,
  children,
  footer,
  onClose,
  className,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string; // extra class on the dialog, for popups with their own layout
}) {
  const [mounted, setMounted] = useState(false);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // a popup opened from a popup: Escape closes only the top one
      const layers = document.querySelectorAll(".edit-pop-layer");
      if (layers[layers.length - 1] === layer.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="edit-pop-layer" role="presentation" ref={layer}>
      <button className="edit-pop-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <section className={`edit-pop${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="edit-pop-head">
          <span className="edit-pop-side">
            {footer && (
              <button className="edit-pop-nav" onClick={onClose}>
                Cancel
              </button>
            )}
          </span>
          <b>{title}</b>
          <span className="edit-pop-side end">
            {!footer && (
              <button className="edit-pop-nav done" onClick={onClose}>
                Done
              </button>
            )}
          </span>
        </div>
        <div className="edit-pop-body">{children}</div>
        {footer && <div className="edit-pop-foot">{footer}</div>}
      </section>
    </div>,
    document.body
  );
}
