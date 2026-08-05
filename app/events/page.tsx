"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import {
  CalendarPlus,
  Check,
  ChevronRight,
  Trophy,
  TriangleAlert,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useEventSheet } from "@/components/event-sheet";
import { usePageChrome } from "@/components/page-header";
import { Guard, Screen } from "@/components/guard";
import { chartHouseOrder, HouseSplitBar } from "@/components/report-charts";
import { canManageEvents, canViewEvents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import {
  daysUntil,
  dayOfMonth,
  eventTiming,
  formatEventDate,
  monthShort,
  weekdayShort,
  type EventTiming,
} from "@/lib/format";
import type { House, SchoolEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";

interface EventRow {
  event: SchoolEvent;
  checkins: number;
  awarded: number;
  timing: EventTiming;
  /** houseId -> check-in count, for the race bar and fingerprint strips. */
  houseCounts: Record<string, number>;
}

interface HubData {
  rows: EventRow[];
  schoolSize: number;
}

async function fetchData(): Promise<HubData> {
  const [events, students] = await Promise.all([
    repo.listEvents(),
    repo.listStudents(),
  ]);
  const houseOf = new Map(students.map((s) => [s.id, s.houseId]));
  const rows = await Promise.all(
    events.map(async (event) => {
      const [checkins, awards] = await Promise.all([
        repo.listCheckins(event.id),
        repo.listAwards(event.id),
      ]);
      const houseCounts: Record<string, number> = {};
      for (const c of checkins) {
        const houseId = houseOf.get(c.studentId);
        if (houseId) houseCounts[houseId] = (houseCounts[houseId] ?? 0) + 1;
      }
      return {
        event,
        checkins: checkins.length,
        awarded: awards.reduce((sum, a) => sum + a.points, 0),
        timing: eventTiming(event.date),
        houseCounts,
      };
    })
  );
  return { rows, schoolSize: students.length };
}

function pctOfSchool(checkins: number, schoolSize: number): number | null {
  return schoolSize > 0 ? Math.round((checkins / schoolSize) * 100) : null;
}

function countdownLabel(date: string): string {
  const d = daysUntil(date);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return `${weekdayShort(date)} · in ${d} days`;
  return `in ${d} days`;
}

function Chip({
  tone = "stone",
  children,
}: {
  tone?: "stone" | "green" | "amber";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold",
        tone === "stone" && "bg-stone-100 text-stone-600",
        tone === "green" && "bg-emerald-100 text-emerald-700",
        tone === "amber" && "bg-amber-100 text-amber-800"
      )}
    >
      {children}
    </span>
  );
}

/** iOS-calendar style date tile: the fact every row leads with. */
function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  return (
    <div className="flex h-[52px] w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-stone-100">
      <span
        className={cn(
          "text-[9.5px] font-extrabold tracking-wider",
          muted ? "text-stone-400" : "text-red-600"
        )}
      >
        {monthShort(date)}
      </span>
      <span
        className={cn(
          "text-xl font-black leading-tight",
          muted ? "text-stone-600" : "text-stone-900"
        )}
      >
        {dayOfMonth(date)}
      </span>
    </div>
  );
}

function houseSegments(
  houses: House[],
  houseCounts: Record<string, number>
): { color: string; count: number }[] {
  return chartHouseOrder(houses).map((h) => ({
    color: h.color,
    count: houseCounts[h.id] ?? 0,
  }));
}

/** Today's event, promoted out of the list: the live scoreboard. */
function TodayHero({
  row,
  houses,
  schoolSize,
}: {
  row: EventRow;
  houses: House[];
  schoolSize: number;
}) {
  const { event, checkins, houseCounts } = row;
  const pct = pctOfSchool(checkins, schoolSize);
  // "0 · 0% · –" before the first scan reads like a failed event; the
  // card only claims to be live once someone has actually checked in.
  const started = checkins > 0;
  const leader = houses.reduce(
    (best, h) =>
      (houseCounts[h.id] ?? 0) > (best ? houseCounts[best.id] ?? 0 : 0)
        ? h
        : best,
    null as House | null
  );

  return (
    <Link
      href={`/events/${event.id}`}
      className="block space-y-3.5 rounded-[28px] bg-white p-[18px] shadow-float transition-colors hover:bg-stone-50"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {started && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              started ? "bg-emerald-500" : "bg-stone-400"
            )}
          />
        </span>
        <span
          className={cn(
            "text-[10.5px] font-extrabold uppercase tracking-wider",
            started ? "text-emerald-700" : "text-stone-500"
          )}
        >
          {started ? "Happening now" : "Today · doors not open yet"}
        </span>
        <span className="ml-auto text-xs font-semibold text-stone-500">
          {formatEventDate(event.date)}
        </span>
      </div>

      <h2 className="text-[22px] font-black leading-tight tracking-tight text-stone-900">
        {event.name}
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <NumberFlow
            value={checkins}
            className="text-[26px] font-black tabular-nums leading-tight text-stone-900"
          />
          <p className="text-xs text-stone-500">checked in</p>
        </div>
        <div>
          <p className="text-[26px] font-black tabular-nums leading-tight text-stone-900">
            {pct != null ? `${pct}%` : "–"}
          </p>
          <p className="text-xs text-stone-500">of school</p>
        </div>
        <div>
          {leader && checkins > 0 ? (
            <>
              <p className="flex items-center gap-1.5 text-[17px] font-black leading-[30px] text-stone-900">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: leader.color }}
                />
                <span className="truncate">{leader.name}</span>
              </p>
              <p className="text-xs text-stone-500">
                leading · {houseCounts[leader.id]}
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-black leading-[30px] text-stone-400">
                Ready
              </p>
              <p className="text-xs text-stone-500">tap to start scanning</p>
            </>
          )}
        </div>
      </div>

      {checkins > 0 ? (
        <HouseSplitBar
          segments={houseSegments(houses, houseCounts)}
          total={checkins}
          className="h-3 rounded-full"
        />
      ) : (
        <div className="h-3 rounded-full bg-stone-100" />
      )}
    </Link>
  );
}

