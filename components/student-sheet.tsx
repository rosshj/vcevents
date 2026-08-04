"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
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
import { BOTTOM_SHEET_IDS, BottomSheet } from "@/components/ui/sheet";
import { StudentForm } from "@/components/student-form";

const METHOD_META = {
  qr: { label: "QR pass", Icon: QrCode },
  id_scan: { label: "ID card", Icon: ScanBarcode },
  manual: { label: "Manual", Icon: Keyboard },
} as const;

/** Fired after the sheet mutates data so open screens can refetch. */
export const DATA_CHANGED_EVENT = "vc:data-changed";

interface StudentSheetContextValue {
  openStudent: (studentId: string) => void;
  /** Opens the "add student" form in a sheet. */
  openAddStudent: () => void;
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
    return (
      <div className="px-5 pt-4">
        <div className="h-48 animate-pulse rounded-3xl bg-stone-200/60" />
      </div>
    );
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

  const initials = `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`;

  return (
    <div>
      {/* Contact card: full-bleed house-color cover, avatar overlapping,
          centered identity — the sheet as a profile, not a form. */}
      <div
        className="h-24 w-full"
        style={{
          background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 72%, black))`,
        }}
      />
      <div className="px-5 text-center">
        <div
          className="mx-auto -mt-10 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-soft"
          aria-hidden
        >
          <span
            className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-xl font-black"
            style={{ background: houseTint(color, 14), color }}
          >
            {initials}
          </span>
        </div>
        <p className="mt-3 text-2xl font-black tracking-tight text-stone-900">
          {student.firstName} {student.lastName}
        </p>
        <p className="mt-0.5 text-sm text-stone-500">
          Grade {student.grade} · #{student.studentNumber}
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span
            className="inline-block rounded-full px-3.5 py-1.5 text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {house?.name} House
          </span>
          {student.pending && <Badge variant="amber">pending</Badge>}
        </div>
        {history && (
          <p className="mt-3 text-xs font-semibold text-stone-400">
            {history.length === 0
              ? "No check-ins yet this year"
              : `${history.length} check-in${history.length === 1 ? "" : "s"} this year`}
          </p>
        )}
      </div>

      <div className="space-y-4 px-5 pt-4">
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
  const [addOpen, setAddOpen] = useState(false);
  // Remount the form on every open so it never shows the previous run's
  // values or "Saved" state.
  const [addCount, setAddCount] = useState(0);

  const openStudent = useCallback((id: string) => {
    setStudentId(id);
    setOpen(true);
  }, []);
  const openAddStudent = useCallback(() => {
    setAddCount((n) => n + 1);
    setAddOpen(true);
  }, []);

  return (
    <StudentSheetContext.Provider value={{ openStudent, openAddStudent }}>
      {/* The page nests through each sheet's Root so the depth outlet in
          AppShell can read their travel and scale the page back. */}
      <BottomSheet
        presented={open}
        onPresentedChange={setOpen}
        title="Student details"
        componentId={BOTTOM_SHEET_IDS.student}
        flush
        content={
          studentId && (
            <SheetBody studentId={studentId} onClose={() => setOpen(false)} />
          )
        }
      >
        {/* Forms in a sheet: Silk's Scroll keeps the focused input above
            the on-screen keyboard, which is what vaul couldn't do for us. */}
        <BottomSheet
          presented={addOpen}
          onPresentedChange={setAddOpen}
          title="Add student"
          componentId={BOTTOM_SHEET_IDS.addStudent}
          content={
            <>
              <h2 className="mb-4 text-2xl font-bold text-stone-900">
                Add student
              </h2>
              <StudentForm
                key={addCount}
                onSaved={() => {
                  setAddOpen(false);
                  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
                }}
              />
            </>
          }
        >
          {children}
        </BottomSheet>
      </BottomSheet>
    </StudentSheetContext.Provider>
  );
}
