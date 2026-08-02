"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { useScanner } from "@/components/scanner-sheet";

/** The scanner is a sheet now — this old route opens it over the event. */
export default function ScanRedirect() {
  const { ready, session } = useSession();
  const { expand } = useScanner();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (session.activeEventId) {
      expand();
      router.replace(`/events/${session.activeEventId}`);
    } else {
      router.replace("/events");
    }
  }, [ready, session.activeEventId, expand, router]);

  return null;
}
