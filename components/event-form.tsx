"use client";

import { useState } from "react";
import { repo } from "@/lib/repo";
import { todayString } from "@/lib/format";
import type { EventTier, SchoolEvent } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function EventForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: SchoolEvent;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? todayString());
  const [tier, setTier] = useState<EventTier>(initial?.tier ?? "minor");
  const [pointsPool, setPointsPool] = useState(
    String(initial?.pointsPool ?? 400)
  );
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Event name is required.");
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
    onDone();
  };

  return (
    <Card className="space-y-3 p-4">
      <p className="font-bold text-stone-900">
        {initial ? "Edit event" : "New event"}
      </p>
      <Input
        placeholder="Event name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-3 gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Select
          value={tier}
          onChange={(e) => setTier(e.target.value as EventTier)}
        >
          <option value="minor">Minor</option>
          <option value="major">Major</option>
        </Select>
        <Input
          type="number"
          min={0}
          placeholder="Points pool"
          value={pointsPool}
          onChange={(e) => setPointsPool(e.target.value)}
        />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit}>
          {initial ? "Save changes" : "Create event"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
