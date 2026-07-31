"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useStudentSheet } from "@/components/student-sheet";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { canViewReports } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { StudentListRow } from "@/components/student-row";

function UninvolvedScreen() {
  const { houseById } = useSession();
  const { openStudent } = useStudentSheet();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  usePageHeader("Uninvolved students", "/reports");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([repo.uninvolvedStudents(), repo.listStudents()]).then(
      ([uninvolved, all]) => {
        if (cancelled) return;
        setStudents(uninvolved);
        setTotalStudents(all.length);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const byGrade = useMemo(() => {
    if (!students) return [];
    return GRADES.map((grade) => ({
      grade,
      students: students.filter((s) => s.grade === grade),
    })).filter((g) => g.students.length > 0);
  }, [students]);

  return (
    <Screen className="space-y-4" wide>
      <p className="text-sm text-stone-500">
        No check-ins to any event this year — worth a nudge.
      </p>

      {!students ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : students.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-2 font-semibold text-stone-700">
            Everyone has checked in at least once. 🎉
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex items-center justify-between p-4">
            <p className="text-sm text-stone-600">
              <strong className="text-lg tabular-nums text-stone-900">
                {students.length}
              </strong>{" "}
              of {totalStudents} students
            </p>
            <p className="text-sm tabular-nums text-stone-500">
              {Math.round((students.length / Math.max(totalStudents, 1)) * 100)}%
              uninvolved
            </p>
          </Card>

          {byGrade.map(({ grade, students: group }) => (
            <div key={grade}>
              <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-stone-500">
                Grade {grade} · {group.length}
              </h2>
              <Card className="overflow-hidden">
                {group.map((s) => {
                  const house = houseById(s.houseId);
                  return (
                    <StudentListRow
                      key={s.id}
                      color={house?.color}
                      title={`${s.lastName}, ${s.firstName}`}
                      meta={`${house?.name} · #${s.studentNumber}`}
                      onClick={() => openStudent(s.id)}
                    />
                  );
                })}
              </Card>
            </div>
          ))}
        </>
      )}
    </Screen>
  );
}

export default function UninvolvedPage() {
  return (
    <Guard allow={canViewReports}>
      <UninvolvedScreen />
    </Guard>
  );
}
