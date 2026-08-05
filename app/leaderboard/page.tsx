"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Crown, Plus } from "lucide-react";
import { usePageChrome } from "@/components/page-header";
import { useSession } from "@/components/session-provider";
import { useHouseSheet } from "@/components/house-sheet";
import { repo } from "@/lib/repo";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";
import { canManageHouses } from "@/lib/permissions";
import type { LeaderboardRow } from "@/lib/types";
import { Screen } from "@/components/guard";
import { buttonVariants } from "@/components/ui/button";
import { houseTint } from "@/lib/config";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [version, setVersion] = useState(0);
  const { session } = useSession();
  const { openNewHouse } = useHouseSheet();
  const { role } = session;
  usePageChrome({
    title: "House Standings",
    subtitle: "Points awarded so far this year",
    actions: useMemo(
      () =>
        canManageHouses(role) ? (
          <button
            onClick={openNewHouse}
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="h-4 w-4" />
            House
          </button>
        ) : undefined,
      [role, openNewHouse]
    ),
  });

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(DATA_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void repo.leaderboard().then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (!rows) {
    return (
      <Screen className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-200/60" />
        ))}
      </Screen>
    );
  }

  const max = Math.max(...rows.map((r) => r.points), 1);

  return (
    <Screen className="space-y-4">
      <motion.div
        className="space-y-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        {rows.map((row, i) => (
          <motion.div
            key={row.house.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: {
                opacity: 1,
                y: 0,
                transition: { type: "spring", stiffness: 350, damping: 30 },
              },
            }}
            className="relative overflow-hidden rounded-3xl shadow-soft"
            style={{
              background: houseTint(row.house.color, i === 0 ? 16 : 9),
            }}
          >
            <Link
              href={`/houses/${row.house.id}`}
              className="flex items-center gap-4 p-5 transition-opacity hover:opacity-90"
            >
              <div
                className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-soft"
                style={{ backgroundColor: row.house.color }}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p
                    className="text-lg font-extrabold"
                    style={{ color: `color-mix(in srgb, ${row.house.color} 80%, black)` }}
                  >
                    {row.house.name}
                  </p>
                  {i === 0 && row.points > 0 && (
                    <Crown className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/70">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.max((row.points / max) * 100, 2)}%`,
                    }}
                    transition={{
                      delay: 0.25 + i * 0.07,
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ backgroundColor: row.house.color }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className="text-2xl font-black tabular-nums"
                  style={{ color: `color-mix(in srgb, ${row.house.color} 80%, black)` }}
                >
                  {row.points}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  points
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0"
                style={{ color: row.house.color }}
              />
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <p className="text-xs text-stone-400">
        Tap a house for its event history. Points are awarded by House
        Directors after each event.
      </p>
    </Screen>
  );
}
