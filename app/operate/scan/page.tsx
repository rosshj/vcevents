"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import {
  CameraOff,
  Check,
  Keyboard,
  ListChecks,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Guard } from "@/components/guard";
import { useActiveEvent } from "@/components/use-active-event";
import { canOperate } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { decodePassPayload } from "@/lib/qr";
import type { Student } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Overlay =
  | { kind: "success"; student: Student }
  | { kind: "duplicate"; student: Student }
  | { kind: "unknown"; code: string };

/** Short feedback tones so operators don't have to look at the screen. */
function beep(kind: Overlay["kind"]) {
  try {
    const w = window as Window & { __vcAudio?: AudioContext };
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = (w.__vcAudio ??= new Ctor());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value =
      kind === "success" ? 880 : kind === "duplicate" ? 520 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio is a nicety; never let it break scanning.
  }
}

function ScannerScreen() {
  const event = useActiveEvent();
  const { session, houseById } = useSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "on" | "error">(
    "starting"
  );
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [tally, setTally] = useState<number | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [typedCode, setTypedCode] = useState("");

  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const eventRef = useRef(event);
  const operatorRef = useRef(session.staffId);
  useEffect(() => {
    eventRef.current = event;
    operatorRef.current = session.staffId;
  }, [event, session.staffId]);

  useEffect(() => {
    if (!event) return;
    void repo.countCheckins(event.id).then(setTally);
  }, [event]);

  const showOverlay = useCallback((o: Overlay) => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    setOverlay(o);
    beep(o.kind);
    const ms = o.kind === "success" ? 1500 : o.kind === "duplicate" ? 2000 : 3500;
    overlayTimer.current = setTimeout(() => setOverlay(null), ms);
  }, []);

  const handleCode = useCallback(
    async (text: string) => {
      const ev = eventRef.current;
      if (!ev) return;
      const now = Date.now();
      // The camera re-reads the same code many times a second — debounce it,
      // but let a *different* code through immediately (line speed!).
      if (text === lastScan.current.text && now - lastScan.current.at < 3000) {
        return;
      }
      lastScan.current = { text, at: now };

      let student: Student | null = null;
      let method: "qr" | "id_scan" = "id_scan";
      const pass = decodePassPayload(text);
      if (pass) {
        method = "qr";
        student = await repo.getStudent(pass.sid);
      } else {
        const digits = text.trim();
        if (/^\d{6}$/.test(digits)) {
          student = await repo.findStudentByNumber(digits);
        }
      }

      if (!student) {
        showOverlay({ kind: "unknown", code: text.slice(0, 40) });
        return;
      }

      const result = await repo.createCheckin({
        eventId: ev.id,
        studentId: student.id,
        method,
        operatorId: operatorRef.current ?? "unknown",
      });
      if (result.status === "created") {
        setTally((t) => (t ?? 0) + 1);
        showOverlay({ kind: "success", student });
      } else {
        showOverlay({ kind: "duplicate", student });
      }
    },
    [showOverlay]
  );

  // Camera + continuous decode.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
    });
    let controls: IScannerControls | null = null;
    let cancelled = false;
    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        video,
        (result) => {
          if (result) void handleCode(result.getText());
        }
      )
      .then((c) => {
        if (cancelled) {
          c.stop();
        } else {
          controls = c;
          setCameraState("on");
        }
      })
      .catch(() => {
        if (!cancelled) setCameraState("error");
      });
    return () => {
      cancelled = true;
      controls?.stop();
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, [handleCode]);

  const submitTyped = () => {
    const code = typedCode.trim();
    if (!code) return;
    setTypedCode("");
    void handleCode(code);
  };

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-white">
      {/* Top bar */}
      <div className="z-10 flex items-center gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          onClick={() => router.push("/operate")}
          className="rounded-full bg-white/10 p-2 hover:bg-white/20"
          aria-label="Exit scanner"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{event.name}</p>
          <p className="text-xs text-white/60">Scanning passes & ID cards</p>
        </div>
        <button
          onClick={() => setShowKeyboard((v) => !v)}
          className={cn(
            "rounded-full p-2",
            showKeyboard ? "bg-white text-stone-900" : "bg-white/10 hover:bg-white/20"
          )}
          aria-label="Type a code"
        >
          <Keyboard className="h-5 w-5" />
        </button>
        <Link
          href="/operate/tally"
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-bold tabular-nums hover:bg-white/20"
        >
          <ListChecks className="h-4 w-4" />
          {tally ?? "–"}
        </Link>
      </div>

      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        {cameraState === "on" && !overlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-3xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {cameraState === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            Starting camera…
          </div>
        )}
        {cameraState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <CameraOff className="h-10 w-10 text-white/50" />
            <p className="font-semibold">Camera unavailable</p>
            <p className="text-sm text-white/60">
              Allow camera access, or type a student number below / use manual
              check-in.
            </p>
          </div>
        )}

        {/* Result overlays */}
        {overlay && (
          <ScanOverlay
            overlay={overlay}
            houseColor={
              overlay.kind !== "unknown"
                ? houseById(overlay.student.houseId)?.color
                : undefined
            }
            houseName={
              overlay.kind !== "unknown"
                ? houseById(overlay.student.houseId)?.name
                : undefined
            }
            onDismiss={() => setOverlay(null)}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="z-10 space-y-2 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        {(showKeyboard || cameraState === "error") && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped();
            }}
          >
            <Input
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
              placeholder="Type or wedge-scan a student number…"
              inputMode="numeric"
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            <Button type="submit" variant="secondary">
              <Check className="h-4 w-4" />
            </Button>
          </form>
        )}
        <Link
          href="/operate/manual"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20"
        >
          <Search className="h-4 w-4" />
          Manual check-in
        </Link>
      </div>
    </div>
  );
}

