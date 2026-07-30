"use client";

import { useEffect } from "react";

/** Must match the default themeColor in app/layout.tsx's viewport export. */
const DEFAULT_THEME_COLOR = "#f8f5ef";

/**
 * Tints the browser chrome (iOS Safari toolbar) to match the screen —
 * house color on the pass, near-black on the scanner, cream elsewhere.
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
    return () => {
      el.content = DEFAULT_THEME_COLOR;
    };
  }, [color]);
}
