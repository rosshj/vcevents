"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { repo } from "@/lib/repo";
import { notifyDataChanged } from "@/lib/data-events";
import type { House } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { BOTTOM_SHEET_IDS, BottomSheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * House colors are the app's only saturation — every chart, chip, and
 * fingerprint strip reads from them. These are picked to stay distinct
 * from each other and to clear contrast on white at text weight.
 */
const HOUSE_PALETTE = [
  "#B91C1C",
  "#B45309",
  "#047857",
  "#1D4ED8",
  "#6D28D9",
  "#BE185D",
  "#0F766E",
  "#7C2D12",
] as const;

interface HouseSheetContextValue {
  openNewHouse: () => void;
  openEditHouse: (house: House) => void;
}

const HouseSheetContext = createContext<HouseSheetContextValue | null>(null);

export function useHouseSheet(): HouseSheetContextValue {
  const ctx = useContext(HouseSheetContext);
  if (!ctx) throw new Error("useHouseSheet must be used within HouseSheetProvider");
  return ctx;
}

function HouseForm({
  editing,
  onSaved,
}: {
  editing: House | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? HOUSE_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("A house needs a name.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await repo.updateHouse(editing.id, { name, color });
      } else {
        await repo.createHouse({ name, color });
      }
      notifyDataChanged();
      toast({
        message: editing ? `Saved ${name.trim()}` : `Created ${name.trim()}`,
        tone: "success",
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the house.");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-stone-900">
        {editing ? "Edit house" : "New house"}
      </h2>

      <Field label="Name" htmlFor="house-name">
        <Input
          id="house-name"
          placeholder="e.g. Loyola"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
        />
      </Field>

      <Field label="Color">
        <div
          role="radiogroup"
          aria-label="House color"
          className="flex flex-wrap gap-2.5"
        >
          {HOUSE_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "h-11 w-11 rounded-full transition-transform",
                color === c
                  ? "ring-2 ring-stone-900 ring-offset-2"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>

      <div
        className="flex items-center gap-3 rounded-2xl p-4"
        style={{ background: `color-mix(in srgb, ${color} 10%, white)` }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white"
          style={{ backgroundColor: color }}
        >
          {name.trim().slice(0, 2).toUpperCase() || "??"}
        </span>
        <div className="min-w-0">
          <p
            className="truncate font-extrabold"
            style={{ color: `color-mix(in srgb, ${color} 80%, black)` }}
          >
            {name.trim() || "House name"}
          </p>
          <p className="text-xs text-stone-500">Preview</p>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Button size="lg" className="w-full" onClick={submit} disabled={saving}>
        {editing ? "Save house" : "Create house"}
      </Button>
    </div>
  );
}

/** App-wide sheet for creating and editing houses. */
export function HouseSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<House | null>(null);
  const [openCount, setOpenCount] = useState(0);

  const openNewHouse = useCallback(() => {
    setEditing(null);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);
  const openEditHouse = useCallback((house: House) => {
    setEditing(house);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);

  return (
    <HouseSheetContext.Provider value={{ openNewHouse, openEditHouse }}>
      <BottomSheet
        presented={open}
        onPresentedChange={setOpen}
        componentId={BOTTOM_SHEET_IDS.house}
        title={editing ? "Edit house" : "New house"}
        content={
          <HouseForm
            key={openCount}
            editing={editing}
            onSaved={() => setOpen(false)}
          />
        }
      >
        {children}
      </BottomSheet>
    </HouseSheetContext.Provider>
  );
}
