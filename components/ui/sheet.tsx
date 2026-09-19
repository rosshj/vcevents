"use client";

import { useEffect, useRef } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";

/**
 * The app's bottom sheet, on Base UI Drawer.
 *
 * Every sheet is a modal drawer rising from the bottom edge: swipe down,
 * tap the scrim, or press Escape to dismiss. It hugs its content, capped
 * at 92dvh, and scrolls inside `Drawer.Content` past that.
 *
 * The white surface carries a 3rem "bleed" below the viewport edge, so
 * pulling the sheet up past its resting height shows white instead of a
 * gap. `Drawer.VirtualKeyboardProvider` keeps a focused field clear of
 * the software keyboard — that's what makes a form usable inside a
 * fixed sheet on iOS.
 *
 * The depth effect (the page receding behind an open sheet) is wired
 * once at the app level — `SheetProvider` at the root, `SheetDepthOutlet`
 * around the page — and every BottomSheet beneath drives it. Sheets no
 * longer need to nest the page or carry an id.
 */

const EASE = "cubic-bezier(0.32,0.72,0,1)";

/** Wrap the app once; every BottomSheet beneath it reports to the outlet. */
export function SheetProvider({ children }: { children: React.ReactNode }) {
  return <Drawer.Provider>{children}</Drawer.Provider>;
}

/** The scrim is black at this opacity; the status bar dims to match. */
const SCRIM_OPACITY = 0.4;

type RGB = [number, number, number];

/**
 * Parses `#rgb` / `#rrggbb` (the meta, and computed custom properties,
 * which some engines shorten) and `rgb(r, g, b)`. Null for anything else.
 */
function parseColor(color: string): RGB | null {
  const c = color.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1].split("").map((d) => d + d).join("")
        : hex[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** A colour under a black layer of the scrim's opacity. */
const dim = (c: RGB): RGB =>
  c.map((v) => Math.round(v * (1 - SCRIM_OPACITY))) as RGB;

const toRgb = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** The screen's own chrome colour: what useThemeColor published, else white. */
function pageBg(): RGB {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--page-bg")
    .trim();
  return parseColor(v) ?? [255, 255, 255];
}

/** Same curve as the sheet's travel; keeps the chrome in step with the scrim. */
function easeTravel(t: number) {
  // cubic-bezier(0.32, 0.72, 0, 1), sampled numerically on x.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const s = (lo + hi) / 2;
    const x = 3 * (1 - s) * (1 - s) * s * 0.32 + s * s * s;
    if (x < t) lo = s;
    else hi = s;
  }
  const s = (lo + hi) / 2;
  return 3 * (1 - s) * (1 - s) * s * 0.72 + 3 * (1 - s) * s * s + s * s * s;
}

/**
 * Dims the browser chrome while a sheet is open, so the status bar reads
 * as sitting under the scrim rather than floating above it.
 *
 * Two mechanisms, since which one iOS Safari honours has changed between
 * versions. The theme-color meta is animated frame by frame across the
 * sheet's travel as an `rgb()` string, which is exactly what Silk's
 * themeColorDimming did and what a single abrupt write to it did not
 * achieve here. And the open state is an attribute on <html> from which
 * globals.css derives dimmed <html>/<body> backgrounds — the page's top
 * edge, which newer Safari samples for its glass.
 *
 * Nothing is captured or restored — that raced with useThemeColor, which
 * paints the same properties for the pass and the scanner. Both edges
 * recompute from --page-bg, whatever the screen has set it to since.
 */
function ThemeColorDim({ active }: { active: boolean }) {
  // Only transitions touch the meta. On first mount the screen owns it
  // (useThemeColor may still be about to write it), so leave it alone.
  const mounted = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.sheetOpen = "";
    else delete root.dataset.sheetOpen;

    if (!mounted.current) {
      mounted.current = true;
      if (!active) return;
    }
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (!meta) return;
    const base = pageBg();
    const from = parseColor(meta.content) ?? (active ? base : dim(base));
    const to = active ? dim(base) : base;
    const ms = 450;
    let start: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      if (start === null) start = now;
      const p = easeTravel(Math.min(1, (now - start) / ms));
      const c = from.map((v, i) => Math.round(v + (to[i] - v) * p)) as RGB;
      meta.setAttribute("content", toRgb(c));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return null;
}

