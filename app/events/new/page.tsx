"use client";

import { useRouter } from "next/navigation";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { canManageEvents } from "@/lib/permissions";
import { EventForm } from "@/components/event-form";

function NewEventScreen() {
  const router = useRouter();
  usePageHeader("New event", "/events");
  return (
    <Screen>
      <EventForm onSaved={() => router.push("/events")} />
    </Screen>
  );
}

export default function NewEventPage() {
  return (
    <Guard allow={canManageEvents}>
      <NewEventScreen />
    </Guard>
  );
}
