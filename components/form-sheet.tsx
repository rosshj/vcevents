"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Drawer } from "vaul";
import { FileUp } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { DATA_CHANGED_EVENT } from "@/components/student-sheet";
import { repo } from "@/lib/repo";
import type { CsvImportResult, SchoolEvent } from "@/lib/types";
import { EventForm } from "@/components/event-form";
import { StudentForm } from "@/components/student-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

type SheetState =
  | { kind: "event"; initial?: SchoolEvent }
  | { kind: "student"; checkin: boolean }
  | { kind: "csv" };

interface FormSheetContextValue {
  openEventForm: (initial?: SchoolEvent) => void;
  openStudentForm: (opts?: { checkin?: boolean }) => void;
  openCsvImport: () => void;
}

const FormSheetContext = createContext<FormSheetContextValue | null>(null);

export function useFormSheet(): FormSheetContextValue {
  const ctx = useContext(FormSheetContext);
  if (!ctx) {
    throw new Error("useFormSheet must be used within FormSheetProvider");
  }
  return ctx;
}

function CsvImportForm() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const run = async () => {
    const r = await repo.importStudentsCsv(csv);
    setResult(r);
    if (r.added > 0) {
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
    }
  };

  return (
    <div className="space-y-5">
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
          className="min-h-36 font-mono text-sm"
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
    </div>
  );
}

/**
 * App-wide bottom sheet for the quick create/edit forms — new/edit event,
 * add student (optionally check them in to the operated event), and CSV
 * import — so they slide over the current screen instead of navigating.
 */
export function FormSheetProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [open, setOpen] = useState(false);

  const openWith = useCallback((s: SheetState) => {
    setSheet(s);
    setOpen(true);
  }, []);

  const openEventForm = useCallback(
    (initial?: SchoolEvent) => openWith({ kind: "event", initial }),
    [openWith]
  );
  const openStudentForm = useCallback(
    (opts?: { checkin?: boolean }) =>
      openWith({ kind: "student", checkin: Boolean(opts?.checkin) }),
    [openWith]
  );
  const openCsvImport = useCallback(
    () => openWith({ kind: "csv" }),
    [openWith]
  );

  const saved = () => {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
    setOpen(false);
  };

  const title =
    sheet?.kind === "event"
      ? sheet.initial
        ? "Edit event"
        : "New event"
      : sheet?.kind === "student"
        ? "Add student"
        : "Import students";

  return (
    <FormSheetContext.Provider
      value={{ openEventForm, openStudentForm, openCsvImport }}
    >
      {children}
      <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[2rem] bg-white outline-none"
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-stone-300" />
            <Drawer.Title className="px-5 pb-1 pt-3 text-lg font-bold text-stone-900">
              {title}
            </Drawer.Title>
            <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2">
              {sheet?.kind === "event" && (
                <EventForm initial={sheet.initial} onSaved={saved} />
              )}
              {sheet?.kind === "student" && (
                <StudentForm
                  submitLabel={
                    sheet.checkin && session.activeEventId
                      ? "Add & check in"
                      : "Add student"
                  }
                  onSaved={async (student) => {
                    if (sheet.checkin && session.activeEventId) {
                      await repo.createCheckin({
                        eventId: session.activeEventId,
                        studentId: student.id,
                        method: "manual",
                        operatorId: session.staffId ?? "unknown",
                      });
                    }
                    saved();
                  }}
                />
              )}
              {sheet?.kind === "csv" && <CsvImportForm />}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </FormSheetContext.Provider>
  );
}
