import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Bklit UI chart library (github.com/bklit/bklit-ui, MIT) —
    // kept as shipped upstream, not held to this repo's lint rules.
    "components/bklit/**",
  ]),
]);

export default eslintConfig;
