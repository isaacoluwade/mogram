import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SERVER_ONLY = {
  group: ["@/server/*", "@/server/**"],
  message: "Server modules are server-only; import them from server components or route handlers.",
};
const EDITOR_INTERNALS = {
  group: ["@/features/editor", "@/features/editor/**"],
  message:
    "The editor is used by its routes only. Share code through a feature both can import (canvas, drafts, files, share…).",
};
const FEATURES = {
  group: ["@/features/*", "@/features/**"],
  message: "Design-system components and lib helpers sit below features and can't import them.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "public/**",
    "playwright-report/**",
    "test-results/**",
    "drizzle/**",
  ]),
  {
    // The files eslint-config-next sets React up for (a CommonJS loader script isn't one).
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "react/no-danger": "error",
      "no-restricted-imports": ["error", { patterns: [SERVER_ONLY] }],
    },
  },
  {
    // Feature boundaries: features other than the editor can't reach into it…
    files: ["src/features/**"],
    ignores: ["src/features/editor/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [SERVER_ONLY, EDITOR_INTERNALS] }] },
  },
  {
    // …and the layers below features don't depend on them.
    files: ["src/components/**", "src/lib/**", "src/styles/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [SERVER_ONLY, FEATURES] }] },
  },
  {
    // Promises must be awaited, returned, or explicitly handed off with `void` (Q12). The type
    // information also lets ESLint catch async callbacks where React expects a plain function.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    // Routes, server code and their tests may use the server layer.
    files: ["src/app/**", "src/server/**", "src/proxy.ts", "scripts/**", "test/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Tests may assert presence with `!` (engineering standards §3.1).
    files: ["test/**", "e2e/**", "src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
]);
