"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";

/** Landing: route to the role's home screen. */
export default function Home() {
  const { ready, session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(session.role === "student" ? "/pass" : "/operate");
  }, [ready, session.role, router]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="h-32 animate-pulse rounded-2xl bg-stone-200/60" />
    </div>
  );
}
