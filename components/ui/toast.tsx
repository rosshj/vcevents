"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Sheet } from "@silk-hq/components";
import { Check, TriangleAlert, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Transient confirmations, on Silk.
 *
 * A toast is a Sheet travelling from the top: `inertOutside={false}` and
 * no `<Sheet.Backdrop>` keep the page fully interactive underneath, and
 * `nativeEdgeSwipePrevention={false}` matters more than it looks — the
 * default drops a 28px-wide strip down the left edge of the screen that
 * would swallow taps on whatever is behind it.
 *
 * Top placement is deliberate: the bottom of every screen is already
 * occupied by the tab bar and the docked scanner bar, and a toast must
 * never cover the scan control.
 */

export interface ToastAction {
  label: string;
  /** Run on tap. The toast dismisses itself first. */
  onPress: () => void | Promise<void>;
}

export interface ToastOptions {
  message: string;
  tone?: "neutral" | "success" | "warning";
  action?: ToastAction;
  /** Milliseconds on screen; actions get longer by default. */
  duration?: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<(ToastOptions & { id: number }) | null>(
    null
  );
  const [presented, setPresented] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const toast = useCallback((options: ToastOptions) => {
    clearTimer();
    // Replace rather than queue: check-in feedback is only useful while
    // it's the most recent thing that happened.
    setCurrent({ ...options, id: nextId.current++ });
    setPresented(true);
    const ms = options.duration ?? (options.action ? 6000 : 3000);
    timer.current = setTimeout(() => setPresented(false), ms);
  }, []);

  useEffect(() => clearTimer, []);

  const runAction = async () => {
    const action = current?.action;
    clearTimer();
    setPresented(false);
    await action?.onPress();
  };

  const tone = current?.tone ?? "neutral";

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Sheet.Root
        license="non-commercial"
        presented={presented}
        onPresentedChange={setPresented}
        sheetRole="status"
      >
        <Sheet.Portal>
          <Sheet.View
            className="z-[60]"
            contentPlacement="top"
            tracks="top"
            inertOutside={false}
            nativeEdgeSwipePrevention={false}
            swipeDismissal
          >
            <Sheet.Content className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-float",
                  tone === "success" && "bg-emerald-700",
                  tone === "warning" && "bg-amber-600",
                  tone === "neutral" && "bg-stone-900"
                )}
              >
                {tone !== "neutral" && (
                  <span aria-hidden className="shrink-0">
                    {tone === "success" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <TriangleAlert className="h-4 w-4" />
                    )}
                  </span>
                )}
                <Sheet.Title className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {current?.message}
                </Sheet.Title>
                {current?.action && (
                  <button
                    onClick={runAction}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    {current.action.label}
                  </button>
                )}
              </div>
            </Sheet.Content>
          </Sheet.View>
        </Sheet.Portal>
      </Sheet.Root>
    </ToastContext.Provider>
  );
}
