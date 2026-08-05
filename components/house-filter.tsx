"use client";

import { useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

/**
 * House filter chips. Unlike the grade filter this one wears the house
 * colors — house identity is the app's whole visual language, so the
 * selected chip fills with the house's own color.
 */
export function HouseFilter({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (houseId: string | null) => void;
  className?: string;
}) {
  const { houses } = useSession();
  if (houses.length === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Filter by house"
      className={cn("flex gap-1.5 overflow-x-auto", className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
          value === null
            ? "bg-stone-900 text-white"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        )}
      >
        All houses
      </button>
      {houses.map((h) => {
        const active = value === h.id;
        return (
          <button
            key={h.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : h.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              !active && "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
            style={active ? { backgroundColor: h.color, color: "white" } : undefined}
          >
            {!active && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: h.color }}
              />
            )}
            {h.name}
          </button>
        );
      })}
    </div>
  );
}
