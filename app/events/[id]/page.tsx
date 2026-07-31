"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
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
import { useFormSheet } from "@/components/form-sheet";
import { useStudentSheet, DATA_CHANGED_EVENT } from "@/components/student-sheet";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import {
  canAwardPoints,
  canManageEvents,
  canUndoCheckin,
  canViewEvents,
} from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { eventTiming, formatEventDate, formatTime } from "@/lib/format";
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

function EventDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, houses, houseById, setActiveEventId } = useSession();
  const [event, setEvent] = useState<SchoolEvent | null>(null);
  const [rows, setRows] = useState<CheckinRow[] | null>(null);
  const [awarded, setAwarded] = useState(0);
  const [version, setVersion] = useState(0);
  const { openStudent } = useStudentSheet();
  const { openEventForm } = useFormSheet();
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
      const [checkins, awards] = await Promise.all([
        repo.listCheckins(e.id),
        repo.listAwards(e.id),
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
  const maxCount = Math.max(...byHouse.map((b) => b.count), 1);
  const leader = byHouse.reduce(
    (best, b) => (b.count > (best?.count ?? 0) ? b : best),
    null as (typeof byHouse)[number] | null
  );

  const startOperating = (path: "/operate/scan" | "/operate/manual") => {
    setActiveEventId(event.id);
    router.push(path);
  };

  const undo = async (checkinId: string) => {
    await repo.undoCheckin(checkinId);
    setVersion((v) => v + 1);
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
        <Button size="lg" onClick={() => startOperating("/operate/scan")}>
          <ScanLine className="h-5 w-5" />
          Scan
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => startOperating("/operate/manual")}
        >
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEventForm(event)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
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

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Check-ins
        </h2>
        {!rows ? (
          <div className="h-32 animate-pulse rounded-2xl bg-stone-200/60" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">
            Nobody&apos;s checked in yet — tap Scan to start.
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
