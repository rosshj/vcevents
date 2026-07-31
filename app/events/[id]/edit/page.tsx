"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { canManageEvents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import type { SchoolEvent } from "@/lib/types";
import { EventForm } from "@/components/event-form";

function EditEventScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<SchoolEvent | null>(null);
  usePageHeader("Edit event", `/events/${params.id}`, { hideNav: true });

  useEffect(() => {
    let cancelled = false;
    void repo.getEvent(params.id).then((e) => {
      if (cancelled) return;
      if (!e) {
        router.replace("/events");
      } else {
        setEvent(e);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  if (!event) {
    return (
      <Screen>
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
      </Screen>
    );
  }

  return (
    <Screen>
      <EventForm
        initial={event}
        onSaved={() => router.push(`/events/${event.id}`)}
      />
    </Screen>
  );
}

export default function EditEventPage() {
  return (
    <Guard allow={canManageEvents}>
      <EditEventScreen />
    </Guard>
  );
}
