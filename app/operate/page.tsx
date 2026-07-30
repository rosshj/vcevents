"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The old event picker — events are now the hub. */
export default function OperateRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/events");
  }, [router]);
  return null;
}
