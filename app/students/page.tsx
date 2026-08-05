"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileUp, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useStudentSheet } from "@/components/student-sheet";
import { usePageChrome } from "@/components/page-header";
import { Guard, Screen } from "@/components/guard";
import { canImportCsv, canViewStudents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GradeFilter } from "@/components/grade-filter";
import { HouseFilter } from "@/components/house-filter";
import { AlphabetRail } from "@/components/alphabet-rail";
import type { Student } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StudentListRow } from "@/components/student-row";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";

/** Search results stay capped; browsing shows the whole directory. */
const SEARCH_CAP = 100;

function StudentsScreen() {
  const { session, houseById } = useSession();
  const { openStudent, openAddStudent } = useStudentSheet();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [house, setHouse] = useState<string | null>(
    () => searchParams.get("house")
  );
  const [results, setResults] = useState<Student[] | null>(null);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  const sectionRefs = useRef(new Map<string, HTMLDivElement>());

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
          <button
            onClick={openAddStudent}
            className={buttonVariants({ size: "sm" })}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
        </>
      ),
      [session.role, openAddStudent]
    ),
  });

  // Debounced: no point sorting the full roster on every keystroke. The
  // total only changes when the roster does (version bumps).
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void repo.searchStudents(query, grade ?? undefined).then((r) => {
        if (!cancelled) setResults(r);
      });
    };
    const t = setTimeout(run, query.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, grade, version]);

  useEffect(() => {
    let cancelled = false;
    void repo.listStudents().then((all) => {
      if (!cancelled) setTotal(all.length);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // The add-student sheet can add a row while this list is mounted.
  useEffect(() => {
    const refetch = () => setVersion((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, refetch);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, refetch);
  }, []);

  const filtered = useMemo(
    () => (house ? (results ?? []).filter((s) => s.houseId === house) : results ?? []),
    [results, house]
  );

  const searching = query.trim().length > 0;
  const shown = searching ? filtered.slice(0, SEARCH_CAP) : filtered;

  // Browsing reads as a directory: A/B/C… sections with an index rail.
  // Searching is already narrow, so results stay flat.
  const grouped = useMemo(() => {
    if (searching) return null;
    const out: { letter: string; students: Student[] }[] = [];
    for (const s of shown) {
      const letter = (s.lastName[0] ?? "#").toUpperCase();
      const last = out[out.length - 1];
      if (last?.letter === letter) last.students.push(s);
      else out.push({ letter, students: [s] });
    }
    return out;
  }, [shown, searching]);

  const jumpTo = useCallback((letter: string) => {
    const el = sectionRefs.current.get(letter);
    if (!el) return;
    const offset =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--app-header-h"
        )
      ) || 64;
    // Clear the sticky header AND the filter bar pinned under it.
    const y = el.getBoundingClientRect().top + window.scrollY - offset - 132;
    window.scrollTo({ top: y, behavior: "auto" });
  }, []);

  const renderRow = (s: Student) => {
    const h = houseById(s.houseId);
    return (
      <StudentListRow
        key={s.id}
        color={h?.color}
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
        meta={`Gr. ${s.grade} · #${s.studentNumber} · ${h?.name}`}
        onClick={() => openStudent(s.id)}
      />
    );
  };

  return (
    <>
      {grouped && (
        <AlphabetRail
          letters={grouped.map((g) => g.letter)}
          onJump={jumpTo}
        />
      )}
      <Screen className="space-y-3">
        {/* Search and filters stay put — on a 600-row directory, having to
            scroll back to the top to search was the main complaint. */}
        <div className="sticky top-[var(--app-header-h,4rem)] z-30 -mx-5 space-y-2.5 bg-[var(--background)]/85 px-5 pb-3 pt-2 backdrop-blur-xl">
          <Input
            placeholder="Search name or student number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <GradeFilter value={grade} onChange={setGrade} />
          <HouseFilter value={house} onChange={setHouse} />
        </div>

        {!results ? (
          <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">
            No students match those filters.
          </p>
        ) : (
          <div className="space-y-4">
            {searching && filtered.length > SEARCH_CAP && (
              <p className="text-xs text-stone-500">
                Showing first {SEARCH_CAP} of {filtered.length} — keep typing to
                narrow down.
              </p>
            )}
            {grouped ? (
              grouped.map(({ letter, students }) => (
                <div
                  key={letter}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(letter, el);
                    else sectionRefs.current.delete(letter);
                  }}
                >
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
    </>
  );
}

export default function StudentsPage() {
  return (
    <Guard allow={canViewStudents}>
      <StudentsScreen />
    </Guard>
  );
}
