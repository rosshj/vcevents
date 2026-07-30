"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { canViewReports } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { Card } from "@/components/ui/card";

interface Row {
  student: Student;
  eventName: string;
}

function OneAndDoneScreen() {
  const { houseById } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [students, events] = await Promise.all([
        repo.listStudents(),
        repo.listEvents(),
      ]);
      const eventName = new Map(events.map((e) => [e.id, e.name]));
      const perStudent = new Map<string, string[]>();
      for (const event of events) {
        for (const c of await repo.listCheckins(event.id)) {
          const list = perStudent.get(c.studentId) ?? [];
          list.push(c.eventId);
          perStudent.set(c.studentId, list);
        }
      }
      const result: Row[] = [];
      for (const s of students) {
        const attended = perStudent.get(s.id);
        if (attended?.length === 1) {
          result.push({
            student: s,
            eventName: eventName.get(attended[0]) ?? "(event removed)",
          });
        }
      }
      result.sort(
        (a, b) =>
          a.student.grade - b.student.grade ||
          `${a.student.lastName} ${a.student.firstName}`.localeCompare(
            `${b.student.lastName} ${b.student.firstName}`
          )
      );
      if (!cancelled) setRows(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byGrade = useMemo(() => {
    if (!rows) return [];
    return GRADES.map((grade) => ({
      grade,
      rows: rows.filter((r) => r.student.grade === grade),
    })).filter((g) => g.rows.length > 0);
  }, [rows]);

  return (
    <Screen className="space-y-4" wide>
      <div className="flex items-center gap-2">
        <Link
          href="/reports"
          className="rounded-full bg-stone-900/8 p-2.5 text-stone-700 hover:bg-stone-900/15"
          aria-label="Back to reports"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-900">One-and-done</h1>
          <p className="text-sm text-stone-500">
            Came to exactly one event and haven&apos;t been back.
          </p>
        </div>
      </div>

      {!rows ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-2 font-semibold text-stone-700">
            Nobody fits this — everyone who came once has come back.
          </p>
        </Card>
      ) : (
        byGrade.map(({ grade, rows: group }) => (
          <div key={grade}>
            <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-stone-500">
              Grade {grade} · {group.length}
            </h2>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-3 py-2 font-semibold">Student</th>
                    <th className="px-3 py-2 font-semibold">House</th>
                    <th className="px-3 py-2 font-semibold">Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(({ student: s, eventName }) => {
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
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-stone-600">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: house?.color }}
                            />
                            {house?.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-stone-600">{eventName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        ))
      )}
    </Screen>
  );
}

export default function OneAndDonePage() {
  return (
    <Guard allow={canViewReports}>
      <OneAndDoneScreen />
    </Guard>
  );
}