function ScanOverlay({
  overlay,
  houseColor,
  houseName,
  onDismiss,
}: {
  overlay: Overlay;
  houseColor?: string;
  houseName?: string;
  onDismiss: () => void;
}) {
  const router = useRouter();

  if (overlay.kind === "unknown") {
    return (
      <div className="animate-scan-pop absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-700/95 px-8 text-center">
        <TriangleAlert className="h-14 w-14" />
        <p className="text-2xl font-black">Code not recognized</p>
        <p className="break-all text-sm text-white/80">{overlay.code}</p>
        <Button
          variant="secondary"
          size="lg"
          className="mt-2"
          onClick={() => router.push("/operate/manual")}
        >
          <Search className="h-4 w-4" />
          Try manual check-in
        </Button>
        <button className="text-sm text-white/70 underline" onClick={onDismiss}>
          Keep scanning
        </button>
      </div>
    );
  }

  const { student } = overlay;
  const isDup = overlay.kind === "duplicate";
  return (
    <div
      className={cn(
        "animate-scan-pop absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center",
        isDup ? "bg-amber-500/95 text-stone-900" : "bg-emerald-600/95 text-white"
      )}
      onClick={onDismiss}
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full",
          isDup ? "bg-stone-900/10" : "bg-white/20"
        )}
      >
        {isDup ? (
          <TriangleAlert className="h-9 w-9" />
        ) : (
          <Check className="h-10 w-10 stroke-[3]" />
        )}
      </div>
      {isDup && <p className="text-lg font-bold uppercase tracking-wide">Already checked in</p>}
      <p className="text-3xl font-black leading-tight">
        {student.firstName} {student.lastName}
      </p>
      <p className={cn("text-lg font-semibold", isDup ? "text-stone-800" : "text-white/90")}>
        Grade {student.grade}
      </p>
      {houseName && (
        <span
          className="mt-1 rounded-full px-4 py-1.5 text-sm font-bold text-white shadow"
          style={{ backgroundColor: houseColor }}
        >
          {houseName}
        </span>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Guard allow={canOperate}>
      <ScannerScreen />
    </Guard>
  );
}
