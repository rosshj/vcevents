"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Destructive actions ask twice.
 *
 * Tap once and the button arms itself (red, with a new label) for a few
 * seconds; tap again to commit. Cheaper than a modal for an action that
 * is rare but unrecoverable, and it can't be triggered by one stray tap.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  icon,
  onConfirm,
  className,
  armedMs = 4000,
}: {
  label: string;
  confirmLabel: string;
  icon?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  className?: string;
  armedMs?: number;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const press = async () => {
    if (busy) return;
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), armedMs);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={press}
      disabled={busy}
      aria-live="polite"
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold transition-colors disabled:opacity-60",
        armed
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-red-50 text-red-700 hover:bg-red-100",
        className
      )}
    >
      {icon}
      {armed ? confirmLabel : label}
    </button>
  );
}
