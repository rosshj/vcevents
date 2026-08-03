"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { useScanner } from "@/components/scanner-sheet";

/** Manual check-in lives in the check-in sheet now — its Search mode. */
export default function ManualRedirect() {
  const { ready, session } = useSession();
  const { expand } = useScanner();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (session.activeEventId) {
      expand("search");
      router.replace(`/events/${session.activeEventId}`);
    } else {
      router.replace("/events");
    }
  }, [ready, session.activeEventId, expand, router]);

  return null;
}
