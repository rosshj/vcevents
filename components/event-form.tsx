"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { repo } from "@/lib/repo";
import { todayString } from "@/lib/format";
import type { EventTier, SchoolEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Segmented } from "@/components/ui/field";

const TIER_META: Record<EventTier, { label: string; hint: string; defaultPool: number }> = {
  minor: { label: "Minor", hint: "Regular event", defaultPool: 400 },
  major: { label: "Major", hint: "Big points day", defaultPool: 1000 },
};

export function EventForm({
  initial,
  onSaved,
}: {
  initial?: SchoolEvent;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? todayString());
  const [tier, setTier] = useState<EventTier>(initial?.tier ?? "minor");
  const [pointsPool, setPointsPool] = useState(
    String(initial?.pointsPool ?? TIER_META.minor.defaultPool)
  );
  const [poolTouched, setPoolTouched] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pickTier = (t: EventTier) => {
    setTier(t);
    // Follow the tier's default pool until the director types their own.
    if (!poolTouched) setPointsPool(String(TIER_META[t].defaultPool));
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give the event a name.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick a date.");
      return;
    }
    const pool = Number(pointsPool);
    if (!Number.isFinite(pool) || pool < 0) {
      setError("Points pool must be a non-negative number.");
      return;
    }
    const payload = { name: name.trim(), date, tier, pointsPool: pool };
    if (initial) {
      await repo.updateEvent(initial.id, payload);
    } else {
      await repo.createEvent(payload);
    }
    setSaved(true);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <Field label="Name" htmlFor="event-name">
        <Input
          id="event-name"
          placeholder="e.g. Terry Fox Run"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!initial}
          className="h-12"
        />
      </Field>

      <Field label="Date" htmlFor="event-date">
        <Input
          id="event-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 appearance-none"
        />
      </Field>

      <Field label="Tier">
        <Segmented
          ariaLabel="Tier"
          value={tier}
          onChange={pickTier}
          options={(Object.keys(TIER_META) as EventTier[]).map((t) => ({
            value: t,
            label: TIER_META[t].label,
            sub: TIER_META[t].hint,
          }))}
        />
      </Field>

      <Field
        label="Points pool"
        htmlFor="event-pool"
        hint="A guide for awarding afterwards — points are still set by hand."
      >
        <Input
          id="event-pool"
          type="number"
          min={0}
          inputMode="numeric"
          value={pointsPool}
          onChange={(e) => {
            setPointsPool(e.target.value);
            setPoolTouched(true);
          }}
          className="h-12 tabular-nums"
        />
      </Field>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button size="lg" className="w-full" onClick={submit} disabled={saved}>
        {saved ? (
          <>
            <Check className="h-5 w-5" /> Saved
          </>
        ) : initial ? (
          "Save changes"
        ) : (
          "Create event"
        )}
      </Button>
    </div>
  );
}
