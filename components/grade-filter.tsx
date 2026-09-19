"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { GRADES } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number | null> {
  value: T;
  label: string;
}

/**
 * Radio values have to be strings for the group to track them, and `null`
 * (the "All" option) reads as "nothing selected" — so every option gets a
 * stable string key and the real value is looked back up on change.
 */
function keyOf(value: string | number | null): string {
  return value === null ? "\u0000all" : `${typeof value}:${value}`;
}

/**
 * Sliding segmented control on the same stone-100 track as the form
 * Segmented control. The active chip slides between options with the
 * same spring as the tab bar's pill. The `dark` variant sits on the
 * check-in sheet's near-black surface. Scrolls horizontally inside the
 * track when the options don't fit the screen.
 *
 * A Base UI radio group underneath: one tab stop, arrow keys move and
 * select, and the checked state is announced.
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
    <RadioGroup
      value={keyOf(value)}
      onValueChange={(key) => {
        const picked = options.find((opt) => keyOf(opt.value) === key);
        if (picked) onChange(picked.value);
      }}
      aria-label={label}
      className={cn(
        "flex gap-1 overflow-x-auto rounded-2xl p-1",
        dark ? "bg-white/10" : "bg-stone-100",
        className
      )}
    >
      {options.map((opt) => (
        <Radio.Root
          key={keyOf(opt.value)}
          value={keyOf(opt.value)}
          nativeButton
          render={(props, state) => (
            <button
              {...props}
              type="button"
              className={cn(
                "relative flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors",
                state.checked
                  ? "text-stone-900"
                  : dark
                    ? "text-white/60 hover:bg-white/10"
                    : "text-stone-500 hover:bg-stone-200/60"
              )}
            >
              {state.checked && (
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
          )}
        />
      ))}
    </RadioGroup>
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
