"use client";

import { useEffect, useState } from "react";
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
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/components/session-provider";
import { repo } from "@/lib/repo";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Role, SchoolEvent } from "@/lib/types";

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
        { href: "/events", label: "Events", icon: CalendarDays },
        { href: "/students", label: "Students", icon: Users },
        { href: "/reports", label: "Reports", icon: ClipboardList },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
      ];
    default:
      return [
        { href: "/events", label: "Events", icon: CalendarDays },
        { href: "/students", label: "Students", icon: Users },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
      ];
  }
}

/** "You're operating X" — one tap back to the scanner from anywhere. */
function OperatingPill() {
  const { ready, session, setActiveEventId } = useSession();
  const [event, setEvent] = useState<SchoolEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const lookup =
      !ready || !session.activeEventId || session.role === "student"
        ? Promise.resolve(null)
        : repo.getEvent(session.activeEventId);
    void lookup.then((e) => {
      if (!cancelled) setEvent(e);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, session.activeEventId, session.role]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.9rem)] z-40 flex justify-center px-4 transition-transform duration-300"
      style={{ transform: "translateY(var(--vv-gap))" }}
    >
      <AnimatePresence>
        {event && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: 14,
              scale: 0.95,
              transition: { duration: 0.15 },
            }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-stone-900 py-1 pl-3 pr-1 text-white shadow-float"
          >
            <Link
              href="/operate/scan"
              className="flex min-w-0 items-center gap-2 py-1 text-xs font-semibold"
            >
              <ScanLine className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Scanning · {event.name}</span>
            </Link>
            <button
              onClick={() => setActiveEventId(null)}
              aria-label="Stop operating this event"
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

  // Standalone launch quirk: iOS sizes the layout viewport too short until
  // the first scroll gesture, so fixed bottom-anchored elements float too
  // high. Measure the true height via VisualViewport, publish the gap as
  // --vv-gap (nav + pill translate down by it), and keep it updated until
  // iOS corrects itself.
  useEffect(() => {
    if (!window.matchMedia("(display-mode: standalone)").matches) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const gap = Math.max(0, Math.round(vv.height - root.clientHeight));
      root.style.setProperty("--vv-gap", `${gap}px`);
    };
    apply();
    // Some launches settle late; re-check a few times, then track events.
    const timers = [250, 600, 1200].map((ms) => setTimeout(apply, ms));
    vv.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    return () => {
      timers.forEach(clearTimeout);
      vv.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--vv-gap");
    };
  }, []);

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
          "z-40 pt-[env(safe-area-inset-top)]",
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

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 flex justify-center px-4 transition-transform duration-300"
        style={{ transform: "translateY(var(--vv-gap))" }}
      >
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
                  "relative flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[10px] font-semibold transition-colors duration-200",
                  active ? "text-white" : "text-stone-500 hover:text-stone-800"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-full bg-stone-900 shadow-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon
                  className={cn("relative z-10 h-5 w-5", active && "stroke-[2.25]")}
                />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <OperatingPill />
    </div>
  );
}
