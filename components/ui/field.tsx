"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "@/lib/utils";

/** Labeled form field with an optional hint line — the app's form pattern. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-semibold text-stone-700"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  sub?: string;
}

/**
 * iOS-style segmented control on the stone-100 track.
 *
 * A Base UI radio group underneath: one tab stop for the whole control,
 * arrow keys move and select, and each segment is a real button with
 * role="radio" so the checked state is announced.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  columns = options.length,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  columns?: number;
  ariaLabel?: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={ariaLabel}
      className="grid gap-1 rounded-2xl bg-stone-100 p-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          nativeButton
          render={(props, state) => (
            <button
              {...props}
              type="button"
              className={cn(
                "rounded-xl px-2 py-2.5 text-center transition-colors",
                state.checked ? "bg-white shadow-press" : "hover:bg-stone-200/60"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center gap-1.5 text-sm font-semibold",
                  state.checked ? "text-stone-900" : "text-stone-500"
                )}
              >
                {o.label}
              </span>
              {o.sub && (
                <span className="block text-[11px] text-stone-400">{o.sub}</span>
              )}
            </button>
          )}
        />
      ))}
    </RadioGroup>
  );
}
