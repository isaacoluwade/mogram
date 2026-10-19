import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Security headers that apply to every response. The Content-Security-Policy is set per request
 * in `src/proxy.ts` because it carries a fresh nonce (see docs/security.md).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // The microphone is for the prompter following a reader's voice, on Mogram's own pages
    // only; Chrome recognises the speech on the device (D-96).
    value:
      "camera=(), microphone=(self), on-device-speech-recognition=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** Template files load as text through a tiny local loader (`scripts/text-loader.cjs`). */
const TEMPLATE_TEXT = {
  condition: { path: /src\/features\/templates\// },
  loaders: [fileURLToPath(new URL("./scripts/text-loader.cjs", import.meta.url))],
  as: "*.js",
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
  typedRoutes: true,
  // PGlite loads WebAssembly and jsdom (used by isomorphic-dompurify) reads files at runtime;
  // both must run as plain Node modules rather than be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "isomorphic-dompurify", "jsdom"],
  // Templates are folders of real Mogram files (src/features/templates), imported as their text.
  turbopack: {
    rules: {
      "*.yaml": TEMPLATE_TEXT,
      "*.md": TEMPLATE_TEXT,
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      {
        // Icon artwork and fonts are content-addressed by name and never change in place.
        source: "/(icons|fonts)/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
