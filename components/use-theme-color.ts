"use client";

import { useEffect } from "react";

/** Must match the default themeColor in app/layout.tsx's viewport export. */
const DEFAULT_THEME_COLOR = "#ffffff";

/**
 * Tints the browser chrome to match the screen — house color on the pass,
 * near-black on the scanner, white elsewhere. Sets both the theme-color
 * meta and the <html> background: newer iOS Safari derives its glass
 * toolbar from the page's top edge, and overscroll exposes the root
 * background, so the meta alone isn't enough.
 */
export function useThemeColor(color: string) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
    const el = meta;
    const root = document.documentElement;
    const prevBg = root.style.backgroundColor;
    root.style.backgroundColor = color;
    return () => {
      el.content = DEFAULT_THEME_COLOR;
      root.style.backgroundColor = prevBg;
    };
  }, [color]);
}
