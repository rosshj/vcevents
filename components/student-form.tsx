"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { repo } from "@/lib/repo";
import { GRADES } from "@/lib/config";
import type { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, Segmented } from "@/components/ui/field";

export function StudentForm({
  submitLabel = "Add student",
  onSaved,
}: {
  submitLabel?: string;
  onSaved: (student: Student) => void | Promise<void>;
}) {
  const { houses } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<string>("7");
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
      const student = await repo.addStudent(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade: Number(grade),
          houseId,
          studentNumber,
        },
        { pending: true }
      );
      await onSaved(student);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add student.");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="student-first">
          {/* No autoFocus: focusing while the sheet animates open makes iOS
              scroll the drawer off-screen to chase the keyboard. */}
          <Input
            id="student-first"
            placeholder="Liam"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="h-12"
          />
        </Field>
        <Field label="Last name" htmlFor="student-last">
          <Input
            id="student-last"
            placeholder="Tremblay"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="h-12"
          />
        </Field>
      </div>

      <Field label="Grade">
        <Segmented
          ariaLabel="Grade"
          value={grade}
          onChange={setGrade}
          options={GRADES.map((g) => ({ value: String(g), label: String(g) }))}
        />
      </Field>

      <Field label="House">
        <Segmented
          ariaLabel="House"
          value={houseId}
          onChange={setHouseId}
          columns={2}
          options={houses.map((h) => ({
            value: h.id,
            label: (
              <>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: h.color }}
                />
                {h.name}
              </>
            ),
          }))}
        />
      </Field>

      <Field
        label="Student number"
        htmlFor="student-number"
        hint="6 digits — matches the ID card barcode."
      >
        <Input
          id="student-number"
          placeholder="412907"
          inputMode="numeric"
          maxLength={6}
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, ""))}
          className="h-12 tabular-nums"
        />
      </Field>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button size="lg" className="w-full" onClick={submit} disabled={saving}>
        {saving ? <Check className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
        {submitLabel}
      </Button>

      <p className="text-center text-xs text-stone-400">
        Manually-added students show as{" "}
        <Badge variant="amber">pending</Badge> until the next roster sync.
      </p>
    </div>
  );
}
