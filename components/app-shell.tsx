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
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { DevWidget } from "@/components/dev-widget";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function navFor(role: Role): NavItem[] {
  switch (role) {
    case "student":
      return [
        { href: "/pass", label: "Pass", icon: QrCode },
        { href: "/points", label: "Points", icon: Sparkles },
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

function initialsOf(name: string): string {
  const words = name
    .replace(/\(.*\)/g, "")
    .split(/[\s.]+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(Mr|Ms|Mrs|Br|Fr|Dr)$/i.test(w));
  const letters = words.map((w) => w[0]?.toUpperCase() ?? "");
  return (letters.length >= 2 ? letters[0] + letters[letters.length - 1] : letters[0] ?? "?")
    .slice(0, 2);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, session, currentStudent, currentStaff, houseById } =
    useSession();
  const pathname = usePathname();

  // The scanner runs full-screen with its own exit affordances.
  const immersive = pathname === "/operate/scan";

  const nav = navFor(session.role);
  const house = currentStudent ? houseById(currentStudent.houseId) : undefined;
  const initials =
    session.role === "student"
      ? currentStudent
        ? initialsOf(`${currentStudent.firstName} ${currentStudent.lastName}`)
        : "?"
      : currentStaff
        ? initialsOf(currentStaff.name)
        : "?";
  const avatarColor =
    session.role === "student" && house ? house.color : "#292524";

  if (immersive) return <>{children}</>;

  // The pass screen paints a full-bleed house gradient; float the header
  // over it so the color runs to the very top.
  const overGradient = pathname === "/pass";

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={cn(
          "z-40",
          overGradient
            ? "absolute inset-x-0 top-0"
            : "sticky top-0 bg-[--background]/70 backdrop-blur-xl"
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-[11px] font-black tracking-tight text-amber-300 shadow-soft">
              VC
            </span>
            <span
              className={cn(
                "text-[15px] font-bold tracking-tight",
                overGradient ? "text-white" : "text-stone-900"
              )}
            >
              {APP_NAME}
            </span>
          </Link>
          <Link
            href="/dev"
            aria-label="Switch role (dev)"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-soft ring-2 ring-white/80 transition-transform hover:scale-105"
            style={{ backgroundColor: avatarColor }}
          >
            {ready ? initials : ""}
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-32">{children}</main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white/70 p-1.5 shadow-float backdrop-blur-xl">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[10px] font-semibold transition-colors",
                  active
                    ? "bg-stone-900 text-white shadow-soft"
                    : "text-stone-500 hover:text-stone-800"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <DevWidget />
    </div>
  );
}
