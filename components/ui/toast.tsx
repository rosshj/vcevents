"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Toast } from "@base-ui/react/toast";
import { Check, TriangleAlert, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Transient confirmations, on Base UI Toast.
 *
 * The public surface is unchanged: `useToast().toast({ message, tone,
 * action, duration })`. Underneath, a toast manager owned by the provider
 * queues into a single top-placed viewport.
 *
 * Replace rather than queue: check-in feedback is only useful while it's
 * the most recent thing that happened, so a new toast closes the one
 * before it instead of stacking. `limit={1}` marks anything still
 * animating out as `data-limited` so it can be hidden immediately.
 *
 * Top placement is deliberate: the bottom of every screen is already
 * occupied by the tab bar and the docked scanner bar, and a toast must
 * never cover the scan control. The viewport ignores pointer events so
 * the page stays fully interactive underneath; only the toast itself
 * accepts taps.
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

type Tone = NonNullable<ToastOptions["tone"]>;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // A manager instance (rather than the hook) so `toast()` is callable
  // from the provider itself, above the Base UI provider's context.
  const [manager] = useState(() => Toast.createToastManager());
  const currentId = useRef<string | null>(null);
  const nextId = useRef(0);

  const toast = useCallback(
    (options: ToastOptions) => {
      if (currentId.current) manager.close(currentId.current);
      const id = `app-toast-${nextId.current++}`;
      currentId.current = id;
      const { action } = options;
      manager.add({
        id,
        title: options.message,
        type: options.tone ?? "neutral",
        timeout: options.duration ?? (action ? 6000 : 3000),
        actionProps: action
          ? {
              children: (
                <>
                  <Undo2 className="h-3.5 w-3.5" />
                  {action.label}
                </>
              ),
              onClick: () => {
                manager.close(id);
                void action.onPress();
              },
            }
          : undefined,
      });
    },
    [manager]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Toast.Provider toastManager={manager} limit={1}>
      <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => {
    const tone = (t.type ?? "neutral") as Tone;
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        swipeDirection="up"
        className={cn(
          // Enter/exit from above; the swipe offset rides along while the
          // finger has it. `data-limited` is a toast already superseded by
          // a newer one — hide it rather than let two stack for a frame.
          "pointer-events-auto flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-float select-none",
          "[transform:translateY(var(--toast-swipe-movement-y))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "data-swiping:duration-0",
          "data-starting-style:-translate-y-[150%] data-starting-style:opacity-0",
          "data-ending-style:-translate-y-[150%] data-ending-style:opacity-0",
          "data-limited:opacity-0",
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
        <Toast.Title className="min-w-0 flex-1 truncate text-sm font-semibold" />
        {t.actionProps && (
          <Toast.Action className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25" />
        )}
      </Toast.Root>
    );
  });
}
