"use client";

import { createContext, useContext, useEffect } from "react";

export interface PageHeader {
  title: string;
  backHref: string;
  /** Focused flows (forms) drop the tab bar entirely. */
  hideNav?: boolean;
}

export const PageHeaderContext = createContext<{
  set: (h: PageHeader | null) => void;
} | null>(null);

/**
 * Sub-pages call this to swap the app top bar into back-button + title
 * mode. Cleans up on unmount so root tabs get the wordmark back.
 */
export function usePageHeader(
  title: string,
  backHref: string,
  opts?: { hideNav?: boolean }
) {
  const ctx = useContext(PageHeaderContext);
  const set = ctx?.set;
  const hideNav = opts?.hideNav ?? false;
  useEffect(() => {
    if (!set) return;
    set({ title, backHref, hideNav });
    return () => set(null);
  }, [set, title, backHref, hideNav]);
}
