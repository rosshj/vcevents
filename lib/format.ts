/** Date helpers — event dates are local YYYY-MM-DD strings. */

export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayString(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatEventDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Whole days from today to the given date (positive = future). */
export function daysUntil(date: string): number {
  const ms =
    parseLocalDate(date).getTime() - parseLocalDate(todayString()).getTime();
  return Math.round(ms / 86_400_000);
}

export function monthShort(date: string): string {
  return parseLocalDate(date)
    .toLocaleDateString("en-CA", { month: "short" })
    .toUpperCase();
}

export function weekdayShort(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-CA", { weekday: "short" });
}

export function dayOfMonth(date: string): number {
  return parseLocalDate(date).getDate();
}

/** "6:40" — clock time without the day period, for chart axes. */
export function formatClockShort(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?[ap]\.?m\.?$/i, "");
}

/** "just now" / "3m ago" / "2h ago", falling back to date + time. */
export function relativeTime(
  at: string | number,
  now: number = Date.now()
): string {
  const t = typeof at === "number" ? at : new Date(at).getTime();
  // Clamp clock skew: a timestamp slightly in the future is "just now".
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  // Older than a day: a bare clock time would mislead — show the date.
  return formatDateTime(new Date(t).toISOString());
}

export type EventTiming = "past" | "today" | "future";

export function eventTiming(date: string): EventTiming {
  const today = todayString();
  if (date === today) return "today";
  return date < today ? "past" : "future";
}
