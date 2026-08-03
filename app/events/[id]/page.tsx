"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Keyboard,
  Pencil,
  QrCode,
  ScanBarcode,
  ScanLine,
  Search,
  Trophy,
  Undo2,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useStudentSheet, DATA_CHANGED_EVENT } from "@/components/student-sheet";
import { useEventSheet } from "@/components/event-sheet";
import { useScanner } from "@/components/scanner-sheet";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import {
  ArrivalsChart,
  HousePie,
  chartHouseOrder,
} from "@/components/report-charts";
import {
  canAwardPoints,
  canManageEvents,
  canUndoCheckin,
  canViewEvents,
} from "@/lib/permissions";
import { repo } from "@/lib/repo";
import {
  eventTiming,
  formatClockShort,
  formatEventDate,
  formatTime,
} from "@/lib/format";
import { houseTint } from "@/lib/config";
import type { Checkin, SchoolEvent, Student } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

const METHOD_META = {
  qr: { label: "QR pass", Icon: QrCode },
  id_scan: { label: "ID card", Icon: ScanBarcode },
  manual: { label: "Manual", Icon: Keyboard },
} as const;

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
  const { session, houses, houseById, setActiveEventId } = useSession();
  const [event, setEvent] = useState<SchoolEvent | null>(null);
  const [rows, setRows] = useState<CheckinRow[] | null>(null);
  const [awarded, setAwarded] = useState(0);
  const [schoolSize, setSchoolSize] = useState(0);
  const [version, setVersion] = useState(0);
  const { openStudent } = useStudentSheet();
  const { openEditEvent } = useEventSheet();
  const { expand: expandScanner } = useScanner();
  usePageHeader(event?.name ?? "Event", "/events");

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
      const withStudents = await Promise.all(
        checkins.map(async (checkin) => ({
          checkin,
          student: await repo.getStudent(checkin.studentId),
        }))
      );
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
  const byHouse = houses.map((h) => ({
    house: h,
    count: rows?.filter((r) => r.student?.houseId === h.id).length ?? 0,
  }));
  const leader = byHouse.reduce(
    (best, b) => (b.count > (best?.count ?? 0) ? b : best),
    null as (typeof byHouse)[number] | null
  );

  const undo = async (checkinId: string) => {
    await repo.undoCheckin(checkinId);
    setVersion((v) => v + 1);
  };

  const checkinsList = (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
        Check-ins
      </h2>
      {!rows ? (
        <div className="h-32 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">
          {timing === "past"
            ? "Nobody checked in to this event."
            : "Nobody's checked in yet — tap Scan to start."}
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

  // ---------- Past events read as a recap, not an operating screen ----------
  if (timing === "past") {
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
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm text-stone-500">
            {formatEventDate(event.date)}
            <Badge variant="secondary">Recap</Badge>
            {event.tier === "major" && <Badge>Major</Badge>}
          </p>
          {canManageEvents(session.role) && (
            <button
              onClick={() => openEditEvent(event)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>

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

        {checkinsList}
      </Screen>
    );
  }

  // ---------- Today / upcoming: the operating layout ----------
  const maxCount = Math.max(...byHouse.map((b) => b.count), 1);

  // Scanning opens the scanner sheet in place; manual is still a page.
  const startScanning = () => {
    setActiveEventId(event.id);
    expandScanner();
  };
  const startManual = () => {
    setActiveEventId(event.id);
    router.push("/operate/manual");
  };

  return (
    <Screen className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-stone-500">
          {formatEventDate(event.date)}
          {timing === "today" && (
            <Badge variant="green" className="ml-1.5">
              Today
            </Badge>
          )}
        </p>
        <Badge variant={event.tier === "major" ? "default" : "secondary"}>
          {event.tier === "major" ? "Major" : "Minor"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={startScanning}>
          <ScanLine className="h-5 w-5" />
          Scan
        </Button>
        <Button size="lg" variant="outline" onClick={startManual}>
          <Search className="h-5 w-5" />
          Manual
        </Button>
      </div>
      {(canAwardPoints(session.role) || canManageEvents(session.role)) && (
        <div className="flex gap-2">
          {canAwardPoints(session.role) && (
            <Link
              href={`/events/${event.id}/award`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Trophy className="h-4 w-4" />
              {awarded > 0
                ? `Points awarded: ${awarded} of ${event.pointsPool}`
                : `Award points (pool: ${event.pointsPool})`}
            </Link>
          )}
          {canManageEvents(session.role) && (
            <button
              onClick={() => openEditEvent(event)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Attendance by house
          </h2>
          <p className="text-sm text-stone-600">
            <strong className="text-lg tabular-nums text-stone-900">
              {rows?.length ?? "–"}
            </strong>{" "}
            checked in
          </p>
        </div>
        <div className="space-y-1.5">
          {byHouse.map(({ house, count }) => (
            <div
              key={house.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
              style={{ background: houseTint(house.color, 8) }}
            >
              <span
                className="w-20 shrink-0 text-sm font-bold"
                style={{ color: `color-mix(in srgb, ${house.color} 80%, black)` }}
              >
                {house.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    backgroundColor: house.color,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-stone-700">
                {count}
              </span>
              {leader && leader.count > 0 && leader.house.id === house.id && (
                <Badge variant="green">Leading</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {checkinsList}
    </Screen>
  );
}

export default function EventDetailPage() {
  return (
    <Guard allow={canViewEvents}>
      <EventDetail />
    </Guard>
  );
}
