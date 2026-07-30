"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  QrCode,
  ScanLine,
  Sparkles,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { ROLE_LABELS } from "@/lib/permissions";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Active when pathname starts with any of these (defaults to [href]). */
  match?: string[];
}

function navFor(role: Role): NavItem[] {
  switch (role) {
    case "student":
      return [
        { href: "/pass", label: "My Pass", icon: QrCode },
        { href: "/points", label: "My Points", icon: Sparkles },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
      ];
    case "house_director":
      return [
        { href: "/operate", label: "Check-in", icon: ScanLine },
        { href: "/events", label: "Events", icon: CalendarDays },
        { href: "/roster", label: "Roster", icon: Users },
        { href: "/reports/uninvolved", label: "Report", icon: ClipboardList },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
      ];
    default:
      return [
        { href: "/operate", label: "Check-in", icon: ScanLine },
        { href: "/roster", label: "Roster", icon: Users },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
      ];
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, session, currentStudent, currentStaff, houseById } =
    useSession();
  const pathname = usePathname();

  // The scanner runs full-screen with its own exit affordances.
  const immersive = pathname === "/operate/scan";

  const nav = navFor(session.role);
  const identity =
    session.role === "student"
      ? currentStudent
        ? `${currentStudent.firstName} ${currentStudent.lastName}`
        : "No student selected"
      : currentStaff?.name ?? ROLE_LABELS[session.role];
  const house = currentStudent ? houseById(currentStudent.houseId) : undefined;

  if (immersive) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[--background]/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-900 text-xs font-black text-amber-300">
              VC
            </span>
            <span className="text-sm font-bold tracking-tight text-stone-900">
              {APP_NAME}
            </span>
          </Link>
          <Link
            href="/dev"
            className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white py-1 pl-2.5 pr-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            title="Dev: switch role"
          >
            {ready && (
              <>
                {session.role === "student" && house && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: house.color }}
                  />
                )}
                <span className="max-w-32 truncate">{identity}</span>
                <span className="rounded-full bg-stone-100 p-1">
                  <Wrench className="h-3 w-3" />
                </span>
              </>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-stretch justify-around">
          {nav.map((item) => {
            const active = (item.match ?? [item.href]).some(
              (m) => pathname === m || pathname.startsWith(m + "/")
            );
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                  active ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
