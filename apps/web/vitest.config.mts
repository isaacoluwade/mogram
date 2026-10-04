import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Imports `.yaml` and `.md` files as their text, as Turbopack does (`turbopack.rules`). */
function rawText(): Plugin {
  return {
    name: "mogram-raw-text",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(ya?ml|md)$/.test(id.split("?")[0] ?? "")) return null;
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  };
}

export default defineConfig({
  plugins: [rawText(), react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server Components; tests import server modules directly.
      "server-only": fileURLToPath(new URL("./test/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/support/setup.ts"],
  },
});
