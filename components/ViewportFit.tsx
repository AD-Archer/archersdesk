"use client";

import { useEffect } from "react";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosLike(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function ViewportFit() {
  useEffect(() => {
    const root = document.documentElement;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    const update = () => {
      const viewport = window.visualViewport;
      const height = Math.round(viewport?.height ?? window.innerHeight);
      root.style.setProperty("--app-height", `${height}px`);
      root.dataset.ios = isIosLike() ? "true" : "false";
      root.dataset.standalone = isStandalone() ? "true" : "false";
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (bg && themeMeta) themeMeta.content = bg;
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return null;
}
