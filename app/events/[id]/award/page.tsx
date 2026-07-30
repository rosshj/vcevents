"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Trophy } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { canAwardPoints } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { formatEventDate } from "@/lib/format";
import { houseTint } from "@/lib/config";
import type { SchoolEvent } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function AwardScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, houses } = useSession();
  const [event, setEvent] = useState<SchoolEvent | null>(null);
  const [checkinsByHouse, setCheckinsByHouse] = useState<Record<string, number>>({});
  const [points, setPoints] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await repo.getEvent(params.id);
      if (!e) {
        router.replace("/events");
        return;
      }
      const [checkins, students, awards] = await Promise.all([
        repo.listCheckins(e.id),
        repo.listStudents(),
        repo.listAwards(e.id),
      ]);
      const houseOf = new Map(students.map((s) => [s.id, s.houseId]));
      const counts: Record<string, number> = {};
      for (const c of checkins) {
        const hid = houseOf.get(c.studentId);
        if (hid) counts[hid] = (counts[hid] ?? 0) + 1;
      }
      if (cancelled) return;
      setEvent(e);
      setCheckinsByHouse(counts);
      setPoints(
        Object.fromEntries(
          awards.map((a) => [a.houseId, String(a.points)])
        )
      );
      if (awards[0]) setNote(awards[0].note);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const totalAssigned = useMemo(
    () =>
      Object.values(points).reduce((sum, v) => {
        const n = Number(v);
        return sum + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [points]
  );
  const maxCheckins = Math.max(...houses.map((h) => checkinsByHouse[h.id] ?? 0), 1);

  const save = async () => {
    if (!event) return;
    setError(null);
    if (!note.trim()) {
      setError("A note is required — say why the points landed this way.");
      return;
    }
    const entries = houses.map((h) => {
      const n = Number(points[h.id] ?? 0);
      return { houseId: h.id, points: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
    });
    await repo.awardPoints(
      event.id,
      entries,
      session.staffId ?? "unknown",
      note
    );
    setSaved(true);
    setTimeout(() => router.push("/events"), 900);
  };

  if (!event) {
    return (
      <Screen>
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      </Screen>
    );
  }

  return (
    <Screen className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/events"
          className="rounded-full bg-stone-200 p-2 text-stone-700 hover:bg-stone-300"
          aria-label="Back to events"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold text-stone-900">Award points</h1>
          <p className="truncate text-xs text-stone-500">
            {event.name} · {formatEventDate(event.date)}
          </p>
        </div>
        <Badge variant={event.tier === "major" ? "default" : "secondary"}>
          {event.pointsPool} pt pool
        </Badge>
      </div>

      <Card className="space-y-1 p-4">
        <p className="text-sm text-stone-600">
          Check-ins are the input, not the answer — points are yours to call.
        </p>
      </Card>

      <div className="space-y-2">
        {houses.map((h) => {
          const count = checkinsByHouse[h.id] ?? 0;
          return (
            <div
              key={h.id}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{
                borderColor: `color-mix(in srgb, ${h.color} 35%, white)`,
                background: houseTint(h.color, 6),
              }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="font-bold"
                  style={{ color: `color-mix(in srgb, ${h.color} 80%, black)` }}
                >
                  {h.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / maxCheckins) * 100}%`,
                        backgroundColor: h.color,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-stone-600">
                    {count} in
                  </span>
                </div>
              </div>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={points[h.id] ?? ""}
                onChange={(e) =>
                  setPoints((p) => ({ ...p, [h.id]: e.target.value }))
                }
                className="w-24 text-right text-lg font-bold tabular-nums"
              />
            </div>
          );
        })}
      </div>

      <p
        className={
          totalAssigned > event.pointsPool
            ? "text-sm font-semibold text-amber-700"
            : "text-sm text-stone-500"
        }
      >
        {totalAssigned} of {event.pointsPool} pool points assigned
        {totalAssigned > event.pointsPool && " — over the pool, double-check"}
      </p>

      <div>
        <label className="mb-1 block text-sm font-semibold text-stone-700">
          Note <span className="text-red-600">*</span>
        </label>
        <Textarea
          placeholder="e.g. Loyola ran setup and had the best turnout"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button size="lg" className="w-full" onClick={save} disabled={saved}>
        {saved ? (
          <>
            <Check className="h-5 w-5" /> Saved
          </>
        ) : (
          <>
            <Trophy className="h-5 w-5" /> Save points
          </>
        )}
      </Button>
    </Screen>
  );
}

export default function AwardPage() {
  return (
    <Guard allow={canAwardPoints}>
      <AwardScreen />
    </Guard>
  );
}
