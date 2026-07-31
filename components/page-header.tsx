"use client";

import { createContext, useContext, useEffect } from "react";

export interface PageHeader {
  title: string;
  /** Set → sub-page variant: back chevron + compact title. */
  backHref?: string;
  /** Root variant only: line under the title. */
  subtitle?: string;
  /** Root variant only: buttons on the right (memoize at the call site). */
  actions?: React.ReactNode;
  /** Focused flows (forms) drop the tab bar entirely. */
  hideNav?: boolean;
}

export const PageHeaderContext = createContext<{
  set: (h: PageHeader | null) => void;
} | null>(null);

/**
 * Registers the sticky app header for this screen. Root tabs pass title/
 * subtitle/actions; omit entirely (don't call) for chromeless screens
 * like the pass. Cleans up on unmount.
 */
export function usePageChrome(header: PageHeader) {
  const ctx = useContext(PageHeaderContext);
  const set = ctx?.set;
  const { title, backHref, subtitle, actions, hideNav } = header;
  useEffect(() => {
    if (!set) return;
    set({ title, backHref, subtitle, actions, hideNav });
    return () => set(null);
  }, [set, title, backHref, subtitle, actions, hideNav]);
}

/** Sub-page variant: back button + title in the sticky bar. */
export function usePageHeader(
  title: string,
  backHref: string,
  opts?: { hideNav?: boolean }
) {
  usePageChrome({ title, backHref, hideNav: opts?.hideNav ?? false });
}
