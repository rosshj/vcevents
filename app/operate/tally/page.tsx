"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Keyboard, QrCode, ScanBarcode, Undo2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { useActiveEvent } from "@/components/use-active-event";
import { canOperate, canUndoCheckin } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { formatTime } from "@/lib/format";
import type { Checkin, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { houseTint } from "@/lib/config";

const METHOD_META = {
  qr: { label: "QR pass", Icon: QrCode },
  id_scan: { label: "ID card", Icon: ScanBarcode },
  manual: { label: "Manual", Icon: Keyboard },
} as const;

interface Row {
  checkin: Checkin;
  student: Student | null;
}

function TallyScreen() {
  const event = useActiveEvent();
  const { session, houses, houseById } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    void (async () => {
      const checkins = await repo.listCheckins(event.id);
      const withStudents = await Promise.all(
        checkins.map(async (checkin) => ({
          checkin,
          student: await repo.getStudent(checkin.studentId),
        }))
      );
      if (!cancelled) setRows(withStudents);
    })();
    return () => {
      cancelled = true;
    };
  }, [event, version]);

  const undo = async (checkinId: string) => {
    await repo.undoCheckin(checkinId);
    setVersion((v) => v + 1);
  };

  if (!event) return null;

  const byHouse = houses.map((h) => ({
    house: h,
    count: rows?.filter((r) => r.student?.houseId === h.id).length ?? 0,
  }));

  return (
    <Screen className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/operate/scan"
          className="rounded-full bg-stone-900/8 p-2.5 text-stone-700 hover:bg-stone-900/15"
          aria-label="Back to scanner"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold text-stone-900">Live tally</h1>
          <p className="truncate text-xs text-stone-500">{event.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums text-stone-900">
            {rows?.length ?? "–"}
          </p>
          <p className="-mt-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            checked in
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {byHouse.map(({ house, count }) => (
          <div
            key={house.id}
            className="rounded-2xl p-2.5 text-center shadow-soft"
            style={{
              background: houseTint(house.color, 11),
            }}
          >
            <p
              className="text-lg font-black tabular-nums"
              style={{ color: `color-mix(in srgb, ${house.color} 80%, black)` }}
            >
              {count}
            </p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-stone-600">
              {house.name}
            </p>
          </div>
        ))}
      </div>

      {!rows ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">
          No check-ins yet — they&apos;ll appear here as you scan.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          {rows.map(({ checkin, student }) => {
            const house = student ? houseById(student.houseId) : undefined;
            const method = METHOD_META[checkin.method];
            return (
              <div
                key={checkin.id}
                className="flex items-center gap-3 border-b border-stone-100 px-4 py-2 last:border-0"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: house?.color ?? "#d6d3d1" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {student
                      ? `${student.firstName} ${student.lastName}`
                      : "(student removed)"}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-stone-500">
                    <method.Icon className="h-3 w-3" />
                    {method.label} · {formatTime(checkin.createdAt)}
                    {student && <> · Gr. {student.grade}</>}
                  </p>
                </div>
                {canUndoCheckin(session.role) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => undo(checkin.id)}
                    aria-label="Undo check-in"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

export default function TallyPage() {
  return (
    <Guard allow={canOperate}>
      <TallyScreen />
    </Guard>
  );
}
