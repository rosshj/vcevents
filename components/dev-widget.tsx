"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Dices,
  FlaskConical,
  RefreshCw,
  Sparkles,
  UserX,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { repo } from "@/lib/repo";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role, Student } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = [
  "house_director",
  "community_teacher",
  "house_executive",
  "student",
];

const SHORT_LABELS: Record<Role, string> = {
  house_director: "Director",
  community_teacher: "Teacher",
  house_executive: "Executive",
  student: "Student",
};

function randomOf<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Floating tester bubble (bottom-right, Vercel-toolbar style): switch role
 * and jump between interesting student states without leaving the screen.
 */
export function DevWidget() {
  const { ready, session, staff, currentStudent, currentStaff, houseById, setRole, setStaffId } =
    useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!ready) return null;

  const pickStudent = async (kind: "involved" | "fresh" | "random") => {
    setBusy(kind);
    try {
      let student: Student | undefined;
      if (kind === "fresh") {
        student = randomOf(await repo.uninvolvedStudents());
      } else if (kind === "involved") {
        const events = await repo.listEvents();
        const students = await repo.listStudents();
        const byId = new Map(students.map((s) => [s.id, s]));
        const checkins = (
          await Promise.all(events.map((e) => repo.listCheckins(e.id)))
        ).flat();
        student = randomOf(
          checkins
            .map((c) => byId.get(c.studentId))
            .filter((s): s is Student => Boolean(s))
        );
      } else {
        student = randomOf(await repo.listStudents());
      }
      if (student) setRole("student", { studentId: student.id });
    } finally {
      setBusy(null);
    }
  };

  const house = currentStudent ? houseById(currentStudent.houseId) : undefined;
  const staffForRole = staff.filter((s) => s.role === session.role);

  return (
    <>
      {open && (
        <button
          aria-label="Close role switcher"
          className="fixed inset-0 z-50 cursor-default bg-transparent"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),1rem)+5.25rem)] right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <div
            ref={panelRef}
            className="animate-scan-pop w-72 rounded-3xl bg-white/90 p-4 shadow-float backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Try the app as…
              </p>
              <Link
                href="/dev"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-stone-500 underline underline-offset-2 hover:text-stone-800"
              >
                Dev tools
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
                    session.role === r
                      ? "bg-stone-900 text-white shadow-soft"
                      : "bg-stone-900/5 text-stone-700 hover:bg-stone-900/10"
                  )}
                >
                  {SHORT_LABELS[r]}
                </button>
              ))}
            </div>

            {session.role === "student" ? (
              <div className="mt-3 space-y-2">
                {currentStudent && (
                  <div className="flex items-center gap-2 rounded-xl bg-stone-900/5 px-3 py-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: house?.color }}
                    />
                    <span className="truncate font-semibold text-stone-900">
                      {currentStudent.firstName} {currentStudent.lastName}
                    </span>
                    <span className="ml-auto shrink-0 text-stone-500">
                      Gr. {currentStudent.grade}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() => pickStudent("involved")}
                    disabled={busy !== null}
                    className="flex items-center gap-2 rounded-xl bg-stone-900/5 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-900/10 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    Random student <strong>with</strong> check-ins
                    {busy === "involved" && (
                      <RefreshCw className="ml-auto h-3 w-3 animate-spin" />
                    )}
                  </button>
                  <button
                    onClick={() => pickStudent("fresh")}
                    disabled={busy !== null}
                    className="flex items-center gap-2 rounded-xl bg-stone-900/5 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-900/10 disabled:opacity-50"
                  >
                    <UserX className="h-3.5 w-3.5 shrink-0" />
                    Random student, <strong>no</strong> check-ins
                    {busy === "fresh" && (
                      <RefreshCw className="ml-auto h-3 w-3 animate-spin" />
                    )}
                  </button>
                  <button
                    onClick={() => pickStudent("random")}
                    disabled={busy !== null}
                    className="flex items-center gap-2 rounded-xl bg-stone-900/5 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-900/10 disabled:opacity-50"
                  >
                    <Dices className="h-3.5 w-3.5 shrink-0" />
                    Any random student
                    {busy === "random" && (
                      <RefreshCw className="ml-auto h-3 w-3 animate-spin" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                  Operating as
                </p>
                <select
                  value={session.staffId ?? ""}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-stone-900/5 px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none"
                >
                  {staffForRole.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {currentStaff && (
                  <p className="px-1 text-[11px] text-stone-400">
                    {ROLE_LABELS[currentStaff.role]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close role switcher" : "Open role switcher"}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full shadow-float backdrop-blur-xl transition-all active:scale-95",
            open
              ? "bg-stone-900 text-white"
              : "bg-white/85 text-stone-700 hover:bg-white"
          )}
        >
          {open ? <X className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
