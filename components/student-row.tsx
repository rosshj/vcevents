"use client";

import { ChevronRight } from "lucide-react";

/**
 * The app's standard tappable student row: house dot, name line, meta
 * line. Used by the students list and the report drill-downs so lists
 * read the same everywhere.
 */
export function StudentListRow({
  color,
  title,
  meta,
  onClick,
}: {
  color?: string;
  title: React.ReactNode;
  meta: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-3 text-left last:border-0 hover:bg-stone-50"
    >
      <span
        className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "#d6d3d1" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-stone-900">
          {title}
        </p>
        <p className="truncate text-xs text-stone-500">{meta}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
    </button>
  );
}
