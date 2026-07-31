"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function Guard({
  allow,
  children,
}: {
  allow: (role: Role) => boolean;
  children: React.ReactNode;
}) {
  const { ready, session } = useSession();

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <div className="h-32 animate-pulse rounded-2xl bg-stone-200/60" />
      </div>
    );
  }

  if (!allow(session.role)) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <ShieldAlert className="h-8 w-8 text-stone-400" />
          <p className="font-semibold text-stone-900">Not available</p>
          <p className="text-sm text-stone-500">
            Your current role ({ROLE_LABELS[session.role]}) can&apos;t access
            this screen.
          </p>
          <Link
            href="/"
            className={buttonVariants({ variant: "secondary" }) + " mt-2"}
          >
            Go home
          </Link>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function Screen({
  children,
  wide = false,
  className = "",
}: {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`mx-auto w-full ${wide ? "max-w-2xl" : "max-w-md"} px-5 py-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}
