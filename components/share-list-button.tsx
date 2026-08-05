"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { Student } from "@/lib/types";
import type { House } from "@/lib/types";

/**
 * Nudge lists are only useful if they can leave the app — a homeroom
 * teacher needs the names, not a screenshot. Uses the native share sheet
 * where it exists (iOS, Android) and falls back to the clipboard.
 */
export function ShareListButton({
  title,
  students,
  houseById,
  note,
}: {
  title: string;
  students: Student[];
  houseById: (id: string) => House | undefined;
  /** Extra line under the title, e.g. what the list means. */
  note?: string;
}) {
  const { toast } = useToast();
  const [done, setDone] = useState(false);

  const build = () => {
    const lines = [...students]
      .sort((a, b) =>
        a.grade - b.grade ||
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        )
      )
      .map(
        (s) =>
          `Gr ${s.grade}\t${s.lastName}, ${s.firstName}\t#${s.studentNumber}\t${
            houseById(s.houseId)?.name ?? ""
          }`
      );
    return [title, note, "", ...lines].filter(Boolean).join("\n");
  };

  const share = async () => {
    const text = build();
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
      toast({
        message: `Copied ${students.length} names to the clipboard`,
        tone: "success",
      });
    } catch {
      // A cancelled share sheet is not an error worth reporting.
    }
  };

  if (students.length === 0) return null;

  return (
    <button
      onClick={share}
      className="flex h-9 items-center gap-1.5 rounded-full bg-stone-100 px-3.5 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-200"
    >
      {done ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {done ? "Copied" : "Share list"}
    </button>
  );
}
