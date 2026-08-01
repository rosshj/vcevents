"use client";

import { Scroll, Sheet } from "@silk-hq/components";
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
 */
export function BottomSheet({
  presented,
  onPresentedChange,
  title,
  /** "content" hugs its content (capped); "tall" leaves room for a keyboard. */
  size = "content",
  className,
  children,
}: {
  presented: boolean;
  onPresentedChange: (presented: boolean) => void;
  title: string;
  size?: "content" | "tall";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet.Root
      license="non-commercial"
      presented={presented}
      onPresentedChange={onPresentedChange}
      sheetRole="dialog"
    >
      <Sheet.Portal>
        <Sheet.View className="z-50" nativeEdgeSwipePrevention>
          <Sheet.Backdrop
            className="bg-black/40"
            themeColorDimming="auto"
            travelAnimation={{ opacity: [0, 1] }}
          />
          <Sheet.Content
            className={cn(
              "flex flex-col overflow-hidden rounded-t-[2rem] bg-white",
              size === "tall" ? "h-[92dvh]" : "max-h-[92dvh]",
              className
            )}
          >
            <Sheet.Title className="sr-only">{title}</Sheet.Title>
            <span
              aria-hidden
              className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-stone-300"
            />
            <Scroll.Root asChild className="min-h-0 flex-1">
              <Scroll.View className="min-h-0 flex-1" scrollGestureTrap>
                <Scroll.Content className="px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
                  {children}
                </Scroll.Content>
              </Scroll.View>
            </Scroll.Root>
          </Sheet.Content>
        </Sheet.View>
      </Sheet.Portal>
    </Sheet.Root>
  );
}
