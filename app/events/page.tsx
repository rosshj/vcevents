"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Pencil, Trophy } from "lucide-react";
import { Guard, Screen } from "@/components/guard";
import { canManageEvents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { eventTiming, formatEventDate, todayString } from "@/lib/format";
import type { EventTier, SchoolEvent } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface EventRow {
  event: SchoolEvent;
  checkins: number;
  awarded: number;
}

function EventForm({
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

async function fetchEventRows(): Promise<EventRow[]> {
  const events = await repo.listEvents();
  const withMeta = await Promise.all(
    events.map(async (event) => {
      const awards = await repo.listAwards(event.id);
      return {
        event,
        checkins: await repo.countCheckins(event.id),
        awarded: awards.reduce((sum, a) => sum + a.points, 0),
      };
    })
  );
  // Today first, then upcoming soonest-first, then past newest-first.
  const rank = { today: 0, future: 1, past: 2 } as const;
  withMeta.sort((a, b) => {
    const ra = rank[eventTiming(a.event.date)];
    const rb = rank[eventTiming(b.event.date)];
    if (ra !== rb) return ra - rb;
    return ra === 2
      ? b.event.date.localeCompare(a.event.date)
      : a.event.date.localeCompare(b.event.date);
  });
  return withMeta;
}

function EventsScreen() {
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchEventRows().then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setVersion((v) => v + 1);
  };

  return (
    <Screen className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Events</h1>
          <p className="text-sm text-stone-500">
            Create events, then award points after they run.
          </p>
        </div>
        {!creating && !editing && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <CalendarPlus className="h-4 w-4" />
            New
          </Button>
        )}
      </div>

      {creating && <EventForm onDone={closeForm} onCancel={closeForm} />}
      {editing && (
        <EventForm initial={editing} onDone={closeForm} onCancel={closeForm} />
      )}

      {!rows ? (
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      ) : (
        rows.map(({ event, checkins, awarded }) => {
          const timing = eventTiming(event.date);
          return (
            <Card key={event.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">
                    {event.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatEventDate(event.date)}
                    {timing === "today" && (
                      <Badge variant="green" className="ml-1.5">
                        Today
                      </Badge>
                    )}
                  </p>
                </div>
                <Badge variant={event.tier === "major" ? "default" : "secondary"}>
                  {event.tier === "major" ? "Major" : "Minor"}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-stone-600">
                <span className="tabular-nums">
                  <strong>{checkins}</strong> checked in
                </span>
                <span className="tabular-nums">
                  <strong>{awarded}</strong> / {event.pointsPool} pts awarded
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/events/${event.id}/award`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Trophy className="h-4 w-4" />
                  {awarded > 0 ? "Edit points" : "Award points"}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setEditing(event);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </div>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

export default function EventsPage() {
  return (
    <Guard allow={canManageEvents}>
      <EventsScreen />
    </Guard>
  );
}
