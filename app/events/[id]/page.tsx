"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import NumberFlow from "@number-flow/react";
import { ChevronRight, Pencil, Trophy, Undo2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { METHOD_META } from "@/components/method-meta";
import { useStudentSheet } from "@/components/student-sheet";
import { useEventSheet } from "@/components/event-sheet";
import { useScanner } from "@/components/scanner-sheet";
import { Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import {
  ArrivalsChart,
  HousePie,
  HouseSplitBar,
  chartHouseOrder,
} from "@/components/report-charts";
import {
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  LegendProgress,
  LegendValue,
  type LegendItemData,
} from "@/components/bklit";
import {
  canAwardPoints,
  canManageEvents,
  canUndoCheckin,
  canViewEvents,
} from "@/lib/permissions";
import { repo } from "@/lib/repo";
import {
  daysUntil,
  eventTiming,
  formatClockShort,
  formatEventDate,
  formatTime,
  relativeTime,
} from "@/lib/format";
import { houseTint } from "@/lib/config";
import type { Checkin, SchoolEvent, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";

interface CheckinRow {
  checkin: Checkin;
  student: Student | null;
}

/** Arrivals bucketed by time; bucket size picked to land ≤ 9 bars. */
function arrivalBuckets(
  times: number[]
): { label: string; arrivals: number }[] {
  if (times.length === 0) return [];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const sizes = [15, 30, 60, 120].map((m) => m * 60_000);
  const size = sizes.find((s) => (max - min) / s <= 8) ?? sizes[3];
  const start = Math.floor(min / size) * size;
  const buckets = Array.from(
    { length: Math.floor((max - start) / size) + 1 },
    (_, i) => ({ t: start + i * size, count: 0 })
  );
  for (const t of times) buckets[Math.floor((t - start) / size)].count += 1;
  return buckets.map((b) => ({
    label: formatClockShort(b.t),
    arrivals: b.count,
  }));
}

function EventDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, houses, houseById } = useSession();
  // Students reach this page from their own check-in history: they see
  // the scoreboard and recap, never the roster-level check-in feed.
  const isStaff = canViewEvents(session.role);
  const [event, setEvent] = useState<SchoolEvent | null>(null);
  const [rows, setRows] = useState<CheckinRow[] | null>(null);
  const [awarded, setAwarded] = useState(0);
  const [schoolSize, setSchoolSize] = useState(0);
  const [version, setVersion] = useState(0);
  // Ticks for the live feed's relative times and the pace stat.
  const [now, setNow] = useState(() => Date.now());
  const { openStudent } = useStudentSheet();
  const { openEditEvent } = useEventSheet();
  const { setProspect } = useScanner();

  // Edit lives in the sticky header's utility row, icon-only.
  const { role } = session;
  const headerActions = useMemo(
    () =>
      event && canManageEvents(role) ? (
        <button
          onClick={() => openEditEvent(event)}
          aria-label="Edit"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors hover:bg-stone-200"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : undefined,
    [event, role, openEditEvent]
  );
  const headerSubtitle = event
    ? `${formatEventDate(event.date)} · ${event.tier === "major" ? "Major" : "Minor"}${
        eventTiming(event.date) === "past" ? " · Recap" : ""
      }`
    : undefined;
  usePageHeader(event?.name ?? "Event", isStaff ? "/events" : "/points", {
    actions: headerActions,
    subtitle: headerSubtitle,
  });

  // Offer this event to the scanner bar ("Ready to scan") while viewing a
  // live or upcoming event. Keyed on id/date, not the object — refetches
  // must not churn the prospect (that reset the bar's elapsed clock).
  const evId = event?.id;
  const evDate = event?.date;
  useEffect(() => {
    if (!isStaff || !evId || !evDate || eventTiming(evDate) === "past") return;
    setProspect(evId);
    return () => setProspect(null);
  }, [isStaff, evId, evDate, setProspect]);

  useEffect(() => {
    if (!evDate || eventTiming(evDate) !== "today") return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [evDate]);

  // Memoized: the live page re-renders on every pace tick.
  const byHouse = useMemo(
    () =>
      houses.map((h) => ({
        house: h,
        count: rows?.filter((r) => r.student?.houseId === h.id).length ?? 0,
      })),
    [houses, rows]
  );

  // Refetch when the student sheet checks someone in over this screen.
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await repo.getEvent(params.id);
      if (!e) {
        router.replace("/events");
        return;
      }
      const [checkins, awards, students] = await Promise.all([
        repo.listCheckins(e.id),
        repo.listAwards(e.id),
        repo.listStudents(),
      ]);
      // Join against the roster we already fetched — one lookup map
      // instead of a repo call per check-in.
      const byId = new Map(students.map((s) => [s.id, s]));
      const withStudents = checkins.map((checkin) => ({
        checkin,
        student: byId.get(checkin.studentId) ?? null,
      }));
      if (cancelled) return;
      setEvent(e);
      setRows(withStudents);
      setAwarded(awards.reduce((sum, a) => sum + a.points, 0));
      setSchoolSize(students.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router, version]);

  if (!event) {
    return (
      <Screen>
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      </Screen>
    );
  }

  const timing = eventTiming(event.date);
  const leader = byHouse.reduce(
    (best, b) => (b.count > (best?.count ?? 0) ? b : best),
    null as (typeof byHouse)[number] | null
  );

  const undo = async (checkinId: string) => {
    await repo.undoCheckin(checkinId);
    setVersion((v) => v + 1);
    // Same contract as every other write: tell live views (scanner bar
    // tally, events hub hero) the counts changed.
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
  };

  // ---------- Past events read as a recap, not an operating screen ----------
  if (timing === "past") {
    const checkinsList = (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
        Check-ins
      </h2>
      {!rows ? (
        <div className="h-32 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">
          Nobody checked in to this event.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          {rows.map(({ checkin, student }) => {
            const house = student ? houseById(student.houseId) : undefined;
            const method = METHOD_META[checkin.method];
            return (
              <div
                key={checkin.id}
                className="flex items-center gap-3 border-b border-stone-100 px-4 py-2 last:border-0"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: house?.color ?? "#d6d3d1" }}
                />
                {student ? (
                  <button
                    onClick={() => openStudent(student.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-stone-500">
                      <method.Icon className="h-3 w-3" />
                      {method.label} · {formatTime(checkin.createdAt)} · Gr.{" "}
                      {student.grade}
                    </p>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-400">
                      (student removed)
                    </p>
                  </div>
                )}
                {canUndoCheckin(session.role) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => undo(checkin.id)}
                    aria-label="Undo check-in"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    );

    const total = rows?.length ?? 0;
    const pct = schoolSize > 0 ? Math.round((total / schoolSize) * 100) : null;
    const times = (rows ?? []).map((r) =>
      new Date(r.checkin.createdAt).getTime()
    );
    const buckets = arrivalBuckets(times);
    const peakBucket =
      total >= 3
        ? buckets.reduce((best, b) => (b.arrivals > best.arrivals ? b : best))
        : null;
    const methodCounts = { qr: 0, id_scan: 0, manual: 0 } as Record<
      Checkin["method"],
      number
    >;
    for (const r of rows ?? []) methodCounts[r.checkin.method] += 1;
    const orderedHouses = chartHouseOrder(houses);
    const pieRows = orderedHouses
      .map((house) => ({
        house,
        count: byHouse.find((b) => b.house.id === house.id)?.count ?? 0,
      }))
      .filter((r) => r.count > 0);

    return (
      <Screen className="space-y-4">
        {leader && leader.count > 0 && (
          <div
            className="flex items-center gap-3 rounded-3xl px-5 py-3.5"
            style={{ background: houseTint(leader.house.color, 10) }}
          >
            <span className="text-2xl" aria-hidden>
              👑
            </span>
            <div className="min-w-0">
              <p
                className="text-[15px] font-extrabold"
                style={{
                  color: `color-mix(in srgb, ${leader.house.color} 80%, black)`,
                }}
              >
                {leader.house.name} won the day
              </p>
              <p
                className="text-xs font-semibold"
                style={{ color: leader.house.color }}
              >
                {leader.count} check-ins
                {total > 0 && <> · {Math.round((leader.count / total) * 100)}% of turnout</>}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 py-1 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums text-stone-900">
              {total}
            </p>
            <p className="text-xs text-stone-500">checked in</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums text-stone-900">
              {pct != null ? `${pct}%` : "–"}
            </p>
            <p className="text-xs text-stone-500">of school</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums text-stone-900">
              {peakBucket?.label ?? "–"}
            </p>
            <p className="text-xs text-stone-500">peak arrivals</p>
          </div>
        </div>

        {buckets.length > 1 && (
          <div className="rounded-3xl bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
              Arrivals
            </h2>
            <ArrivalsChart buckets={buckets} />
          </div>
        )}

        <div className="rounded-3xl bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
            Attendance by house
          </h2>
          {pieRows.length > 0 ? (
            <HousePie rows={pieRows} total={total} />
          ) : (
            <p className="py-4 text-center text-sm text-stone-500">
              No check-ins recorded.
            </p>
          )}
        </div>

        {total > 0 && (
          <div className="rounded-3xl bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
              How they checked in
            </h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(METHOD_META) as (keyof typeof METHOD_META)[]).map(
                (m) => {
                  const meta = METHOD_META[m];
                  return (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700"
                    >
                      <meta.Icon className="h-3.5 w-3.5" />
                      {meta.label}{" "}
                      <span className="tabular-nums">
                        {Math.round((methodCounts[m] / total) * 100)}%
                      </span>
                    </span>
                  );
                }
              )}
            </div>
          </div>
        )}

        {awarded > 0 ? (
          canAwardPoints(session.role) ? (
            <Link
              href={`/events/${event.id}/award`}
              className="flex items-center justify-between rounded-3xl bg-emerald-100 px-5 py-3.5 text-sm font-extrabold text-emerald-700"
            >
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                {awarded.toLocaleString()} of {event.pointsPool.toLocaleString()}{" "}
                pts awarded
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="flex items-center gap-2 rounded-3xl bg-emerald-100 px-5 py-3.5 text-sm font-extrabold text-emerald-700">
              <Trophy className="h-4 w-4" />
              {awarded.toLocaleString()} of {event.pointsPool.toLocaleString()}{" "}
              pts awarded
            </div>
          )
        ) : canAwardPoints(session.role) ? (
          <Link
            href={`/events/${event.id}/award`}
            className="flex items-center justify-between rounded-3xl bg-amber-100 px-5 py-3.5 text-sm font-extrabold text-amber-800"
          >
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Award points (pool: {event.pointsPool.toLocaleString()})
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : total > 0 ? (
          <div className="flex items-center gap-2 rounded-3xl bg-amber-100 px-5 py-3.5 text-sm font-extrabold text-amber-800">
            <Trophy className="h-4 w-4" />
            Points pool unspent
          </div>
        ) : null}

        {isStaff && checkinsList}
      </Screen>
    );
  }

  // ---------- Today / upcoming: the live scoreboard ----------
  const isToday = timing === "today";
  const total = rows?.length ?? 0;
  const pct = schoolSize > 0 ? Math.round((total / schoolSize) * 100) : null;
  const recent = isToday
    ? (rows ?? []).filter(
        (r) => now - new Date(r.checkin.createdAt).getTime() < 900_000
      ).length
    : 0;
  const standings = [...byHouse].sort((a, b) => b.count - a.count);
  const legendItems: LegendItemData[] = standings.map((b, i) => ({
    label: `${b.house.name}${i === 0 && b.count > 0 ? " 👑" : ""}`,
    value: b.count,
    maxValue: Math.max(standings[0]?.count ?? 0, 1),
    color: b.house.color,
  }));
  const feedRows = [...(rows ?? [])].sort((a, b) =>
    b.checkin.createdAt.localeCompare(a.checkin.createdAt)
  );

  return (
    <Screen className="space-y-4">
      {/* Box score — the same treatment as the sheet and the recap. */}
      <div className="grid grid-cols-3 gap-2 py-1 text-center">
        <div>
          <NumberFlow
            value={total}
            className="text-2xl font-black tabular-nums text-stone-900"
          />
          <p className="text-xs text-stone-500">checked in</p>
        </div>
        <div>
          <p className="text-2xl font-black tabular-nums text-stone-900">
            {pct != null ? `${pct}%` : "–"}
          </p>
          <p className="text-xs text-stone-500">of school</p>
        </div>
        {isToday ? (
          <div>
            <p className="text-2xl font-black tabular-nums text-stone-900">
              +{recent}
            </p>
            <p className="text-xs text-stone-500">last 15 min</p>
          </div>
        ) : (
          <div>
            <p className="text-2xl font-black tabular-nums text-stone-900">
              {daysUntil(event.date)}d
            </p>
            <p className="text-xs text-stone-500">until start</p>
          </div>
        )}
      </div>

      {timing === "future" && event.tier === "major" && (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
            <Trophy className="h-3.5 w-3.5" />
            {event.pointsPool.toLocaleString()} pts at stake
          </span>
        </div>
      )}

      <div className="rounded-3xl bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
          House race
        </h2>
        {total > 0 ? (
          <HouseSplitBar
            segments={chartHouseOrder(houses).map((h) => ({
              color: h.color,
              count: byHouse.find((b) => b.house.id === h.id)?.count ?? 0,
            }))}
            total={total}
            className="mb-4 h-3 rounded-full"
          />
        ) : (
          <div className="mb-4 h-3 rounded-full bg-stone-100" />
        )}
        <Legend items={legendItems}>
          <LegendItemComponent className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1">
            <LegendMarker />
            <LegendLabel />
            <LegendValue />
            <div className="col-span-full">
              <LegendProgress />
            </div>
          </LegendItemComponent>
        </Legend>
      </div>

      {canAwardPoints(session.role) && (
        <Link
          href={`/events/${event.id}/award`}
          className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
        >
          <Trophy className="h-3.5 w-3.5" />
          {awarded > 0
            ? `Points awarded · ${awarded} of ${event.pointsPool}`
            : `Award points · pool ${event.pointsPool}`}
        </Link>
      )}

      {isStaff && (
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Check-ins{isToday ? " · live" : ""}
        </h2>
        {!rows ? (
          <div className="h-32 animate-pulse rounded-2xl bg-stone-200/60" />
        ) : feedRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">
            {isToday
              ? "Nobody's checked in yet — tap the bar below to start scanning."
              : "Nobody's checked in yet."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
            {feedRows.map(({ checkin, student }) => {
              const house = student ? houseById(student.houseId) : undefined;
              const method = METHOD_META[checkin.method];
              return (
                <div
                  key={checkin.id}
                  className="flex items-center gap-3 border-b border-stone-100 px-4 py-2 last:border-0"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: house?.color ?? "#d6d3d1" }}
                  />
                  {student ? (
                    <button
                      onClick={() => openStudent(student.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-stone-500">
                        <method.Icon className="h-3 w-3" />
                        {method.label} · Gr. {student.grade}
                      </p>
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-400">
                        (student removed)
                      </p>
                    </div>
                  )}
                  <span className="shrink-0 text-xs tabular-nums text-stone-400">
                    {relativeTime(checkin.createdAt, now)}
                  </span>
                  {canUndoCheckin(session.role) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => undo(checkin.id)}
                      aria-label="Undo check-in"
                    >
                      <Undo2 className="h-4 w-4" />
                      Undo
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </Screen>
  );
}

export default function EventDetailPage() {
  // Open to students too — their Points page links here for results.
  return <EventDetail />;
}
