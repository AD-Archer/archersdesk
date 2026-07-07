"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function EditablePopup({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="edit-pop-layer" role="presentation">
      <button className="edit-pop-scrim" aria-label="close editor" onClick={onClose} />
      <section className="edit-pop" role="dialog" aria-modal="true" aria-label={title}>
        <div className="edit-pop-head">
          <b>{title}</b>
          <button className="edit-pop-close" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>
        <div className="edit-pop-body">{children}</div>
        {footer && <div className="edit-pop-foot">{footer}</div>}
      </section>
    </div>,
    document.body
  );
}
