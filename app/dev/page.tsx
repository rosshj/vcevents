"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { repo } from "@/lib/repo";
import { encodePassPayload } from "@/lib/qr";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role, Student } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

const ROLES: Role[] = [
  "house_director",
  "community_teacher",
  "house_executive",
  "student",
];

function StudentPicker({
  value,
  onPick,
  label = "Acting as student",
}: {
  value: string | null;
  onPick: (s: Student) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const { houseById } = useSession();

  useEffect(() => {
    let cancelled = false;
    const lookup = value ? repo.getStudent(value) : Promise.resolve(null);
    void lookup.then((s) => {
      if (!cancelled) setSelected(s);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    const search =
      query.trim().length < 2
        ? Promise.resolve([])
        : repo.searchStudents(query).then((r) => r.slice(0, 6));
    void search.then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const house = selected ? houseById(selected.houseId) : undefined;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      {selected && (
        <div className="flex items-center gap-2 rounded-2xl bg-stone-900/5 px-3.5 py-2.5 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: house?.color }}
          />
          <span className="font-semibold">
            {selected.firstName} {selected.lastName}
          </span>
          <span className="text-stone-500">
            Gr. {selected.grade} · #{selected.studentNumber}
          </span>
        </div>
      )}
      <Input
        placeholder="Search name or student number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          {results.map((s) => (
            <button
              key={s.id}
              className="flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-stone-50"
              onClick={() => {
                onPick(s);
                setQuery("");
                setResults([]);
              }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: houseById(s.houseId)?.color }}
              />
              <span className="font-medium">
                {s.firstName} {s.lastName}
              </span>
              <span className="ml-auto text-xs text-stone-500">
                Gr. {s.grade} · #{s.studentNumber}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardSimulator() {
  const [student, setStudent] = useState<Student | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!student) return;
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, student.studentNumber, {
        format: "CODE128",
        displayValue: true,
        height: 64,
        margin: 8,
        fontSize: 14,
      });
    }
    let cancelled = false;
    void QRCode.toDataURL(encodePassPayload(student.id), {
      width: 240,
      margin: 1,
    }).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [student]);

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="font-bold text-stone-900">ID card simulator</h2>
        <p className="text-sm text-stone-500">
          Pick a student, then point a second device&apos;s scanner at this
          screen — the barcode plays the ID card, the QR plays their phone
          pass.
        </p>
      </div>
      <StudentPicker
        value={student?.id ?? null}
        onPick={setStudent}
        label="Student to render"
      />
      {student && (
        <div className="space-y-4 pt-2">
          <div className="rounded-2xl bg-stone-50 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
              ID card barcode (Code 128)
            </p>
            <svg ref={barcodeRef} className="mx-auto w-full max-w-72" />
          </div>
          {qrUrl && (
            <div className="rounded-2xl bg-stone-50 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                Phone pass QR (current 60s window)
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Student pass QR" className="mx-auto h-48 w-48" />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function DevPage() {
  const {
    ready,
    session,
    staff,
    setRole,
    setStudentId,
    setStaffId,
  } = useSession();
  const [resetting, setResetting] = useState(false);
  usePageHeader("Dev tools", "/");

  const handleReset = useCallback(async () => {
    if (!window.confirm("Reset all data back to the seeded state?")) return;
    setResetting(true);
    await repo.resetData();
    window.location.href = "/";
  }, []);

  if (!ready) return null;

  const staffForRole = staff.filter((s) => s.role === session.role);

  return (
    <Screen className="space-y-4">
      <p className="text-sm text-stone-500">
        Mock auth for the prototype — production replaces this with Google SSO.
      </p>

      <Card className="space-y-3 p-4">
        <h2 className="font-bold text-stone-900">Role</h2>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded-2xl px-3 py-3 text-sm font-semibold transition-colors",
                session.role === r
                  ? "bg-stone-900 text-white shadow-soft"
                  : "bg-stone-900/5 text-stone-700 hover:bg-stone-900/10"
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        {session.role === "student" ? (
          <StudentPicker
            value={session.studentId}
            onPick={(s) => setStudentId(s.id)}
          />
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Operating as
            </p>
            <Select
              value={session.staffId ?? ""}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {staffForRole.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <CardSimulator />

      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <h2 className="font-bold text-stone-900">Reset data</h2>
            <p className="text-sm text-stone-500">
              Rebuilds the seeded houses, students, events, check-ins, and
              point awards. Anything you added is lost.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={handleReset}
          disabled={resetting}
          className="w-full"
        >
          <RefreshCw className={cn("h-4 w-4", resetting && "animate-spin")} />
          {resetting ? "Resetting…" : "Reset all data"}
        </Button>
      </Card>
    </Screen>
  );
}
