"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { canViewReports } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { Card } from "@/components/ui/card";

function UninvolvedScreen() {
  const { houseById } = useSession();
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                      <th className="px-3 py-2 font-semibold">Student</th>
                      <th className="px-3 py-2 font-semibold">Number</th>
                      <th className="px-3 py-2 font-semibold">House</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((s) => {
                      const house = houseById(s.houseId);
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-stone-100 last:border-0"
                        >
                          <td className="px-3 py-2 font-medium text-stone-900">
                            <Link
                              href={`/students/${s.id}`}
                              className="hover:underline"
                            >
                              {s.lastName}, {s.firstName}
                            </Link>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-stone-600">
                            {s.studentNumber}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-stone-600">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: house?.color }}
                              />
                              {house?.name}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
