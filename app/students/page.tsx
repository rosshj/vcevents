"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileUp, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useStudentSheet } from "@/components/student-sheet";
import { usePageChrome } from "@/components/page-header";
import { Guard, Screen } from "@/components/guard";
import { canImportCsv, canViewStudents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StudentListRow } from "@/components/student-row";
import { cn } from "@/lib/utils";

const RESULT_CAP = 100;

function StudentsScreen() {
  const { session, houseById } = useSession();
  const { openStudent } = useStudentSheet();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [results, setResults] = useState<Student[] | null>(null);
  const [total, setTotal] = useState(0);
  usePageChrome({
    title: "Students",
    subtitle: total ? `${total} students` : undefined,
    actions: useMemo(
      () => (
        <>
          {canImportCsv(session.role) && (
            <Link
              href="/students/import"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FileUp className="h-4 w-4" />
              CSV
            </Link>
          )}
          <Link
            href="/students/new"
            className={buttonVariants({ size: "sm" })}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </Link>
        </>
      ),
      [session.role]
    ),
  });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      repo.searchStudents(query, grade ?? undefined),
      repo.listStudents(),
    ]).then(([r, all]) => {
      if (cancelled) return;
      setResults(r);
      setTotal(all.length);
    });
    return () => {
      cancelled = true;
    };
  }, [query, grade]);

  const shown = results?.slice(0, RESULT_CAP) ?? [];

  // Break the browse view into A/B/C… sections so it reads as a directory,
  // not a wall. While searching, results are already narrow — keep them flat.
  let grouped: { letter: string; students: Student[] }[] | null = null;
  if (!query.trim()) {
    grouped = [];
    for (const s of shown) {
      const letter = (s.lastName[0] ?? "#").toUpperCase();
      const last = grouped[grouped.length - 1];
      if (last?.letter === letter) last.students.push(s);
      else grouped.push({ letter, students: [s] });
    }
  }

  const renderRow = (s: Student) => {
    const house = houseById(s.houseId);
    return (
      <StudentListRow
        key={s.id}
        color={house?.color}
        title={
          <>
            {s.lastName}, {s.firstName}
            {s.pending && (
              <Badge variant="amber" className="ml-1.5 align-middle">
                pending
              </Badge>
            )}
          </>
        }
        meta={`Gr. ${s.grade} · #${s.studentNumber} · ${house?.name}`}
        onClick={() => openStudent(s.id)}
      />
    );
  };

  return (
    <Screen className="space-y-3">
      <Input
        placeholder="Search name or student number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setGrade(null)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold",
            grade === null
              ? "bg-stone-900 text-white shadow-soft"
              : "bg-stone-900/8 text-stone-600 hover:bg-stone-900/15"
          )}
        >
          All
        </button>
        {GRADES.map((g) => (
          <button
            key={g}
            onClick={() => setGrade((prev) => (prev === g ? null : g))}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold",
              grade === g
                ? "bg-stone-900 text-white shadow-soft"
                : "bg-stone-900/8 text-stone-600 hover:bg-stone-900/15"
            )}
          >
            Gr. {g}
          </button>
        ))}
      </div>

      {!results ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : (
        <div className="space-y-4">
          {results.length > RESULT_CAP && (
            <p className="text-xs text-stone-500">
              Showing first {RESULT_CAP} of {results.length} — search to narrow
              down.
            </p>
          )}
          {grouped ? (
            grouped.map(({ letter, students }) => (
              <div key={letter}>
                <h2 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-stone-400">
                  {letter}
                </h2>
                <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
                  {students.map(renderRow)}
                </div>
              </div>
            ))
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
              {shown.map(renderRow)}
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}

export default function StudentsPage() {
  return (
    <Guard allow={canViewStudents}>
      <StudentsScreen />
    </Guard>
  );
}
