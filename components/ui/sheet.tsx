"use client";

import { Scroll, Sheet, createComponentId } from "@silk-hq/components";
import { cn } from "@/lib/utils";

/**
 * The app's bottom sheet, on Silk.
 *
 * Silk is used under its non-commercial license (granted for this school
 * project). The `license` prop is required by the library — it declares
 * which license the app is using.
 *
 * The content sits inside a Silk `Scroll` on purpose: its default
 * `safeArea="visual-viewport"` measures the viewport *minus the on-screen
 * keyboard*, and `onFocusInside={{ scrollIntoView: true }}` scrolls the
 * focused input clear of it. That combination is what makes forms usable
 * in a sheet on iOS.
 *
 * The sheet hugs its content (capped at 92dvh). The white surface lives
 * on `<Sheet.BleedingBackground>`, not the content box — it extends
 * beyond the bottom edge so pulling the sheet up past its height shows
 * white instead of a gap.
 *
 * Width discipline: iOS occasionally feeds Silk a stale viewport width
 * (the same standalone quirk AppShell nudges around), which showed up as
 * sheet content spilling past the right edge. The `!` width clamps on
 * the Scroll pieces out-rank any inline width Silk computes.
 */

/**
 * Stable ids so the page content can be animated with each sheet's
 * travel (the "depth" effect) via `SheetDepthOutlet` below.
 */
export const BOTTOM_SHEET_IDS = {
  student: createComponentId(),
  addStudent: createComponentId(),
  event: createComponentId(),
} as const;

type BottomSheetId = (typeof BOTTOM_SHEET_IDS)[keyof typeof BOTTOM_SHEET_IDS];

const DEPTH_ANIMATION = {
  // The page recedes as the sheet rises — iOS's modal "depth" treatment.
  // Function syntax throughout: Silk keeps these applied while the sheet
  // rests at its open detent (keyframe arrays get cleaned up there).
  scale: ({ progress }: { progress: number }) =>
    1 - Math.max(0, Math.min(1, progress)) * 0.06,
  clipPath: ({ progress }: { progress: number }) =>
    `inset(0px round ${Math.max(0, progress) * 28}px)`,
};

/**
 * Wrap the page content once; it scales back behind whichever app sheet
 * is presented. Outlets nest (one per sheet) — only the traveling
 * sheet's outlet is ever mid-animation, the rest sit at identity.
 */
export function SheetDepthOutlet({ children }: { children: React.ReactNode }) {
  return (
    <Sheet.Outlet
      forComponent={BOTTOM_SHEET_IDS.student}
      travelAnimation={DEPTH_ANIMATION}
      className="origin-top"
    >
      <Sheet.Outlet
        forComponent={BOTTOM_SHEET_IDS.addStudent}
        travelAnimation={DEPTH_ANIMATION}
        className="origin-top"
      >
        <Sheet.Outlet
          forComponent={BOTTOM_SHEET_IDS.event}
          travelAnimation={DEPTH_ANIMATION}
          className="origin-top"
        >
          {children}
        </Sheet.Outlet>
      </Sheet.Outlet>
    </Sheet.Outlet>
  );
}

export function BottomSheet({
  presented,
  onPresentedChange,
  title,
  componentId,
  flush = false,
  className,
  content,
  children,
}: {
  presented: boolean;
  onPresentedChange: (presented: boolean) => void;
  title: string;
  /** One of BOTTOM_SHEET_IDS, so the depth outlet can track this sheet. */
  componentId?: BottomSheetId;
  /**
   * Full-bleed content: no horizontal padding, and the grab handle
   * floats over the content (for covers that reach the sheet's edges).
   */
  flush?: boolean;
  className?: string;
  /** The sheet's body. */
  content: React.ReactNode;
  /**
   * Subtree nested under this sheet's Root — the page goes here so
   * `SheetDepthOutlet` (which reads the Root's context) can animate it.
   */
  children?: React.ReactNode;
}) {
  return (
    <Sheet.Root
      license="non-commercial"
      componentId={componentId}
      presented={presented}
      onPresentedChange={onPresentedChange}
      sheetRole="dialog"
    >
      {children}
      <Sheet.Portal>
        <Sheet.View className="z-50" nativeEdgeSwipePrevention>
          {/* themeColorDimming requires an alpha-free background-color —
              rgba() crashes its color parser on iOS (WebKit is the only
              engine where "auto" activates). Dim via opacity keyframes
              instead: black at 0.4 ≈ the usual bg-black/40 scrim. */}
          <Sheet.Backdrop
            className="bg-black"
            themeColorDimming="auto"
            travelAnimation={{ opacity: [0, 0.4] }}
          />
          <Sheet.Content
            className={cn(
              "flex h-auto max-h-[92dvh] w-full max-w-full flex-col overflow-x-clip",
              className
            )}
          >
            <Sheet.BleedingBackground className="overflow-hidden rounded-t-[2rem] bg-white" />
            <Sheet.Title className="sr-only">{title}</Sheet.Title>
            {/* flush content renders its own grab handle (an absolute
                overlay here gets buried when Silk reshuffles layers after
                the travel animation settles). */}
            {!flush && (
              <span
                aria-hidden
                className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-stone-300"
              />
            )}
            <Scroll.Root asChild className="min-h-0 w-full! max-w-full! flex-1">
              <Scroll.View
                className="min-h-0 w-full! max-w-full! flex-1"
                scrollGestureTrap
              >
                <Scroll.Content
                  className={cn(
                    "w-full! max-w-full! pb-[max(env(safe-area-inset-bottom),1.5rem)]",
                    flush ? "overflow-hidden rounded-t-[2rem]" : "px-5 pt-4"
                  )}
                >
                  {content}
                </Scroll.Content>
              </Scroll.View>
            </Scroll.Root>
          </Sheet.Content>
        </Sheet.View>
      </Sheet.Portal>
    </Sheet.Root>
  );
}
