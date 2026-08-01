"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, TriangleAlert, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { useActiveEvent } from "@/components/use-active-event";
import { canAddStudents, canOperate } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GradeFilter } from "@/components/grade-filter";
import type { Student } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const RESULT_CAP = 60;

type RowStatus = "created" | "duplicate";

function ManualCheckin() {
  const event = useActiveEvent();
  const { session, houseById } = useSession();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [results, setResults] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  usePageHeader("Manual check-in", "/operate/scan");

  // Pre-mark rows for students already checked in to this event.
  useEffect(() => {
    if (!event) return;
    void repo.listCheckins(event.id).then((checkins) => {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const c of checkins) next[c.studentId] ??= "duplicate";
        return next;
      });
    });
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    const search =
      !query.trim() && grade === null
        ? Promise.resolve([])
        : repo.searchStudents(query, grade ?? undefined);
    void search.then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query, grade]);

  const shown = useMemo(() => results.slice(0, RESULT_CAP), [results]);

  const checkIn = async (student: Student) => {
    if (!event) return;
    const result = await repo.createCheckin({
      eventId: event.id,
      studentId: student.id,
      method: "manual",
      operatorId: session.staffId ?? "unknown",
    });
    setStatuses((prev) => ({
      ...prev,
      [student.id]: prev[student.id] === "created" ? "created" : result.status,
    }));
  };

  if (!event) return null;

  return (
    <Screen className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-stone-500">
          {event.name}
        </p>
        {canAddStudents(session.role) && (
          <Link
            href="/students/new?checkin=1"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </Link>
        )}
      </div>

      <Input
        placeholder="Search name or student number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className="h-12 text-base"
      />

      <GradeFilter value={grade} onChange={setGrade} />

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">
          {query.trim() || grade !== null
            ? "No students match."
            : "Search by name or number, or pick a grade."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {results.length > RESULT_CAP && (
            <p className="text-xs text-stone-500">
              Showing first {RESULT_CAP} of {results.length} — keep typing to
              narrow down.
            </p>
          )}
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          {shown.map((s) => {
            const status = statuses[s.id];
            const house = houseById(s.houseId);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-0"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: house?.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">
                    {s.firstName} {s.lastName}
                    {s.pending && (
                      <Badge variant="amber" className="ml-1.5 align-middle">
                        pending
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    Gr. {s.grade} · #{s.studentNumber} · {house?.name}
                  </p>
                </div>
                {status === "created" ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Checked in
                  </span>
                ) : status === "duplicate" ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
                    <TriangleAlert className="h-3.5 w-3.5" /> Already in
                  </span>
                ) : (
                  <Button size="sm" onClick={() => checkIn(s)}>
                    Check in
                  </Button>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </Screen>
  );
}

export default function ManualPage() {
  return (
    <Guard allow={canOperate}>
      <ManualCheckin />
    </Guard>
  );
}
