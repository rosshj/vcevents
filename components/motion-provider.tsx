"use client";

import { MotionConfig } from "framer-motion";

/** App-wide motion defaults; honors the OS reduced-motion setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
