import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

/**
 * The app's text input, on Base UI Input: a native <input> that registers
 * itself with an enclosing Field, so the Field's label and hint are wired
 * to it (htmlFor / aria-describedby) without ids being threaded by hand.
 */
export type InputProps = Omit<BaseInput.Props, "className"> & {
  className?: string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <BaseInput
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-2xl bg-stone-100 px-4 py-2 text-base text-stone-900 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/10 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
