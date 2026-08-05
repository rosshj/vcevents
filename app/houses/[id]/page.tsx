"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Crown, Pencil, Trash2, Trophy } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useHouseSheet } from "@/components/house-sheet";
import { useStudentSheet } from "@/components/student-sheet";
import { Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { useToast } from "@/components/ui/toast";
import { canManageHouses, canViewStudents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { DATA_CHANGED_EVENT, notifyDataChanged } from "@/lib/data-events";
import { formatEventDate } from "@/lib/format";
import { houseTint } from "@/lib/config";
import type { House, SchoolEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";

interface HouseData {
  house: House;
  points: number;
  rank: number;
  members: number;
  schoolSize: number;
  /** Events this house won on turnout, newest first. */
  eventRows: {
    event: SchoolEvent;
    checkins: number;
    won: boolean;
    points: number;
  }[];
}

function HouseDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const { openEditHouse } = useHouseSheet();
  const { openStudent } = useStudentSheet();
  const { toast } = useToast();
  const [data, setData] = useState<HouseData | null>(null);
  const [version, setVersion] = useState(0);
  const [roster, setRoster] = useState<
    { id: string; name: string; grade: number }[]
  >([]);

  const canManage = canManageHouses(session.role);
  // House standings are public; the member roster is staff-only.
  const canSeeRoster = canViewStudents(session.role);
  const headerActions = useMemo(
    () =>
      data && canManage ? (
        <button
          onClick={() => openEditHouse(data.house)}
          aria-label="Edit house"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors hover:bg-stone-200"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : undefined,
    [data, canManage, openEditHouse]
  );
  usePageHeader(data?.house.name ?? "House", "/leaderboard", {
    actions: headerActions,
    subtitle: data
      ? `${data.points.toLocaleString()} points · ${data.members} students`
      : undefined,
  });

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const house = await repo.getHouse(params.id);
      if (!house) {
        router.replace("/leaderboard");
        return;
      }
      const [board, students, events, awards] = await Promise.all([
        repo.leaderboard(),
        repo.listStudents(),
        repo.listEvents(),
        repo.listAwards(),
      ]);
      const members = students.filter((s) => s.houseId === house.id);
      const memberIds = new Set(members.map((s) => s.id));
      const houseOf = new Map(students.map((s) => [s.id, s.houseId]));

      const eventRows = (
        await Promise.all(
          events.map(async (event) => {
            const checkins = await repo.listCheckins(event.id);
            if (checkins.length === 0) return null;
            const counts = new Map<string, number>();
            for (const c of checkins) {
              const hid = houseOf.get(c.studentId);
              if (hid) counts.set(hid, (counts.get(hid) ?? 0) + 1);
            }
            const mine = checkins.filter((c) => memberIds.has(c.studentId)).length;
            const best = Math.max(...counts.values(), 0);
            return {
              event,
              checkins: mine,
              won: mine > 0 && mine === best,
              points: awards
                .filter((a) => a.eventId === event.id && a.houseId === house.id)
                .reduce((sum, a) => sum + a.points, 0),
            };
          })
        )
      )
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => b.event.date.localeCompare(a.event.date));

      if (cancelled) return;
      const row = board.find((r) => r.house.id === house.id);
      setData({
        house,
        points: row?.points ?? 0,
        rank: board.findIndex((r) => r.house.id === house.id) + 1,
        members: members.length,
        schoolSize: students.length,
        eventRows,
      });
      setRoster(
        [...members]
          .sort((a, b) =>
            `${a.lastName} ${a.firstName}`.localeCompare(
              `${b.lastName} ${b.firstName}`
            )
          )
          .slice(0, 8)
          .map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            grade: s.grade,
          }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router, version]);

  if (!data) {
    return (
      <Screen>
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      </Screen>
    );
  }

  const { house, points, rank, members, schoolSize, eventRows } = data;
  const wins = eventRows.filter((r) => r.won).length;
  const deep = `color-mix(in srgb, ${house.color} 80%, black)`;

  const remove = async () => {
    try {
      await repo.deleteHouse(house.id);
      notifyDataChanged();
      toast({ message: `Deleted ${house.name}`, tone: "warning" });
      router.replace("/leaderboard");
    } catch (e) {
      toast({
        message: e instanceof Error ? e.message : "Could not delete the house.",
        tone: "warning",
        duration: 5000,
      });
    }
  };

  return (
    <Screen className="space-y-4">
      <div
        className="rounded-3xl p-5"
        style={{ background: houseTint(house.color, 12) }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black text-white"
            style={{ backgroundColor: house.color }}
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-lg font-extrabold" style={{ color: deep }}>
              {house.name}
              {rank === 1 && points > 0 && (
                <Crown className="h-4 w-4 text-amber-500" />
              )}
            </p>
            <p className="text-xs font-semibold" style={{ color: house.color }}>
              {rank === 1 ? "Leading the school" : `Rank ${rank} of the school`}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums" style={{ color: deep }}>
              {points.toLocaleString()}
            </p>
            <p className="text-xs text-stone-600">points</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums" style={{ color: deep }}>
              {members}
            </p>
            <p className="text-xs text-stone-600">
              students · {schoolSize > 0 ? Math.round((members / schoolSize) * 100) : 0}%
            </p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums" style={{ color: deep }}>
              {wins}
            </p>
            <p className="text-xs text-stone-600">event wins</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          Event history
        </h2>
        {eventRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">
            No events with check-ins yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
            {eventRows.map(({ event, checkins, won, points: pts }) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-0 hover:bg-stone-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {event.name}
                    {won && <span className="ml-1.5">👑</span>}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatEventDate(event.date)} · {checkins} checked in
                  </p>
                </div>
                {pts > 0 && (
                  <Badge variant="green">
                    <Trophy className="mr-1 h-3 w-3" />
                    {pts.toLocaleString()}
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {canSeeRoster && roster.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Members
            </h2>
            <Link
              href={`/students?house=${house.id}`}
              className="text-xs font-semibold text-stone-500 hover:text-stone-800"
            >
              See all {members} →
            </Link>
          </div>
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
            {roster.map((s) => (
              <button
                key={s.id}
                onClick={() => openStudent(s.id)}
                className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-2.5 text-left last:border-0 hover:bg-stone-50"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: house.color }}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900">
                  {s.name}
                </p>
                <span className="shrink-0 text-xs text-stone-500">
                  Gr. {s.grade}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <div className="pt-2">
          <ConfirmButton
            label="Delete house"
            confirmLabel="Tap again to delete"
            icon={<Trash2 className="h-4 w-4" />}
            onConfirm={remove}
          />
          <p className="mt-2 text-center text-xs text-stone-400">
            Only possible once no students or awarded points reference it.
          </p>
        </div>
      )}
    </Screen>
  );
}

export default function HousePage() {
  // Standings are for everyone — this is the page the leaderboard rows
  // finally lead to, students included.
  return <HouseDetail />;
}