/**
 * Wrap the page content once; it scales back and rounds off behind
 * whichever sheet is open — iOS's modal "depth" treatment. During a
 * swipe the transition drops to 0ms so the page follows the finger
 * (`--drawer-swipe-progress` is non-zero only while swiping).
 *
 * Clip-path rather than overflow for the corners: the page's sticky
 * header needs the window to stay its scroll container. No resting
 * transform, so fixed descendants keep the viewport as their anchor.
 */
export function SheetDepthOutlet({ children }: { children: React.ReactNode }) {
  return (
    <Drawer.Indent
      className={cn(
        "origin-top",
        "[--sheet-progress:var(--drawer-swipe-progress,0)]",
        "[--indent-transition:calc(1-clamp(0,calc(var(--sheet-progress)*100000),1))]",
        `[transition:transform_450ms_${EASE},clip-path_450ms_${EASE}]`,
        "[transition-duration:calc(450ms*var(--indent-transition)),calc(450ms*var(--indent-transition))]",
        "[clip-path:inset(0px_round_0px)]",
        "data-active:[transform:scale(calc(0.94+0.06*var(--sheet-progress)))]",
        "data-active:[clip-path:inset(0px_round_calc(28px*(1-var(--sheet-progress))))]"
      )}
      render={(props, state) => (
        <div {...props}>
          <ThemeColorDim active={state.active} />
          {children}
        </div>
      )}
    />
  );
}

export function BottomSheet({
  presented,
  onPresentedChange,
  title,
  flush = false,
  className,
  content,
  children,
}: {
  presented: boolean;
  onPresentedChange: (presented: boolean) => void;
  /** Accessible name for the dialog (visually hidden). */
  title: string;
  /**
   * Full-bleed content: no horizontal padding, and no grab handle — the
   * content renders its own (for covers that reach the sheet's edges).
   */
  flush?: boolean;
  className?: string;
  /** The sheet's body. */
  content: React.ReactNode;
  /** Rendered as-is beside the sheet; kept so providers can wrap the app. */
  children?: React.ReactNode;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {children}
      <Drawer.Root
        open={presented}
        onOpenChange={onPresentedChange}
        swipeDirection="down"
      >
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Backdrop
              className={cn(
                "fixed inset-0 z-50 min-h-dvh bg-black",
                // Fades with the swipe; snaps instantly while the finger is
                // down and releases at a speed scaled by the swipe velocity.
                "opacity-[calc(0.4*(1-var(--drawer-swipe-progress)))]",
                `transition-opacity duration-[450ms] ease-[${EASE}]`,
                "data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0",
                "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
                "supports-[-webkit-touch-callout:none]:absolute"
              )}
            />
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center touch-none">
              <Drawer.Popup
                ref={popupRef}
                data-focus-ring="none"
                // Touch opens shouldn't pop the keyboard mid-travel: focus
                // the sheet itself. Keyboard and mouse get the first field.
                initialFocus={(type) =>
                  type === "touch" ? popupRef.current : true
                }
                className={cn(
                  "relative flex w-full max-w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-float outline-none touch-none",
                  "[--bleed:3rem] -mb-[var(--bleed)] max-h-[calc(92dvh+var(--bleed))] pb-[var(--bleed)]",
                  "[transform:translateY(var(--drawer-swipe-movement-y))]",
                  `transition-transform duration-[450ms] ease-[${EASE}]`,
                  "data-swiping:select-none",
                  "data-starting-style:[transform:translateY(calc(100%+2px))]",
                  "data-ending-style:[transform:translateY(calc(100%+2px))]",
                  "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
                  className
                )}
              >
                <Drawer.Title className="sr-only">{title}</Drawer.Title>
                {!flush && (
                  <span
                    aria-hidden
                    className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-stone-300"
                  />
                )}
                <Drawer.Content
                  className={cn(
                    "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain touch-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]",
                    !flush && "px-5 pt-4"
                  )}
                >
                  {content}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
    </>
  );
}
