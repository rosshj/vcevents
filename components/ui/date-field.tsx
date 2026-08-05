"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { parseLocalDate, todayString } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Date picker in the app's own language rather than the browser's native
 * control. Collapsed it reads as a value; tapping expands a month grid
 * inline (a nested modal inside a sheet is a bad time on iOS), with
 * shortcuts for the dates event planning actually uses.
 *
 * Values are local `YYYY-MM-DD` strings, matching the rest of the app.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toValue(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(value: string, days: number): string {
  const d = parseLocalDate(value);
  d.setDate(d.getDate() + days);
  return toValue(d);
}

/** Sunday of the coming week (or today, if today is Friday-ish). */
function nextFriday(): string {
  const d = parseLocalDate(todayString());
  const delta = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return toValue(d);
}

export function DateField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = parseLocalDate(value || todayString());
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = todayString();
  const selected = value;

  const weeks = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const out: string[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: string[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        row.push(toValue(day));
      }
      out.push(row);
    }
    return out;
  }, [cursor]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    "en-CA",
    { month: "long", year: "numeric" }
  );

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const pick = (v: string) => {
    onChange(v);
    const d = parseLocalDate(v);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setOpen(false);
  };

  const shortcuts = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Friday", value: nextFriday() },
  ];

  return (
    <div className="space-y-2">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-12 w-full items-center gap-3 rounded-2xl bg-stone-100 px-4 text-left transition-colors hover:bg-stone-200/70"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-stone-500" />
        <span className="flex-1 font-semibold text-stone-900">
          {value
            ? parseLocalDate(value).toLocaleDateString("en-CA", {
                weekday: "short",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Pick a date"}
        </span>
        {value === today && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            Today
          </span>
        )}
      </button>

      <div className="flex gap-1.5">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => pick(s.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              selected === s.value
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl bg-white p-3 shadow-soft">
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-stone-900">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((d, i) => (
                  <span
                    key={i}
                    className="pb-1 text-center text-[10px] font-bold uppercase text-stone-400"
                  >
                    {d}
                  </span>
                ))}
                {weeks.flat().map((day) => {
                  const inMonth =
                    parseLocalDate(day).getMonth() === cursor.month;
                  const isSelected = day === selected;
                  const isToday = day === today;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => pick(day)}
                      aria-current={isSelected ? "date" : undefined}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-xl text-sm tabular-nums transition-colors",
                        isSelected
                          ? "bg-stone-900 font-bold text-white"
                          : inMonth
                            ? "font-semibold text-stone-700 hover:bg-stone-100"
                            : "text-stone-300 hover:bg-stone-50",
                        !isSelected && isToday && "ring-1 ring-inset ring-stone-900"
                      )}
                    >
                      {parseLocalDate(day).getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
