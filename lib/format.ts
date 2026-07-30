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

export type EventTiming = "past" | "today" | "future";

export function eventTiming(date: string): EventTiming {
  const today = todayString();
  if (date === today) return "today";
  return date < today ? "past" : "future";
}
