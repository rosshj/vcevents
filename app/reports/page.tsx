"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, UserX } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { canViewReports } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES, houseTint } from "@/lib/config";
import { eventTiming, formatEventDate } from "@/lib/format";
import type { House, SchoolEvent } from "@/lib/types";
import { Card } from "@/components/ui/card";

interface ReportData {
  totalStudents: number;
  participated: number;
  oneAndDone: number;
  byGrade: { grade: number; total: number; participated: number }[];
  byHouse: { house: House; total: number; participated: number }[];
  pastEvents: { event: SchoolEvent; count: number }[];
}

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function RateRow({
  label,
  labelColor,
  barColor,
  tint,
  participated,
  total,
}: {
  label: string;
  labelColor?: string;
  barColor: string;
  tint?: string;
  participated: number;
  total: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
      style={{ background: tint ?? "#fafaf9" }}
    >
      <span
        className="w-20 shrink-0 text-sm font-bold"
        style={{ color: labelColor ?? "#44403c" }}
      >
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/90">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct(participated, total)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-stone-700">
        {pct(participated, total)}%
      </span>
    </div>
  );
}

function ReportsScreen() {
  const { houses } = useSession();
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [students, events] = await Promise.all([
        repo.listStudents(),
        repo.listEvents(),
      ]);
      const perEvent = await Promise.all(
        events.map(async (event) => ({
          event,
          checkins: await repo.listCheckins(event.id),
        }))
      );
      const countByStudent = new Map<string, number>();
      for (const { checkins } of perEvent) {
        for (const c of checkins) {
          countByStudent.set(c.studentId, (countByStudent.get(c.studentId) ?? 0) + 1);
        }
      }
      const participatedIds = new Set(countByStudent.keys());
      const byGrade = GRADES.map((grade) => {
        const group = students.filter((s) => s.grade === grade);
        return {
          grade,
          total: group.length,
          participated: group.filter((s) => participatedIds.has(s.id)).length,
        };
      });
      const byHouse = houses.map((house) => {
        const group = students.filter((s) => s.houseId === house.id);
        return {
          house,
          total: group.length,
          participated: group.filter((s) => participatedIds.has(s.id)).length,
        };
      });
      const pastEvents = perEvent
        .filter(({ event }) => eventTiming(event.date) !== "future")
        .sort((a, b) => b.event.date.localeCompare(a.event.date))
        .map(({ event, checkins }) => ({ event, count: checkins.length }));
      if (cancelled) return;
      setData({
        totalStudents: students.length,
        participated: participatedIds.size,
        oneAndDone: [...countByStudent.values()].filter((n) => n === 1).length,
        byGrade,
        byHouse,
        pastEvents,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [houses]);

  if (!data) {
    return (
      <Screen>
        <div className="h-64 animate-pulse rounded-2xl bg-stone-200/60" />
      </Screen>
    );
  }

  const uninvolved = data.totalStudents - data.participated;

  return (
    <Screen className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-stone-900">Reports</h1>
        <p className="text-sm text-stone-500">
          Participation this year — points stay human-decided.
        </p>
      </div>

      <Card className="p-5">
        <p className="text-4xl font-black tabular-nums text-stone-900">
          {pct(data.participated, data.totalStudents)}%
        </p>
        <p className="mt-1 text-sm text-stone-600">
          of students have checked in to at least one event (
          {data.participated} of {data.totalStudents})
        </p>
      </Card>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Participation by grade
        </h2>
        <div className="space-y-1.5">
          {data.byGrade.map((g) => (
            <RateRow
              key={g.grade}
              label={`Grade ${g.grade}`}
              barColor="#292524"
              participated={g.participated}
              total={g.total}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Participation by house
        </h2>
        <div className="space-y-1.5">
          {data.byHouse.map((h) => (
            <RateRow
              key={h.house.id}
              label={h.house.name}
              labelColor={`color-mix(in srgb, ${h.house.color} 80%, black)`}
              barColor={h.house.color}
              tint={houseTint(h.house.color, 8)}
              participated={h.participated}
              total={h.total}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Event attendance
        </h2>
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          {data.pastEvents.map(({ event, count }) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center gap-3 border-b border-stone-100 px-4 py-2.5 last:border-0 hover:bg-stone-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {event.name}
                </p>
                <p className="text-xs text-stone-500">
                  {formatEventDate(event.date)}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-stone-700">
                {count}
              </span>
              <span className="text-xs text-stone-400">
                ({pct(count, data.totalStudents)}%)
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Worth a nudge
        </h2>
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          <Link
            href="/reports/uninvolved"
            className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 hover:bg-stone-50"
          >
            <UserX className="h-5 w-5 shrink-0 text-stone-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900">
                Uninvolved students
              </p>
              <p className="text-xs text-stone-500">No check-ins this year</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-stone-700">
              {uninvolved}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
          </Link>
          <Link
            href="/reports/one-and-done"
            className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50"
          >
            <ClipboardList className="h-5 w-5 shrink-0 text-stone-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900">
                One-and-done students
              </p>
              <p className="text-xs text-stone-500">
                Came once, haven&apos;t returned
              </p>
            </div>
            <span className="text-sm font-bold tabular-nums text-stone-700">
              {data.oneAndDone}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
          </Link>
        </div>
      </div>
    </Screen>
  );
}

export default function ReportsPage() {
  return (
    <Guard allow={canViewReports}>
      <ReportsScreen />
    </Guard>
  );
}
