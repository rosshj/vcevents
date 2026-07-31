"use client";

import { useEffect, useState } from "react";
import { ChevronRight, FileUp, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useFormSheet } from "@/components/form-sheet";
import { DATA_CHANGED_EVENT } from "@/components/student-sheet";
import { useStudentSheet } from "@/components/student-sheet";
import { Guard, Screen } from "@/components/guard";
import { canImportCsv, canViewStudents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RESULT_CAP = 100;

function StudentsScreen() {
  const { session, houseById } = useSession();
  const { openStudent } = useStudentSheet();
  const { openStudentForm, openCsvImport } = useFormSheet();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [results, setResults] = useState<Student[] | null>(null);
  const [total, setTotal] = useState(0);

  // Refetch when the form sheet adds/imports students over this screen.
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, bump);
  }, []);

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
  }, [query, grade, version]);

  const shown = results?.slice(0, RESULT_CAP) ?? [];

  return (
    <Screen className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Students</h1>
          <p className="text-sm text-stone-500">{total} students</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openStudentForm()}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </Button>
          {canImportCsv(session.role) && (
            <Button variant="outline" size="sm" onClick={openCsvImport}>
              <FileUp className="h-4 w-4" />
              CSV
            </Button>
          )}
        </div>
      </div>

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
        <div className="space-y-1.5">
          {results.length > RESULT_CAP && (
            <p className="text-xs text-stone-500">
              Showing first {RESULT_CAP} of {results.length} — search to narrow
              down.
            </p>
          )}
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
            {shown.map((s) => {
              const house = houseById(s.houseId);
              return (
                <button
                  key={s.id}
                  onClick={() => openStudent(s.id)}
                  className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-2.5 text-left last:border-0 hover:bg-stone-50"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: house?.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {s.lastName}, {s.firstName}
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
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                </button>
              );
            })}
          </div>
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
