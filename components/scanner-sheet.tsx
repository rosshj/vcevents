"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import {
  CameraOff,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { DATA_CHANGED_EVENT } from "@/components/student-sheet";
import { useThemeColor } from "@/components/use-theme-color";
import { canOperate } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { decodePassPayload } from "@/lib/qr";
import type { SchoolEvent, Student } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The scanner is a sheet. Expanded, it's the full-screen camera; swiped
 * down (or minimized), the same dark surface tucks into a mini-bar docked
 * above the tab bar — swipe the bar up to bring it back. The operating
 * session stays live in both states.
 *
 * The dark surface is ONE persistent element that `layout`-animates
 * between the two geometries, so the grow/shrink morph is guaranteed in
 * both directions. Content never lives inside it — the sheet and bar
 * contents are sibling layers that crossfade above it, so nothing
 * stretches mid-morph. A shared wrapper carries the drag gesture, which
 * is how the whole surface follows the finger.
 */

/** Geometry of the docked bar — the surface and its content layer share it. */
const BAR_GEOM =
  "left-4 right-4 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.6rem)] mx-auto h-14 max-w-md";

interface ScannerContextValue {
  expanded: boolean;
  expand: () => void;
  collapse: () => void;
}

const ScannerContext = createContext<ScannerContextValue | null>(null);

export function useScanner(): ScannerContextValue {
  const ctx = useContext(ScannerContext);
  if (!ctx) throw new Error("useScanner must be used within ScannerProvider");
  return ctx;
}

export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);
  const value = useMemo(
    () => ({ expanded, expand, collapse }),
    [expanded, expand, collapse]
  );
  return (
    <ScannerContext.Provider value={value}>{children}</ScannerContext.Provider>
  );
}

type Overlay =
  | { kind: "success"; student: Student }
  | { kind: "duplicate"; student: Student }
  | { kind: "unknown"; code: string };

interface LastCheckin {
  student: Student;
  at: number;
  eventId: string;
}

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

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function relTime(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  return `${Math.floor(s / 60)}m ago`;
}

