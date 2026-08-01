"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  CircleUserRound,
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
import {
  PageHeaderContext,
  type PageHeader,
} from "@/components/page-header";
import { repo } from "@/lib/repo";
import { cn } from "@/lib/utils";
import type { Role, SchoolEvent } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ME_ITEM: NavItem = { href: "/dev", label: "Me", icon: CircleUserRound };

function navFor(role: Role): NavItem[] {
  switch (role) {
    case "student":
      return [
        { href: "/pass", label: "Pass", icon: QrCode },
        { href: "/points", label: "Points", icon: Sparkles },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
        ME_ITEM,
      ];
    case "house_director":
      return [
        { href: "/events", label: "Events", icon: CalendarDays },
        { href: "/students", label: "Students", icon: Users },
        { href: "/reports", label: "Reports", icon: ClipboardList },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
        ME_ITEM,
      ];
    default:
      return [
        { href: "/events", label: "Events", icon: CalendarDays },
        { href: "/students", label: "Students", icon: Users },
        { href: "/leaderboard", label: "Houses", icon: Trophy },
        ME_ITEM,
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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.9rem)] z-40 flex justify-center px-4">
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const pathname = usePathname();
  const [pageHeader, setPageHeader] = useState<PageHeader | null>(null);
  const headerCtx = useMemo(() => ({ set: setPageHeader }), []);

  // Standalone launch quirk: iOS sizes the layout viewport too short until
  // the first scroll gesture. The page often isn't scrollable at rest, so a
  // plain scrollTo is a no-op — make it scrollable for one invisible frame,
  // nudge, and restore. Runs twice in case the first fires too early.
  useEffect(() => {
    if (!window.matchMedia("(display-mode: standalone)").matches) return;
    const nudge = () => {
      const body = document.body;
      const prevMinHeight = body.style.minHeight;
      body.style.minHeight = "calc(100vh + 2px)";
      window.scrollTo(0, 1);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        body.style.minHeight = prevMinHeight;
      });
    };
    nudge();
    const t = setTimeout(nudge, 400);
    return () => clearTimeout(t);
  }, []);

  // The scanner runs full-screen with its own exit affordances.
  const immersive = pathname === "/operate/scan";

  const nav = navFor(session.role);

  if (immersive) {
    return (
      <PageHeaderContext.Provider value={headerCtx}>
        {children}
      </PageHeaderContext.Provider>
    );
  }

  return (
    <PageHeaderContext.Provider value={headerCtx}>
    <div className="flex min-h-dvh flex-col">
      {/* Sticky frosted header: root tabs show title/subtitle/actions,
          drill-in sub-pages show back + compact title. Screens that never
          register chrome (the pass) stay headerless. */}
      {pageHeader && (
        <header className="sticky top-0 z-40 bg-[--background]/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          {pageHeader.backHref ? (
            <div className="mx-auto flex h-14 w-full max-w-md items-center gap-1 px-5">
              <Link
                href={pageHeader.backHref}
                aria-label="Back"
                className="-ml-2.5 rounded-full p-2 text-stone-700 hover:bg-stone-900/8"
              >
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <h1 className="min-w-0 truncate text-[17px] font-bold text-stone-900">
                {pageHeader.title}
              </h1>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 pb-3 pt-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black tracking-tight text-stone-900">
                  {pageHeader.title}
                </h1>
                {pageHeader.subtitle && (
                  <p className="mt-0.5 truncate text-sm text-stone-500">
                    {pageHeader.subtitle}
                  </p>
                )}
              </div>
              {pageHeader.actions && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {pageHeader.actions}
                </div>
              )}
            </div>
          )}
        </header>
      )}

      <main
        className={cn(
          "flex-1 pb-32",
          !pageHeader && "pt-[calc(env(safe-area-inset-top)+0.5rem)]"
        )}
      >
        {children}
      </main>

      {!pageHeader?.hideNav && (
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
      )}

      {/* Only on root tabs — focused sub-pages (forms, drill-ins) keep a
          clean stage; the back button already anchors navigation there. */}
      {!pageHeader?.backHref && <OperatingPill />}
    </div>
    </PageHeaderContext.Provider>
  );
}
