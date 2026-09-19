"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

/** The chip that stands for "no house filter". */
const ALL = "\u0000all";

/**
 * House filter chips. Unlike the grade filter this one wears the house
 * colors — house identity is the app's whole visual language, so the
 * selected chip fills with the house's own color.
 *
 * A single-select Base UI toggle group: pressing the active house again
 * releases it (back to all houses), and arrow keys move between chips.
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
    <ToggleGroup
      value={[value ?? ALL]}
      onValueChange={(pressed: string[]) => {
        const next = pressed[0];
        onChange(next && next !== ALL ? next : null);
      }}
      aria-label="Filter by house"
      className={cn("flex gap-1.5 overflow-x-auto", className)}
    >
      <Toggle
        value={ALL}
        render={(props, state) => (
          <button
            {...props}
            type="button"
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              state.pressed
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            )}
          >
            All houses
          </button>
        )}
      />
      {houses.map((h) => (
        <Toggle
          key={h.id}
          value={h.id}
          render={(props, state) => (
            <button
              {...props}
              type="button"
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                !state.pressed && "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
              style={
                state.pressed
                  ? { backgroundColor: h.color, color: "white" }
                  : undefined
              }
            >
              {!state.pressed && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: h.color }}
                />
              )}
              {h.name}
            </button>
          )}
        />
      ))}
    </ToggleGroup>
  );
}
