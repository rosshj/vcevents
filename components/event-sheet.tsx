"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { SchoolEvent } from "@/lib/types";
import { EventForm } from "@/components/event-form";
import { BottomSheet } from "@/components/ui/sheet";
import { DATA_CHANGED_EVENT } from "@/components/student-sheet";

interface EventSheetContextValue {
  /** Opens the "new event" form in a sheet. */
  openNewEvent: () => void;
  /** Opens the edit form in a sheet for the given event. */
  openEditEvent: (event: SchoolEvent) => void;
}

const EventSheetContext = createContext<EventSheetContextValue | null>(null);

export function useEventSheet(): EventSheetContextValue {
  const ctx = useContext(EventSheetContext);
  if (!ctx) {
    throw new Error("useEventSheet must be used within EventSheetProvider");
  }
  return ctx;
}

/**
 * App-wide sheet for creating/editing events — same pattern as the
 * student sheets: open it from wherever you are instead of routing to a
 * form page, and broadcast DATA_CHANGED_EVENT so open screens refetch.
 */
export function EventSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  // Remount the form on every open so it never shows the previous run's
  // values or "Saved" state.
  const [openCount, setOpenCount] = useState(0);

  const openNewEvent = useCallback(() => {
    setEditing(null);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);

  const openEditEvent = useCallback((event: SchoolEvent) => {
    setEditing(event);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);

  return (
    <EventSheetContext.Provider value={{ openNewEvent, openEditEvent }}>
      {children}
      <BottomSheet
        presented={open}
        onPresentedChange={setOpen}
        title={editing ? "Edit event" : "New event"}
        size="tall"
      >
        <h2 className="mb-4 text-2xl font-bold text-stone-900">
          {editing ? "Edit event" : "New event"}
        </h2>
        <EventForm
          key={openCount}
          initial={editing ?? undefined}
          onSaved={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
          }}
        />
      </BottomSheet>
    </EventSheetContext.Provider>
  );
}
