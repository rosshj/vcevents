"use client";

import { useCallback, useEffect, useState } from "react";
import { FileUp, UserPlus, X } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { canImportCsv, canViewRoster } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { CsvImportResult, Student } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RESULT_CAP = 100;

function AddStudentCard({ onDone }: { onDone: () => void }) {
  const { houses } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<number>(7);
  const [houseId, setHouseId] = useState(houses[0]?.id ?? "");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    try {
      await repo.addStudent(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade,
          houseId,
          studentNumber,
        },
        { pending: true }
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add student.");
    }
  };

  return (
    <Card className="space-y-3 border-stone-300 bg-stone-50 p-4">
      <p className="font-bold text-stone-900">Add a student</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoFocus
        />
        <Input
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
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
      <Button className="w-full" onClick={submit}>
        <UserPlus className="h-4 w-4" />
        Add student
      </Button>
      <p className="text-xs text-stone-500">
        Manually-added students show as{" "}
        <Badge variant="amber">pending</Badge> until the next roster sync.
      </p>
    </Card>
  );
}

function CsvImportCard({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const run = async () => {
    const r = await repo.importStudentsCsv(csv);
    setResult(r);
    if (r.added > 0) onDone();
  };

  return (
    <Card className="space-y-3 border-stone-300 bg-stone-50 p-4">
      <div>
        <p className="font-bold text-stone-900">Import CSV</p>
        <p className="text-xs text-stone-500">
          One student per line:{" "}
          <code className="rounded bg-stone-200 px-1 font-mono text-[11px]">
            firstName,lastName,grade,house,studentNumber
          </code>
        </p>
      </div>
      <Textarea
        placeholder={"Liam,Tremblay,9,Loyola,412907\nNoah,Chen,10,Xavier,388214"}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setResult(null);
        }}
        className="min-h-28 font-mono text-sm"
      />
      <Button className="w-full" onClick={run} disabled={!csv.trim()}>
        <FileUp className="h-4 w-4" />
        Import
      </Button>
      {result && (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-emerald-700">
            Imported {result.added} student{result.added === 1 ? "" : "s"}.
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-red-600">
              {e}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function RosterScreen() {
  const { session, houseById } = useSession();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [results, setResults] = useState<Student[] | null>(null);
  const [total, setTotal] = useState(0);
  const [panel, setPanel] = useState<"add" | "csv" | null>(null);

  const load = useCallback(async () => {
    const [r, all] = await Promise.all([
      repo.searchStudents(query, grade ?? undefined),
      repo.listStudents(),
    ]);
    setResults(r);
    setTotal(all.length);
  }, [query, grade]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = results?.slice(0, RESULT_CAP) ?? [];

  return (
    <Screen className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Roster</h1>
          <p className="text-sm text-stone-500">{total} students</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={panel === "add" ? "secondary" : "outline"}
            onClick={() => setPanel(panel === "add" ? null : "add")}
          >
            {panel === "add" ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            Add
          </Button>
          {canImportCsv(session.role) && (
            <Button
              size="sm"
              variant={panel === "csv" ? "secondary" : "outline"}
              onClick={() => setPanel(panel === "csv" ? null : "csv")}
            >
              {panel === "csv" ? <X className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
              CSV
            </Button>
          )}
        </div>
      </div>

      {panel === "add" && (
        <AddStudentCard
          onDone={() => {
            setPanel(null);
            void load();
          }}
        />
      )}
      {panel === "csv" && <CsvImportCard onDone={() => void load()} />}

      <Input
        placeholder="Search name or student number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setGrade(null)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold",
            grade === null
              ? "bg-stone-900 text-white"
              : "bg-stone-200 text-stone-600 hover:bg-stone-300"
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
                ? "bg-stone-900 text-white"
                : "bg-stone-200 text-stone-600 hover:bg-stone-300"
            )}
          >
            Gr. {g}
          </button>
        ))}
      </div>

      {!results ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : (
        <div className="space-y-1.5">
          {results.length > RESULT_CAP && (
            <p className="text-xs text-stone-500">
              Showing first {RESULT_CAP} of {results.length} — search to narrow
              down.
            </p>
          )}
          {shown.map((s) => {
            const house = houseById(s.houseId);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: house?.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {s.lastName}, {s.firstName}
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
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

export default function RosterPage() {
  return (
    <Guard allow={canViewRoster}>
      <RosterScreen />
    </Guard>
  );
}
