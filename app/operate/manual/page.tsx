"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, TriangleAlert, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { useActiveEvent } from "@/components/use-active-event";
import { canAddStudents, canOperate } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RESULT_CAP = 60;

type RowStatus = "created" | "duplicate";

function AddStudentForm({
  onAdded,
}: {
  onAdded: (s: Student) => void;
}) {
  const { houses } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<number>(7);
  const [houseId, setHouseId] = useState(houses[0]?.id ?? "");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!/^\d{6}$/.test(studentNumber)) {
      setError("Student number must be exactly 6 digits.");
      return;
    }
    setSaving(true);
    try {
      const s = await repo.addStudent(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade,
          houseId,
          studentNumber,
        },
        { pending: true }
      );
      onAdded(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add student.");
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-bold text-stone-900">Add a student</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </Select>
        <Select value={houseId} onChange={(e) => setHouseId(e.target.value)}>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
        <Input
          placeholder="6-digit #"
          inputMode="numeric"
          maxLength={6}
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <Button className="w-full" onClick={submit} disabled={saving}>
        <UserPlus className="h-4 w-4" />
        Add & check in
      </Button>
      <p className="text-xs text-stone-500">
        Added students are marked <Badge variant="amber">pending</Badge> until
        reconciled with the official roster.
      </p>
    </Card>
  );
}

function ManualCheckin() {
  const event = useActiveEvent();
  const { session, houseById } = useSession();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [results, setResults] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [showAdd, setShowAdd] = useState(false);

  // Pre-mark rows for students already checked in to this event.
  useEffect(() => {
    if (!event) return;
    void repo.listCheckins(event.id).then((checkins) => {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const c of checkins) next[c.studentId] ??= "duplicate";
        return next;
      });
    });
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    const search =
      !query.trim() && grade === null
        ? Promise.resolve([])
        : repo.searchStudents(query, grade ?? undefined);
    void search.then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query, grade]);

  const shown = useMemo(() => results.slice(0, RESULT_CAP), [results]);

  const checkIn = async (student: Student) => {
    if (!event) return;
    const result = await repo.createCheckin({
      eventId: event.id,
      studentId: student.id,
      method: "manual",
      operatorId: session.staffId ?? "unknown",
    });
    setStatuses((prev) => ({
      ...prev,
      [student.id]: prev[student.id] === "created" ? "created" : result.status,
    }));
  };

  const onAdded = async (s: Student) => {
    setShowAdd(false);
    await checkIn(s);
    setQuery(`${s.firstName} ${s.lastName}`);
    setGrade(null);
  };

  if (!event) return null;

  return (
    <Screen className="space-y-3">
      <div className="flex items-center gap-2">
        <Link
          href="/operate/scan"
          className="rounded-full bg-stone-900/8 p-2.5 text-stone-700 hover:bg-stone-900/15"
          aria-label="Back to scanner"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold text-stone-900">Manual check-in</h1>
          <p className="truncate text-xs text-stone-500">{event.name}</p>
        </div>
        {canAddStudents(session.role) && (
          <Button
            variant={showAdd ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAdd((v) => !v)}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {showAdd && <AddStudentForm onAdded={onAdded} />}

      <Input
        placeholder="Search name or student number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className="h-12 text-base"
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

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">
          {query.trim() || grade !== null
            ? "No students match."
            : "Search by name or number, or pick a grade."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {results.length > RESULT_CAP && (
            <p className="text-xs text-stone-500">
              Showing first {RESULT_CAP} of {results.length} — keep typing to
              narrow down.
            </p>
          )}
          <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          {shown.map((s) => {
            const status = statuses[s.id];
            const house = houseById(s.houseId);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-0"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: house?.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">
                    {s.firstName} {s.lastName}
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
                {status === "created" ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Checked in
                  </span>
                ) : status === "duplicate" ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
                    <TriangleAlert className="h-3.5 w-3.5" /> Already in
                  </span>
                ) : (
                  <Button size="sm" onClick={() => checkIn(s)}>
                    Check in
                  </Button>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </Screen>
  );
}

export default function ManualPage() {
  return (
    <Guard allow={canOperate}>
      <ManualCheckin />
    </Guard>
  );
}