export function ScannerSheet({ showBar }: { showBar: boolean }) {
  const { expanded, expand, collapse } = useScanner();
  const { ready, session, setActiveEventId } = useSession();
  // The operated event plus when this operating session started (for the
  // "elapsed" stat) — one value so they can never disagree.
  const [activeOp, setActiveOp] = useState<{
    event: SchoolEvent;
    startedAt: number;
  } | null>(null);
  // Keyed to their event so counts never carry over to the next one.
  const [tallyState, setTallyState] = useState<{
    eventId: string;
    count: number;
  } | null>(null);
  const [schoolSize, setSchoolSize] = useState<number | null>(null);
  const [lastCheckin, setLastCheckin] = useState<LastCheckin | null>(null);

  // Resolve the operated event; clears when operating stops, the event is
  // deleted, or the role loses operating rights.
  useEffect(() => {
    let cancelled = false;
    const lookup =
      !ready || !session.activeEventId || !canOperate(session.role)
        ? Promise.resolve(null)
        : repo.getEvent(session.activeEventId);
    void lookup.then((e) => {
      if (cancelled) return;
      const at = Date.now();
      setActiveOp((prev) => {
        if (!e) return null;
        // Same event re-resolved (e.g. after an edit): keep the clock.
        if (prev && prev.event.id === e.id)
          return { event: e, startedAt: prev.startedAt };
        return { event: e, startedAt: at };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, session.activeEventId, session.role]);

  const event = activeOp?.event ?? null;

  // One live count shared by the sheet and the mini-bar. Check-ins made
  // elsewhere (student sheet, manual page) announce themselves via
  // DATA_CHANGED_EVENT; camera scans bump it directly.
  useEffect(() => {
    if (!event) return;
    const refresh = () => {
      void repo
        .countCheckins(event.id)
        .then((count) => setTallyState({ eventId: event.id, count }));
      void repo.listStudents().then((all) => setSchoolSize(all.length));
    };
    refresh();
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, refresh);
  }, [event]);

  const tally =
    event && tallyState?.eventId === event.id ? tallyState.count : null;
  const last =
    event && lastCheckin?.eventId === event.id ? lastCheckin : null;

  const eventId = event?.id ?? null;
  const onCheckin = useCallback(
    (student: Student) => {
      setTallyState((s) => (s ? { ...s, count: s.count + 1 } : s));
      if (eventId) setLastCheckin({ student, at: Date.now(), eventId });
    },
    [eventId]
  );

  const stop = () => {
    setActiveEventId(null);
    collapse();
  };

  const visible = Boolean(event) && (expanded || showBar);

  return (
    <>
      {/* Outside AnimatePresence on purpose: the browser chrome / page
          canvas flips back to light the moment collapse starts, not after
          the exit animation — otherwise the page sits on a black canvas
          while the sheet is still fading out. */}
      {event && expanded && <ScannerThemeColor />}
      <AnimatePresence>
        {visible && event && (
          <ScannerSurface
            key="scanner"
            event={event}
            expanded={expanded}
            tally={tally}
            schoolSize={schoolSize}
            startedAt={activeOp?.startedAt ?? null}
            lastCheckin={last}
            onCheckin={onCheckin}
            onExpand={expand}
            onCollapse={collapse}
            onStop={stop}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ScannerThemeColor() {
  useThemeColor("#0c0a09"); // matches bg-stone-950
  return null;
}

const SPRING = { type: "spring", stiffness: 380, damping: 40 } as const;

interface SurfaceMetrics {
  barTop: number;
  barLeft: number;
  barWidth: number;
  barHeight: number;
  vw: number;
  vh: number;
}

/**
 * The persistent scanner UI: gesture wrapper + morphing surface + content
 * layers, mounted whenever there's something to show (sheet or bar).
 *
 * The morph is driven by a continuous `progress` motion value (0 = bar,
 * 1 = sheet). Pans scrub it directly — the surface's top edge tracks the
 * finger 1:1, so even a slow drag shows the transition — and release
 * springs it to whichever end the position/velocity picked. Taps and
 * buttons just flip the React state; an effect springs `progress` to
 * match.
 */
function ScannerSurface({
  event,
  expanded,
  tally,
  schoolSize,
  startedAt,
  lastCheckin,
  onCheckin,
  onExpand,
  onCollapse,
  onStop,
}: {
  event: SchoolEvent;
  expanded: boolean;
  tally: number | null;
  schoolSize: number | null;
  startedAt: number | null;
  lastCheckin: LastCheckin | null;
  onCheckin: (student: Student) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onStop: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<SurfaceMetrics | null>(null);
  const [measured, setMeasured] = useState(false);
  const progress = useMotionValue(expanded ? 1 : 0);
  const panStart = useRef<number | null>(null);
  const panMoved = useRef(false);
  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  // Measure the bar geometry (offset*, so entrance transforms don't skew
  // it) and the viewport. Only trusted for the DURATION of an interaction —
  // it's re-read right as each one starts, because iOS resizes the
  // viewport without telling anyone (see the nudge hack in AppShell). At
  // rest the surface is CSS-anchored instead, which can't drift.
  const readMetrics = useCallback(() => {
    const probe = probeRef.current;
    const wrapper = wrapperRef.current;
    if (!probe || !wrapper) return;
    metricsRef.current = {
      barTop: probe.offsetTop,
      barLeft: probe.offsetLeft,
      barWidth: probe.offsetWidth,
      barHeight: probe.offsetHeight,
      vw: wrapper.clientWidth,
      vh: wrapper.clientHeight,
    };
    progress.set(progress.get()); // recompute transforms with fresh metrics
  }, [progress]);

  useEffect(() => {
    const onMeasure = () => {
      readMetrics();
      setMeasured(true);
    };
    const raf = requestAnimationFrame(onMeasure);
    window.addEventListener("resize", onMeasure);
    // iOS reports some viewport changes only here, not on window resize.
    window.visualViewport?.addEventListener("resize", onMeasure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMeasure);
      window.visualViewport?.removeEventListener("resize", onMeasure);
    };
  }, [readMetrics]);

  // Taps, buttons, and gesture releases flip `expanded`; the visual state
  // follows by springing progress to match — from wherever the finger
  // left it, so gestures hand off seamlessly.
  useEffect(() => {
    readMetrics();
    const controls = animate(progress, expanded ? 1 : 0, SPRING);
    return () => controls.stop();
  }, [expanded, progress, readMetrics]);

  // True whenever progress sits exactly at an endpoint — the surface then
  // renders CSS-anchored so a mid-flight iOS viewport resize can't leave
  // it hanging misaligned; the measured box takes over only in motion.
  const [resting, setResting] = useState(true);
  const restingRef = useRef(true);
  useMotionValueEvent(progress, "change", (p) => {
    const r = p <= 0 || p >= 1;
    if (r !== restingRef.current) {
      restingRef.current = r;
      setResting(r);
    }
  });

  // Post-drag clicks would re-trigger buttons under the finger; swallow
  // them in capture phase after any real pan.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onClickCapture = (e: MouseEvent) => {
      if (panMoved.current) {
        e.preventDefault();
        e.stopPropagation();
        panMoved.current = false;
      }
    };
    el.addEventListener("click", onClickCapture, true);
    return () => el.removeEventListener("click", onClickCapture, true);
  }, []);

  const m = metricsRef;
  const top = useTransform(progress, (p) => (1 - p) * (m.current?.barTop ?? 0));
  const left = useTransform(
    progress,
    (p) => (1 - p) * (m.current?.barLeft ?? 0)
  );
  const width = useTransform(progress, (p) => {
    const mm = m.current;
    return mm ? mm.barWidth + p * (mm.vw - mm.barWidth) : 0;
  });
  const height = useTransform(progress, (p) => {
    const mm = m.current;
    return mm ? mm.barHeight + p * (mm.vh - mm.barHeight) : 0;
  });
  // Corners grow with the surface (native sheets keep device-radius
  // corners at full screen) rather than flattening out mid-morph.
  const radius = useTransform(progress, [0, 1], [20, 48]);
  const bg = useTransform(progress, [0, 1], ["#1c1917", "#0c0a09"]);
  // Content follows the surface's top edge; opacity hands over midway.
  const sheetY = useTransform(progress, (p) => (1 - p) * (m.current?.barTop ?? 0));
  const barY = useTransform(progress, (p) => -p * (m.current?.barTop ?? 0));
  const sheetContentOpacity = useTransform(progress, [0.55, 0.95], [0, 1]);
  const barContentOpacity = useTransform(progress, [0, 0.35], [1, 0]);

  return (
    <motion.div
      ref={wrapperRef}
      // Entering as the sheet: present from the bottom. Entering as the
      // bar (e.g. navigating to a root tab while operating): fade up.
      initial={expanded ? { y: "110%" } : { y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={
        expanded
          ? { y: "70%", opacity: 0, transition: { duration: 0.25 } }
          : { y: 24, opacity: 0, transition: { duration: 0.2 } }
      }
      transition={{ type: "spring", stiffness: 400, damping: 38 }}
      onTapStart={() => {
        panMoved.current = false;
      }}
      onPanStart={() => {
        panMoved.current = false;
        readMetrics(); // fresh geometry the moment the finger takes over
        progress.stop();
        panStart.current = progress.get();
      }}
      onPan={(_, info) => {
        const mm = metricsRef.current;
        const start = panStart.current;
        if (!mm || start === null || mm.barTop <= 0) return;
        if (Math.abs(info.offset.y) > 8) panMoved.current = true;
        const p = start - info.offset.y / mm.barTop;
        progress.set(Math.min(1, Math.max(0, p)));
      }}
      onPanEnd={(_, info) => {
        if (panStart.current === null) return;
        panStart.current = null;
        const p = progress.get();
        const v = info.velocity.y;
        let target: boolean;
        if (v < -500) target = true;
        else if (v > 500) target = false;
        else target = expandedRef.current ? p > 0.8 : p > 0.2;
        if (target !== expandedRef.current) {
          if (target) onExpand();
          else onCollapse();
        } else {
          void animate(progress, target ? 1 : 0, SPRING);
        }
      }}
      className="pointer-events-none fixed inset-0 z-50 text-white"
    >
      {/* Invisible probe carrying the bar geometry, purely to measure. */}
      <div
        ref={probeRef}
        aria-hidden
        className={cn("pointer-events-none absolute opacity-0", BAR_GEOM)}
      />

      {measured && (
        <>
          {/* The morphing dark surface — CSS-anchored at rest (immune to
              sneaky viewport resizes), measurement-driven while moving.
              The boxes coincide at the swap because metrics are re-read
              as each interaction starts. */}
          {resting ? (
            <div
              onClick={expanded ? undefined : onExpand}
              className={cn(
                "pointer-events-auto absolute touch-none shadow-float",
                expanded
                  ? "inset-0 rounded-[48px] bg-stone-950"
                  : cn(BAR_GEOM, "rounded-[20px] bg-stone-900")
              )}
            />
          ) : (
            <motion.div
              style={{ top, left, width, height, borderRadius: radius, backgroundColor: bg }}
              className="pointer-events-auto absolute touch-none shadow-float"
            />
          )}

          {/* Content layers ride the surface and crossfade over it. */}
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                key="sheet-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                style={{ y: sheetY }}
                className="pointer-events-auto absolute inset-0 touch-none"
              >
                <motion.div
                  style={{ opacity: sheetContentOpacity }}
                  className="flex h-full min-h-0 flex-col"
                >
                  <SheetContent
                    event={event}
                    tally={tally}
                    schoolSize={schoolSize}
                    startedAt={startedAt}
                    lastCheckin={lastCheckin}
                    onCheckin={onCheckin}
                    onCollapse={onCollapse}
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="bar-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                style={{ y: barY }}
                className={cn(
                  "pointer-events-auto absolute touch-none",
                  BAR_GEOM
                )}
              >
                <motion.div
                  style={{ opacity: barContentOpacity }}
                  className="flex h-full items-center gap-2 pl-4 pr-2"
                >
                  <button
                    onClick={onExpand}
                    aria-label="Expand scanner"
                    className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight">
                        {event.name}
                      </span>
                      <span className="block text-[11px] leading-tight text-white/60">
                        Scanning · {tally ?? "–"} checked in
                      </span>
                    </span>
                    <ChevronUp className="h-4 w-4 shrink-0 text-white/50" />
                  </button>
                  <button
                    onClick={onStop}
                    aria-label="Stop operating this event"
                    className="shrink-0 rounded-full bg-white/10 px-4 py-2.5 text-xs font-bold hover:bg-white/20"
                  >
                    Stop
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

/** The expanded state's content: full-screen camera + check-in feedback. */
function SheetContent({
  event,
  tally,
  schoolSize,
  startedAt,
  lastCheckin,
  onCheckin,
  onCollapse,
}: {
  event: SchoolEvent;
  tally: number | null;
  schoolSize: number | null;
  startedAt: number | null;
  lastCheckin: LastCheckin | null;
  onCheckin: (student: Student) => void;
  onCollapse: () => void;
}) {
  const { session, houseById } = useSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "on" | "error">(
    "starting"
  );
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [typedCode, setTypedCode] = useState("");
  // Ticks once a second for the elapsed stat and "just now" labels.
  const [now, setNow] = useState(() => Date.now());

  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const eventRef = useRef(event);
  const operatorRef = useRef(session.staffId);
  useEffect(() => {
    eventRef.current = event;
    operatorRef.current = session.staffId;
  }, [event, session.staffId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // The page behind the sheet must not scroll while it's up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
      const scannedAt = Date.now();
      // The camera re-reads the same code many times a second — debounce it,
      // but let a *different* code through immediately (line speed!).
      if (
        text === lastScan.current.text &&
        scannedAt - lastScan.current.at < 3000
      ) {
        return;
      }
      lastScan.current = { text, at: scannedAt };

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
        onCheckin(student);
        showOverlay({ kind: "success", student });
      } else {
        showOverlay({ kind: "duplicate", student });
      }
    },
    [showOverlay, onCheckin]
  );

  // Wedge scanners are keyboards: catch fast keystrokes ending in Enter
  // anywhere on the sheet, so ID guns work with no on-screen affordance.
  const keyBuffer = useRef({ text: "", at: 0 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const at = Date.now();
      if (at - keyBuffer.current.at > 500) keyBuffer.current.text = "";
      keyBuffer.current.at = at;
      if (e.key === "Enter") {
        const code = keyBuffer.current.text.trim();
        keyBuffer.current.text = "";
        if (code.length >= 4) void handleCode(code);
      } else if (e.key.length === 1) {
        keyBuffer.current.text += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCode]);

  // Camera + continuous decode. We acquire the stream ourselves instead of
  // letting zxing do it: iOS Safari only autoplays when muted/playsinline are
  // real DOM attributes set before play(), and React's props don't guarantee
  // that — the symptom is hanging on "Starting camera…" forever.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setCameraState("starting");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    let controls: IScannerControls | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    // If nothing has happened after 12s (e.g. an unanswered permission
    // prompt that was dismissed), surface the fallback UI.
    const watchdog = setTimeout(() => {
      if (!cancelled) {
        setCameraState((s) => (s === "starting" ? "error" : s));
      }
    }, 12000);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ]);
        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 150,
        });
        controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) void handleCode(result.getText());
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        setCameraState("on");
      } catch {
        if (!cancelled) setCameraState("error");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, [event, handleCode, cameraAttempt]);

  const submitTyped = () => {
    const code = typedCode.trim();
    if (!code) return;
    setTypedCode("");
    void handleCode(code);
  };

  const goManual = () => {
    onCollapse();
    router.push("/operate/manual");
  };

  const lastHouse = lastCheckin
    ? houseById(lastCheckin.student.houseId)
    : undefined;
  const pct =
    schoolSize && tally != null
      ? Math.round((tally / schoolSize) * 100)
      : null;

  return (
    <>
      {/* Grab handle — the sheet swipes down into the mini-bar. */}
      <div className="flex shrink-0 justify-center pt-[max(env(safe-area-inset-top),0.75rem)]">
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-white/25" />
      </div>

      {/* Header — centered title, one quiet minimize affordance. */}
      <div className="relative shrink-0 px-14 pb-4 pt-3 text-center">
        <button
          onClick={onCollapse}
          className="absolute left-3 top-2 rounded-full bg-white/10 p-2 hover:bg-white/20"
          aria-label="Minimize scanner"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <p className="truncate text-xl font-bold">{event.name}</p>
        <p className="mt-0.5 text-sm text-white/60">Scanning for check-in</p>
      </div>

      {/* Camera viewport — a rounded panel, not full bleed. */}
      <div className="relative mx-4 min-h-0 flex-1 overflow-hidden rounded-3xl bg-stone-900">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        {cameraState === "on" && !overlay && (
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-5 top-5 h-14 w-14 rounded-tl-3xl border-l-4 border-t-4 border-white/80" />
            <span className="absolute right-5 top-5 h-14 w-14 rounded-tr-3xl border-r-4 border-t-4 border-white/80" />
            <span className="absolute bottom-5 left-5 h-14 w-14 rounded-bl-3xl border-b-4 border-l-4 border-white/80" />
            <span className="absolute bottom-5 right-5 h-14 w-14 rounded-br-3xl border-b-4 border-r-4 border-white/80" />
            <p className="absolute inset-x-0 bottom-7 text-center text-sm font-medium text-white/80">
              Point at a pass or ID card
            </p>
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
            <Button
              variant="secondary"
              onClick={() => setCameraAttempt((a) => a + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              Try camera again
            </Button>
          </div>
        )}

        {/* Result overlays — clipped to the rounded panel. */}
        <AnimatePresence>
          {overlay && (
            <ScanOverlay
              key={
                overlay.kind === "unknown"
                  ? `unknown-${overlay.code}`
                  : `${overlay.kind}-${overlay.student.id}`
              }
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
              onManual={goManual}
              onDismiss={() => setOverlay(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Last check-in — constant height so the camera never jumps. */}
      <div className="mx-4 mt-3 shrink-0">
        {lastCheckin ? (
          <div className="flex items-center justify-between gap-3 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-5 py-3">
            <span className="flex min-w-0 items-center gap-2 font-bold text-emerald-300">
              <Check className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {lastCheckin.student.firstName} {lastCheckin.student.lastName}
                {lastHouse && <> · {lastHouse.name}</>}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-emerald-300/90">
              {relTime(now - lastCheckin.at)}
            </span>
          </div>
        ) : (
          <div className="rounded-full border border-white/10 px-5 py-3 text-center text-sm text-white/40">
            Waiting for the first scan…
          </div>
        )}
      </div>

      {/* Session stats */}
      <div className="grid shrink-0 grid-cols-3 gap-2 px-4 pb-1 pt-4 text-center">
        <div>
          <p className="text-3xl font-black tabular-nums">{tally ?? "–"}</p>
          <p className="mt-0.5 text-sm text-white/50">checked in</p>
        </div>
        <div>
          <p className="text-3xl font-black tabular-nums">
            {pct != null ? `${pct}%` : "–"}
          </p>
          <p className="mt-0.5 text-sm text-white/50">of school</p>
        </div>
        <div>
          <p className="text-3xl font-black tabular-nums">
            {startedAt != null ? formatElapsed(now - startedAt) : "–"}
          </p>
          <p className="mt-0.5 text-sm text-white/50">elapsed</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 space-y-2 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        {cameraState === "error" && (
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
              className="bg-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            <Button type="submit" variant="secondary">
              <Check className="h-4 w-4" />
            </Button>
          </form>
        )}
        <button
          onClick={goManual}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-3.5 text-sm font-semibold backdrop-blur hover:bg-white/20"
        >
          <Search className="h-4 w-4" />
          Manual check-in
        </button>
      </div>
    </>
  );
}

function ScanOverlay({
  overlay,
  houseColor,
  houseName,
  onManual,
  onDismiss,
}: {
  overlay: Overlay;
  houseColor?: string;
  houseName?: string;
  onManual: () => void;
  onDismiss: () => void;
}) {
  const motionProps = {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, transition: { duration: 0.1 } },
    transition: { type: "spring", stiffness: 600, damping: 40 },
  } as const;

  if (overlay.kind === "unknown") {
    return (
      <motion.div
        {...motionProps}
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-700/95 px-8 text-center"
      >
        <TriangleAlert className="h-14 w-14" />
        <p className="text-2xl font-black">Code not recognized</p>
        <p className="break-all text-sm text-white/80">{overlay.code}</p>
        <Button variant="secondary" size="lg" className="mt-2" onClick={onManual}>
          <Search className="h-4 w-4" />
          Try manual check-in
        </Button>
        <button className="text-sm text-white/70 underline" onClick={onDismiss}>
          Keep scanning
        </button>
      </motion.div>
    );
  }

  const { student } = overlay;
  const isDup = overlay.kind === "duplicate";
  return (
    <motion.div
      {...motionProps}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center",
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
      {isDup && (
        <p className="text-lg font-bold uppercase tracking-wide">
          Already checked in
        </p>
      )}
      <p className="text-3xl font-black leading-tight">
        {student.firstName} {student.lastName}
      </p>
      <p
        className={cn(
          "text-lg font-semibold",
          isDup ? "text-stone-800" : "text-white/90"
        )}
      >
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
    </motion.div>
  );
}
