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
 * The Me tab's role switcher, ID-card simulator, and data reset.
 *
 * On everywhere by default. There is no sign-in yet, so mock auth IS the
 * auth: with this off, whoever opens the deployment is stuck as whichever
 * identity the seed handed them, and the app can't be demonstrated at all.
 *
 * REVERT WHEN GOOGLE SSO LANDS — at that point roles come from the school
 * directory and these controls have no business in production. Flip the
 * fallback back to `process.env.VERCEL_ENV !== "production"`.
 *
 * Set DEV_TOOLS=0 on any deployment to turn them off ahead of that.
 */
export const devToolsFlag = flag<boolean>({
  key: "dev-tools",
  description:
    "Show the role switcher, ID simulator, and reset-data controls on the Me tab.",
  defaultValue: true,
  decide: () => envFlag("DEV_TOOLS", true),
});

/** Every flag the app reads, in one place. */
export const APP_FLAGS = { devTools: devToolsFlag } as const;

export interface AppFlags {
  devTools: boolean;
}

export async function evaluateFlags(): Promise<AppFlags> {
  return { devTools: await devToolsFlag() };
}
