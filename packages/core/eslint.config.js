import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["coverage/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/consistent-type-imports": "error",
      // @mogram/core must stay pure: no DOM, no Node, no clocks or randomness inside logic.
      "no-restricted-globals": ["error", "window", "document", "navigator", "localStorage"],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Pass time in as an argument (core is pure)." },
        {
          object: "Math",
          property: "random",
          message: "Pass randomness in as an argument (core is pure).",
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["test/**/*.ts", "vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-restricted-properties": "off",
    },
  },
);