/** No event today: the next one takes the hero slot with its countdown. */
function NextUpHero({ row }: { row: EventRow }) {
  const { event } = row;
  return (
    <Link
      href={`/events/${event.id}`}
      className="block space-y-3 rounded-[28px] bg-white p-[18px] shadow-float transition-colors hover:bg-stone-50"
    >
      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-stone-500">
        Next up
      </span>
      <div className="flex items-center gap-3.5">
        <DateTile date={event.date} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-black tracking-tight text-stone-900">
            {event.name}
          </h2>
          <p className="text-sm text-stone-500">{formatEventDate(event.date)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip>{countdownLabel(event.date)}</Chip>
        {event.tier === "major" && (
          <Chip tone="amber">
            <Trophy className="h-3 w-3" />
            {event.pointsPool.toLocaleString()} pts at stake
          </Chip>
        )}
      </div>
    </Link>
  );
}

function EventRowCard({
  row,
  houses,
  schoolSize,
}: {
  row: EventRow;
  houses: House[];
  schoolSize: number;
}) {
  const { event, checkins, awarded, timing, houseCounts } = row;
  const past = timing === "past";
  const pct = pctOfSchool(checkins, schoolSize);
  return (
    <Link
      href={`/events/${event.id}`}
      className="block overflow-hidden rounded-3xl bg-white shadow-soft transition-colors hover:bg-stone-50"
    >
      <div className="flex items-center gap-3 p-3.5">
        <DateTile date={event.date} muted={past} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-stone-900">{event.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {past ? (
              <>
                <Chip>
                  {checkins}
                  {pct != null && <> · {pct}% of school</>}
                </Chip>
                {awarded > 0 ? (
                  <Chip tone="green">
                    <Check className="h-3 w-3" />
                    {awarded.toLocaleString()} pts
                  </Chip>
                ) : checkins > 0 ? (
                  <Chip tone="amber">
                    <TriangleAlert className="h-3 w-3" />
                    Pool unspent
                  </Chip>
                ) : null}
              </>
            ) : (
              <>
                <Chip>{countdownLabel(event.date)}</Chip>
                {event.tier === "major" && (
                  <Chip tone="amber">
                    <Trophy className="h-3 w-3" />
                    {event.pointsPool.toLocaleString()} pts at stake
                  </Chip>
                )}
              </>
            )}
          </div>
        </div>
        {past && event.tier === "major" && <Badge variant="secondary">Major</Badge>}
        <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
      </div>
      {past && (
        <HouseSplitBar
          segments={houseSegments(houses, houseCounts)}
          total={checkins}
          className="h-1.5"
        />
      )}
    </Link>
  );
}

function EventsScreen() {
  const { session, houses } = useSession();
  const { openNewEvent } = useEventSheet();
  const [data, setData] = useState<HubData | null>(null);
  const [version, setVersion] = useState(0);
  usePageChrome({
    title: "Events",
    subtitle: "Tap an event to run check-in.",
    actions: useMemo(
      () =>
        canManageEvents(session.role) ? (
          <button
            onClick={openNewEvent}
            className={buttonVariants({ size: "sm" })}
          >
            <CalendarPlus className="h-4 w-4" />
            New
          </button>
        ) : undefined,
      [session.role, openNewEvent]
    ),
  });

  useEffect(() => {
    let cancelled = false;
    void fetchData().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Creating events, manual check-ins, and camera scans all announce
  // themselves — the hero's live numbers ride along.
  useEffect(() => {
    const refetch = () => setVersion((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, refetch);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, refetch);
  }, []);

  if (!data) {
    return (
      <Screen className="space-y-5">
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      </Screen>
    );
  }

  const { rows, schoolSize } = data;
  // Today's busiest event is the hero; any other today events stay rows.
  const todayRows = rows
    .filter((r) => r.timing === "today")
    .sort((a, b) => b.checkins - a.checkins);
  const hero = todayRows[0] ?? null;
  const extraToday = todayRows.slice(1);
  const upcoming = rows
    .filter((r) => r.timing === "future")
    .sort((a, b) => a.event.date.localeCompare(b.event.date));
  const nextUp = hero ? null : upcoming[0] ?? null;
  const upcomingRows = nextUp ? upcoming.slice(1) : upcoming;
  const pastRows = rows
    .filter((r) => r.timing === "past")
    .sort((a, b) => b.event.date.localeCompare(a.event.date));

  const sections: { label: string; rows: EventRow[] }[] = [
    { label: "Today", rows: extraToday },
    { label: "Upcoming", rows: upcomingRows },
    { label: "Past", rows: pastRows },
  ];

  return (
    <Screen className="space-y-5">
      {hero && (
        <TodayHero row={hero} houses={houses} schoolSize={schoolSize} />
      )}
      {nextUp && <NextUpHero row={nextUp} />}

      {sections.map(
        ({ label, rows: sectionRows }) =>
          sectionRows.length > 0 && (
            <div key={label}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                {label}
              </h2>
              <div className="space-y-2">
                {sectionRows.map((row) => (
                  <EventRowCard
                    key={row.event.id}
                    row={row}
                    houses={houses}
                    schoolSize={schoolSize}
                  />
                ))}
              </div>
            </div>
          )
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
