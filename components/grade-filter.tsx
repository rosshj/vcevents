"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { GRADES } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number | null> {
  value: T;
  label: string;
}

/**
 * Sliding segmented control on the same stone-100 track as the form
 * Segmented control. The active chip slides between options with the
 * same spring as the tab bar's pill. The `dark` variant sits on the
 * check-in sheet's near-black surface. Scrolls horizontally inside the
 * track when the options don't fit the screen.
 */
export function SlidingSegmented<T extends string | number | null>({
  options,
  value,
  onChange,
  label,
  variant = "light",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  variant?: "light" | "dark";
  className?: string;
}) {
  const id = useId();
  const dark = variant === "dark";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex gap-1 overflow-x-auto rounded-2xl p-1",
        dark ? "bg-white/10" : "bg-stone-100",
        className
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value ?? "all")}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors",
              active
                ? "text-stone-900"
                : dark
                  ? "text-white/60 hover:bg-white/10"
                  : "text-stone-500 hover:bg-stone-200/60"
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-active`}
                className={cn(
                  "absolute inset-0 rounded-xl bg-white",
                  !dark && "shadow-press"
                )}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Grade filter: an "All" state plus one chip per grade. */
export function GradeFilter({
  value,
  onChange,
  variant,
  className,
}: {
  value: number | null;
  onChange: (grade: number | null) => void;
  variant?: "light" | "dark";
  className?: string;
}) {
  return (
    <SlidingSegmented<number | null>
      label="Filter by grade"
      options={[
        { value: null, label: "All" },
        ...GRADES.map((g) => ({ value: g, label: `G${g}` })),
      ]}
      value={value}
      onChange={onChange}
      variant={variant}
      className={className}
    />
  );
}
