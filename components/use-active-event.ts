"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { repo } from "@/lib/repo";
import type { SchoolEvent } from "@/lib/types";

/**
 * The event currently being operated (chosen on /operate).
 * Redirects to the picker when none is selected.
 */
export function useActiveEvent(): SchoolEvent | null {
  const { ready, session } = useSession();
  const router = useRouter();
  const [event, setEvent] = useState<SchoolEvent | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session.activeEventId) {
      router.replace("/operate");
      return;
    }
    let cancelled = false;
    void repo.getEvent(session.activeEventId).then((e) => {
      if (cancelled) return;
      if (!e) {
        router.replace("/operate");
      } else {
        setEvent(e);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, session.activeEventId, router]);

  return event;
}
