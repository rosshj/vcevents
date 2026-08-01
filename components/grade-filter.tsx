"use client";

import { GRADES } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Grade filter on the same stone-100 track as the form Segmented control.
 * Unlike Segmented it has an "All" state and scrolls horizontally inside
 * the track when the options don't fit the screen.
 */
export function GradeFilter({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (grade: number | null) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter by grade"
      className="flex gap-1 overflow-x-auto rounded-2xl bg-stone-100 p-1"
    >
      {[null, ...GRADES].map((g) => (
        <button
          key={g ?? "all"}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors",
            value === g
              ? "bg-white text-stone-900 shadow-press"
              : "text-stone-500 hover:bg-stone-200/60"
          )}
        >
          {g === null ? "All" : `Gr. ${g}`}
        </button>
      ))}
    </div>
  );
}
