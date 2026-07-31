"use client";

import { createContext, useContext, useEffect } from "react";

export interface PageHeader {
  title: string;
  backHref: string;
}

export const PageHeaderContext = createContext<{
  set: (h: PageHeader | null) => void;
} | null>(null);

/**
 * Sub-pages call this to swap the app top bar into back-button + title
 * mode. Cleans up on unmount so root tabs get the wordmark back.
 */
export function usePageHeader(title: string, backHref: string) {
  const ctx = useContext(PageHeaderContext);
  const set = ctx?.set;
  useEffect(() => {
    if (!set) return;
    set({ title, backHref });
    return () => set(null);
  }, [set, title, backHref]);
}
