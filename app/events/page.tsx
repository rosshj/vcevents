"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronRight, ScanLine } from "lucide-react";
import { useMemo } from "react";
import { useSession } from "@/components/session-provider";
import { usePageChrome } from "@/components/page-header";
import { Guard, Screen } from "@/components/guard";
import { canManageEvents, canViewEvents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { eventTiming, formatEventDate, type EventTiming } from "@/lib/format";
import type { SchoolEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EventRow {
  event: SchoolEvent;
  checkins: number;
  awarded: number;
  timing: EventTiming;
}

const GROUPS: { timing: EventTiming; label: string }[] = [
  { timing: "today", label: "Today" },
  { timing: "future", label: "Upcoming" },
  { timing: "past", label: "Past" },
];

async function fetchRows(): Promise<EventRow[]> {
  const events = await repo.listEvents();
  return Promise.all(
    events.map(async (event) => {
      const awards = await repo.listAwards(event.id);
      return {
        event,
        checkins: await repo.countCheckins(event.id),
        awarded: awards.reduce((sum, a) => sum + a.points, 0),
        timing: eventTiming(event.date),
      };
    })
  );
}

function EventsScreen() {
  const { session } = useSession();
  const [rows, setRows] = useState<EventRow[] | null>(null);
  usePageChrome({
    title: "Events",
    subtitle: "Tap an event to run check-in.",
    actions: useMemo(
      () =>
        canManageEvents(session.role) ? (
          <Link href="/events/new" className={buttonVariants({ size: "sm" })}>
            <CalendarPlus className="h-4 w-4" />
            New
          </Link>
        ) : undefined,
      [session.role]
    ),
  });

  useEffect(() => {
    let cancelled = false;
    void fetchRows().then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen className="space-y-5">
      {!rows ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : (
        GROUPS.map(({ timing, label }) => {
          const group = rows.filter((r) => r.timing === timing);
          if (group.length === 0) return null;
          // Past newest-first; today/upcoming soonest-first.
          const sorted = [...group].sort((a, b) =>
            timing === "past"
              ? b.event.date.localeCompare(a.event.date)
              : a.event.date.localeCompare(b.event.date)
          );
          return (
            <div key={timing}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                {label}
              </h2>
              <div className="space-y-2">
                {sorted.map(({ event, checkins, awarded }) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-soft transition-colors hover:bg-stone-50",
                      timing === "past" && "opacity-80"
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
                        {awarded > 0 && <> · {awarded} pts awarded</>}
                      </p>
                    </div>
                    {event.tier === "major" && (
                      <Badge variant="secondary">Major</Badge>
                    )}
                    {session.activeEventId === event.id && (
                      <Badge variant="green">Operating</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })
      )}
    </Screen>
  );
}

export default function EventsPage() {
  return (
    <Guard allow={canViewEvents}>
      <EventsScreen />
    </Guard>
  );
}
