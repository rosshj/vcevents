"use client";

import { createContext, useContext } from "react";
import type { AppFlags } from "@/lib/flags";

const FlagsContext = createContext<AppFlags>({ devTools: false });

/** Server-evaluated flags, handed to client components. */
export function FlagsProvider({
  flags,
  children,
}: {
  flags: AppFlags;
  children: React.ReactNode;
}) {
  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

export function useFlags(): AppFlags {
  return useContext(FlagsContext);
}
