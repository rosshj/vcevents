"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import {
  CalendarDays,
  Check,
  Keyboard,
  QrCode,
  ScanBarcode,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { repo } from "@/lib/repo";
import { formatDateTime, formatEventDate } from "@/lib/format";
import { houseTint } from "@/lib/config";
import type { Checkin, SchoolEvent, Student } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const METHOD_META = {
  qr: { label: "QR pass", Icon: QrCode },
  id_scan: { label: "ID card", Icon: ScanBarcode },
  manual: { label: "Manual", Icon: Keyboard },
} as const;

/** Fired after the sheet mutates data so open screens can refetch. */
export const DATA_CHANGED_EVENT = "vc:data-changed";

interface StudentSheetContextValue {
  openStudent: (studentId: string) => void;
}

const StudentSheetContext = createContext<StudentSheetContextValue | null>(
  null
);

export function useStudentSheet(): StudentSheetContextValue {
  const ctx = useContext(StudentSheetContext);
  if (!ctx) {
    throw new Error("useStudentSheet must be used within StudentSheetProvider");
  }
  return ctx;
}

interface HistoryRow {
  checkin: Checkin;
  event: SchoolEvent | null;
}

function SheetBody({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const { session, houseById } = useSession();
  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [activeEvent, setActiveEvent] = useState<SchoolEvent | null>(null);
  const [checkinResult, setCheckinResult] = useState<
    "created" | "duplicate" | null
  >(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await repo.getStudent(studentId);
      const checkins = s ? await repo.listCheckinsByStudent(s.id) : [];
      const withEvents = await Promise.all(
        checkins.map(async (checkin) => ({
          checkin,
          event: await repo.getEvent(checkin.eventId),
        }))
      );
      const active = session.activeEventId
        ? await repo.getEvent(session.activeEventId)
        : null;
      if (cancelled) return;
      setStudent(s);
      setHistory(withEvents);
      setActiveEvent(active);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, session.activeEventId, version]);

  if (!student) {
    return <div className="h-48 animate-pulse rounded-3xl bg-stone-200/60" />;
  }

  const house = houseById(student.houseId);
  const color = house?.color ?? "#292524";
  const alreadyInActive =
    activeEvent != null &&
    (history?.some((h) => h.checkin.eventId === activeEvent.id) ?? false);

  const checkInNow = async () => {
    if (!activeEvent) return;
    const result = await repo.createCheckin({
      eventId: activeEvent.id,
      studentId: student.id,
      method: "manual",
      operatorId: session.staffId ?? "unknown",
    });
    setCheckinResult(result.status);
    setVersion((v) => v + 1);
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
  };

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-3xl"
        style={{ background: houseTint(color, 8) }}
      >
        <div className="h-2 w-full" style={{ backgroundColor: color }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xl font-bold text-stone-900">
                {student.firstName} {student.lastName}
              </p>
              <p className="mt-0.5 text-sm text-stone-600">
                Grade {student.grade} · #{student.studentNumber}
              </p>
            </div>
            {student.pending && <Badge variant="amber">pending</Badge>}
          </div>
          <span
            className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {house?.name} House
          </span>
        </div>
      </div>

      {activeEvent &&
        (checkinResult === "created" ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
            <Check className="h-4 w-4" />
            Checked in to {activeEvent.name}
          </div>
        ) : checkinResult === "duplicate" || alreadyInActive ? (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-800">
            <TriangleAlert className="h-4 w-4" />
            Already checked in to {activeEvent.name}
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={checkInNow}>
            <UserCheck className="h-5 w-5" />
            Check in to {activeEvent.name}
          </Button>
        ))}

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Check-in history
        </h2>
        {!history ? (
          <div className="h-24 animate-pulse rounded-3xl bg-stone-200/60" />
        ) : history.length === 0 ? (
          <div className="rounded-3xl bg-stone-50 p-6 text-center">
            <CalendarDays className="mx-auto h-7 w-7 text-stone-300" />
            <p className="mt-2 text-sm font-semibold text-stone-700">
              No check-ins yet
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-stone-50">
            {history.map(({ checkin, event }) => {
              const method = METHOD_META[checkin.method];
              return (
                <Link
                  key={checkin.id}
                  href={event ? `/events/${event.id}` : "/events"}
                  onClick={onClose}
                  className="flex items-center gap-3 border-b border-stone-200/60 px-4 py-2.5 last:border-0 hover:bg-stone-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {event?.name ?? "(event removed)"}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-stone-500">
                      <method.Icon className="h-3 w-3" />
                      {method.label} · {formatDateTime(checkin.createdAt)}
                    </p>
                  </div>
                  {event && (
                    <span className="shrink-0 text-xs text-stone-400">
                      {formatEventDate(event.date)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * App-wide bottom sheet for student details — open it from any screen
 * (students list, event check-ins, reports) without losing your place.
 */
export function StudentSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

  const openStudent = useCallback((id: string) => {
    setStudentId(id);
    setOpen(true);
  }, []);

  return (
    <StudentSheetContext.Provider value={{ openStudent }}>
      {children}
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[2rem] bg-white outline-none"
          >
            <Drawer.Title className="sr-only">Student details</Drawer.Title>
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-stone-300" />
            <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
              {studentId && (
                <SheetBody
                  studentId={studentId}
                  onClose={() => setOpen(false)}
                />
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </StudentSheetContext.Provider>
  );
}
