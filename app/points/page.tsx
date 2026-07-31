"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Sparkles, Trophy } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { usePageChrome } from "@/components/page-header";
import { Guard, Screen } from "@/components/guard";
import { repo } from "@/lib/repo";
import { formatEventDate } from "@/lib/format";
import { houseTint } from "@/lib/config";
import type { Checkin, SchoolEvent } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Row {
  checkin: Checkin;
  event: SchoolEvent | null;
}

function MyPoints() {
  const { currentStudent, houseById } = useSession();
  usePageChrome({ title: "My Points" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [housePoints, setHousePoints] = useState<number>(0);

  useEffect(() => {
    if (!currentStudent) return;
    let cancelled = false;
    (async () => {
      const checkins = await repo.listCheckinsByStudent(currentStudent.id);
      const withEvents = await Promise.all(
        checkins.map(async (checkin) => ({
          checkin,
          event: await repo.getEvent(checkin.eventId),
        }))
      );
      const board = await repo.leaderboard();
      if (cancelled) return;
      // Newest event first (check-in list is already newest-first).
      setRows(withEvents);
      setHousePoints(
        board.find((r) => r.house.id === currentStudent.houseId)?.points ?? 0
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStudent]);

  if (!currentStudent) {
    return (
      <Screen>
        <p className="py-10 text-center text-sm text-stone-500">
          Pick a student on the dev page first.
        </p>
      </Screen>
    );
  }

  const house = houseById(currentStudent.houseId);
  const color = house?.color ?? "#292524";

  return (
    <Screen className="space-y-4">
      <div
        className="rounded-3xl p-5 text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, black))` }}
      >
        <div className="flex items-center gap-2 text-sm font-medium opacity-90">
          <Sparkles className="h-4 w-4" />
          Your impact
        </div>
        <p className="mt-2 text-2xl font-black leading-tight">
          You&apos;ve shown up {rows?.length ?? "…"}{" "}
          {rows?.length === 1 ? "time" : "times"} for {house?.name}.
        </p>
        <p className="mt-1 text-sm opacity-90">
          Every check-in counts toward the points your House Director awards.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm backdrop-blur">
          <Trophy className="h-4 w-4" />
          <span className="font-semibold">{house?.name}</span> has{" "}
          <span className="font-black tabular-nums">{housePoints}</span> points
          this year
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
          My check-ins
        </h2>
        {!rows ? (
          <div className="h-40 animate-pulse rounded-2xl bg-stone-200/60" />
        ) : rows.length === 0 ? (
          <Card className="p-6 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-2 font-semibold text-stone-700">
              No check-ins yet
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Show your pass at the next event and it&apos;ll appear here.
            </p>
            <Link
              href="/pass"
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-2"
              style={{ color }}
            >
              Open my pass
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map(({ checkin, event }) => (
              <Card
                key={checkin.id}
                className="flex items-center gap-3 p-3.5"
                style={{ borderLeft: `4px solid ${color}`, background: houseTint(color, 4) }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">
                    {event?.name ?? "(event removed)"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {event ? formatEventDate(event.date) : ""}
                  </p>
                </div>
                {event?.tier === "major" && (
                  <Badge variant="secondary">Major</Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

export default function PointsPage() {
  return (
    <Guard allow={(r) => r === "student"}>
      <MyPoints />
    </Guard>
  );
}
