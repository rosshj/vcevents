"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectItem {
  value: string;
  label: string;
}

/**
 * Single-choice select, on Base UI Select: a styled trigger on the
 * stone-100 track (matching Input) and a floating list in the app's own
 * language instead of the browser's native popup. Typeahead and arrow
 * keys work as in a native select; the list opens below the trigger
 * rather than overlapping it.
 */
export function Select({
  value,
  onValueChange,
  items,
  placeholder = "Choose…",
  "aria-label": ariaLabel,
  className,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  items: SelectItem[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <BaseSelect.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-2xl bg-stone-100 px-4 text-left text-base text-stone-900 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/10 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-placeholder:text-stone-400",
          className
        )}
      >
        <BaseSelect.Value placeholder={placeholder} className="truncate" />
        <BaseSelect.Icon className="shrink-0 text-stone-400">
          <ChevronDown className="h-4 w-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="z-[70] outline-none select-none"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup className="min-w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-2xl bg-white p-1.5 text-stone-900 shadow-float outline-none transition-[transform,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <BaseSelect.List className="max-h-[var(--available-height)] overflow-y-auto">
              {items.map((item) => (
                <BaseSelect.Item
                  key={item.value}
                  value={item.value}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-xl px-3 py-2.5 text-sm outline-none select-none data-highlighted:bg-stone-100"
                >
                  <BaseSelect.ItemIndicator className="col-start-1 flex items-center">
                    <Check className="h-4 w-4" />
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText className="col-start-2 font-medium">
                    {item.label}
                  </BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
