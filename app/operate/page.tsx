"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, ScanLine } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { canOperate } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { eventTiming, formatEventDate, type EventTiming } from "@/lib/format";
import type { SchoolEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EventRow {
  event: SchoolEvent;
  checkins: number;
  timing: EventTiming;
}

const GROUPS: { timing: EventTiming; label: string }[] = [
  { timing: "today", label: "Today" },
  { timing: "future", label: "Upcoming" },
  { timing: "past", label: "Past" },
];

function EventPicker() {
  const { session, setActiveEventId } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<EventRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const events = await repo.listEvents();
      const withCounts = await Promise.all(
        events.map(async (event) => ({
          event,
          checkins: await repo.countCheckins(event.id),
          timing: eventTiming(event.date),
        }))
      );
      if (!cancelled) setRows(withCounts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = (event: SchoolEvent) => {
    setActiveEventId(event.id);
    router.push("/operate/scan");
  };

  return (
    <Screen className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Run check-in</h1>
        <p className="text-sm text-stone-500">
          Pick the event you&apos;re operating.
        </p>
      </div>

      {!rows ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : (
        GROUPS.map(({ timing, label }) => {
          const group = rows.filter((r) => r.timing === timing);
          if (group.length === 0) return null;
          return (
            <div key={timing}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                {label}
              </h2>
              <div className="space-y-2">
                {group.map(({ event, checkins }) => {
                  const active = session.activeEventId === event.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => pick(event)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-3xl border bg-white p-4 text-left shadow-soft transition-colors hover:bg-stone-50",
                        active ? "border-stone-900" : "border-black/5",
                        timing === "past" && "opacity-70"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          timing === "today"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-500"
                        )}
                      >
                        {timing === "today" ? (
                          <ScanLine className="h-5 w-5" />
                        ) : (
                          <CalendarDays className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-stone-900">
                          {event.name}
                        </p>
                        <p className="text-xs text-stone-500">
                          {formatEventDate(event.date)}
                          {checkins > 0 && <> · {checkins} checked in</>}
                        </p>
                      </div>
                      {event.tier === "major" && (
                        <Badge variant="secondary">Major</Badge>
                      )}
                      {active && <Badge variant="green">Operating</Badge>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </Screen>
  );
}

export default function OperatePage() {
  return (
    <Guard allow={canOperate}>
      <EventPicker />
    </Guard>
  );
}
