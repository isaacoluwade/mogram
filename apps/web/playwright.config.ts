import { defineConfig } from "@playwright/test";

/** E2E_BASE_URL points the suite at another server (e.g. a production build on :3200). */
const external = process.env.E2E_BASE_URL;

/**
 * End-to-end journeys in a real browser (the installed Chrome: Playwright's own Chromium
 * download is blocked on this network). Runs against `pnpm dev` on port 3100, reusing a running
 * server. Screenshots of every page and state are written to docs/screenshots/.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: external ?? "http://localhost:3100",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  ...(external === undefined
    ? {
        webServer: {
          command: "pnpm dev",
          url: "http://localhost:3100",
          reuseExistingServer: true,
          timeout: 180_000,
          // The assistant journeys use the scripted provider: no model, no key, no cost.
          env: { AI_PROVIDER: "scripted", AI_ALLOW_ANONYMOUS: "1" },
        },
      }
    : {}),
});
