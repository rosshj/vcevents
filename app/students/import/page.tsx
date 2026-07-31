"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { canImportCsv } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import type { CsvImportResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

function ImportScreen() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);
  usePageHeader("Import students", "/students", { hideNav: true });

  const run = async () => {
    setResult(await repo.importStudentsCsv(csv));
  };

  return (
    <Screen className="space-y-5">
      <Field
        label="Paste CSV"
        htmlFor="csv"
        hint="One student per line: firstName,lastName,grade,house,studentNumber"
      >
        <Textarea
          id="csv"
          placeholder={"Liam,Tremblay,9,Loyola,412907\nNoah,Chen,10,Xavier,388214"}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setResult(null);
          }}
          className="min-h-40 font-mono text-sm"
          autoFocus
        />
      </Field>

      <Button size="lg" className="w-full" onClick={run} disabled={!csv.trim()}>
        <FileUp className="h-5 w-5" />
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
    </Screen>
  );
}

export default function ImportPage() {
  return (
    <Guard allow={canImportCsv}>
      <ImportScreen />
    </Guard>
  );
}
