import { flag } from "flags/next";

/**
 * Feature flags on the Vercel Flags SDK.
 *
 * Flags are evaluated on the server (the root layout) and handed to the
 * client through FlagsProvider, so client components read them
 * synchronously with no waterfall.
 *
 * Today each flag decides from an environment variable, which is enough
 * for per-deployment control (Vercel project env vars, or `.env.local`).
 * Pointing these at Vercel's flags dashboard later is a drop-in change:
 * add an adapter to the declaration — no call sites change.
 */

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * The Me tab's role switcher, ID-card simulator, and data reset. On for
 * previews and local work; off in production, where the tab is a plain
 * profile until real auth lands.
 */
export const devToolsFlag = flag<boolean>({
  key: "dev-tools",
  description:
    "Show the role switcher, ID simulator, and reset-data controls on the Me tab.",
  defaultValue: false,
  decide: () =>
    envFlag("DEV_TOOLS", process.env.VERCEL_ENV !== "production"),
});

/** Every flag the app reads, in one place. */
export const APP_FLAGS = { devTools: devToolsFlag } as const;

export interface AppFlags {
  devTools: boolean;
}

export async function evaluateFlags(): Promise<AppFlags> {
  return { devTools: await devToolsFlag() };
}
