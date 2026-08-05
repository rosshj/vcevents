"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard } from "@/components/guard";
import { useThemeColor } from "@/components/use-theme-color";
import { repo } from "@/lib/repo";
import { currentWindow, encodePassPayload, msLeftInWindow } from "@/lib/qr";
import type { SchoolEvent } from "@/lib/types";

function PassScreen() {
  const { currentStudent, houseById } = useSession();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [windowNo, setWindowNo] = useState(() => currentWindow());
  const [msLeft, setMsLeft] = useState(() => msLeftInWindow());
  const [todaysEvent, setTodaysEvent] = useState<SchoolEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void repo.getTodaysEvent().then((e) => {
      if (!cancelled) setTodaysEvent(e);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick: track seconds remaining and roll the window every 60s.
  useEffect(() => {
    const t = setInterval(() => {
      setMsLeft(msLeftInWindow());
      setWindowNo((prev) => {
        const now = currentWindow();
        return now !== prev ? now : prev;
      });
    }, 250);
    return () => clearInterval(t);
  }, []);

  // Regenerate the QR whenever the student or the time window changes.
  useEffect(() => {
    if (!currentStudent) return;
    let cancelled = false;
    void QRCode.toDataURL(encodePassPayload(currentStudent.id, windowNo), {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [currentStudent, windowNo]);

  const house = currentStudent ? houseById(currentStudent.houseId) : undefined;
  const color = house?.color ?? "#292524";
  useThemeColor(currentStudent ? color : "#ffffff");

  if (!currentStudent) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10 text-center text-sm text-stone-500">
        Pick a student on the dev page to see their pass.
      </div>
    );
  }

  const secondsLeft = Math.ceil(msLeft / 1000);

  return (
    <div
      data-dark-surface
      className="-mb-32 -mt-[calc(env(safe-area-inset-top)+0.5rem)] flex min-h-dvh flex-col items-center px-4 pb-36 pt-[calc(env(safe-area-inset-top)+1.75rem)]"
      // Flat, not a gradient: the canvas (html/body) is painted this same
      // color, so iOS viewport mis-measures at standalone launch can't
      // expose a mismatched seam at the screen edges.
      style={{ backgroundColor: color }}
    >
      <div className="w-full max-w-md text-center text-white">
        <p className="text-sm font-medium uppercase tracking-widest opacity-80">
          {house?.name} House
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {currentStudent.firstName} {currentStudent.lastName}
        </h1>
        <p className="text-sm opacity-80">
          Grade {currentStudent.grade} · #{currentStudent.studentNumber}
        </p>
      </div>

      {/* Flexible middle region: the QR group centers in whatever space is
          left between the name block and the bottom cards. */}
      <div className="flex w-full flex-1 flex-col items-center justify-center py-4">
        <div
          key={windowNo}
          className="animate-pass-refresh w-full rounded-[2.5rem] bg-white p-4 shadow-float"
          // Shrink on short screens so the pass stays one-screen.
          style={{ maxWidth: "min(18rem, 42dvh)" }}
        >
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="Your check-in QR code"
              className="aspect-square w-full"
            />
          ) : (
            <div className="aspect-square w-full animate-pulse rounded-2xl bg-stone-100" />
          )}
        </div>

        <div className="mt-3 w-full max-w-72 px-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300 ease-linear"
              style={{ width: `${(msLeft / 60000) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-xs font-medium text-white/80">
            Code refreshes in {secondsLeft}s
          </p>
        </div>
      </div>

      <div className="w-full max-w-72 space-y-2">
        <div className="flex items-center gap-2.5 rounded-3xl bg-white/15 px-4 py-3 text-white backdrop-blur">
          <CalendarDays className="h-5 w-5 shrink-0 opacity-90" />
          {todaysEvent ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{todaysEvent.name}</p>
              <p className="truncate text-xs opacity-80">
                Today · Show this code at the door
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold">No event today</p>
              <p className="text-xs opacity-80">
                Your pass will be ready when the next one starts
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-white/70">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Works without signal
        </div>
      </div>
    </div>
  );
}

export default function PassPage() {
  return (
    <Guard allow={(r) => r === "student"}>
      <PassScreen />
    </Guard>
  );
}
