"use client";

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

/** iOS-style segmented control on the stone-100 track. */
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
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-2xl bg-stone-100 p-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl px-2 py-2.5 text-center transition-colors",
            value === o.value ? "bg-white shadow-press" : "hover:bg-stone-200/60"
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center gap-1.5 text-sm font-semibold",
              value === o.value ? "text-stone-900" : "text-stone-500"
            )}
          >
            {o.label}
          </span>
          {o.sub && (
            <span className="block text-[11px] text-stone-400">{o.sub}</span>
          )}
        </button>
      ))}
    </div>
  );
}
