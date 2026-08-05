"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * iOS-style A–Z index for the student directory.
 *
 * It stays out of the way until you start scrolling, then fades back out
 * once you stop touching it. Dragging along it scrubs through sections
 * with a letter bubble for feedback; a tap jumps straight to one.
 */
export function AlphabetRail({
  letters,
  onJump,
  /** Milliseconds of no scrolling/touching before it fades away. */
  idleMs = 1600,
}: {
  letters: string[];
  onJump: (letter: string) => void;
  idleMs?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);

  const keepAwake = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // While a finger is on the rail it never hides.
    if (!draggingRef.current) {
      hideTimer.current = setTimeout(() => setVisible(false), idleMs);
    }
  }, [idleMs]);

  useEffect(() => {
    window.addEventListener("scroll", keepAwake, { passive: true });
    return () => {
      window.removeEventListener("scroll", keepAwake);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [keepAwake]);

  const letterAt = (clientY: number): string | null => {
    const rail = railRef.current;
    if (!rail || letters.length === 0) return null;
    const box = rail.getBoundingClientRect();
    const ratio = (clientY - box.top) / box.height;
    const idx = Math.min(
      letters.length - 1,
      Math.max(0, Math.floor(ratio * letters.length))
    );
    return letters[idx];
  };

  const scrub = (clientY: number) => {
    const letter = letterAt(clientY);
    if (!letter || letter === active) return;
    setActive(letter);
    onJump(letter);
  };

  if (letters.length < 3) return null;

  return (
    <>
      <AnimatePresence>
        {visible && active && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, scale: 0.8, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="pointer-events-none fixed right-12 top-1/2 z-40 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-stone-900 text-2xl font-black text-white shadow-float"
          >
            {active}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        ref={railRef}
        aria-hidden
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          keepAwake();
          scrub(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          e.preventDefault();
          scrub(e.clientY);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          setActive(null);
          keepAwake();
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setActive(null);
          keepAwake();
        }}
        style={{ pointerEvents: visible ? "auto" : "none" }}
        className="fixed right-1 top-1/2 z-40 flex -translate-y-1/2 touch-none select-none flex-col items-center gap-px py-2"
      >
        {letters.map((l) => (
          <span
            key={l}
            className={
              "flex h-[15px] w-6 items-center justify-center text-[10px] font-bold leading-none transition-colors " +
              (active === l ? "text-stone-900" : "text-stone-400")
            }
          >
            {l}
          </span>
        ))}
      </motion.div>
    </>
  );
}
