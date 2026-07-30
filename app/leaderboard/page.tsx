"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { repo } from "@/lib/repo";
import type { LeaderboardRow } from "@/lib/types";
import { Screen } from "@/components/guard";
import { houseTint } from "@/lib/config";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    void repo.leaderboard().then(setRows);
  }, []);

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
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-stone-900">
          House Standings
        </h1>
        <p className="text-sm text-stone-500">Points awarded so far this year</p>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={row.house.id}
            className="relative overflow-hidden rounded-3xl shadow-soft"
            style={{
              background: houseTint(row.house.color, i === 0 ? 16 : 9),
            }}
          >
            <div className="flex items-center gap-4 p-5">
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
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.max((row.points / max) * 100, 2)}%`,
                      backgroundColor: row.house.color,
                    }}
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
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-stone-400">
        Points are awarded by House Directors after each event.
      </p>
    </Screen>
  );
}
