import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content Security Policy with a fresh nonce (AC-7, docs/security.md).
 *
 * - Scripts: only Next's own, carrying the nonce ('strict-dynamic' lets them load their chunks).
 * - Styles: 'unsafe-inline' because React, Radix and SVG rendering set style attributes during
 *   server rendering; a nonce can't cover attributes. Style injection can't run code.
 * - Images: self, data: and blob: for diagram exports and uploaded SVG icons (rendered as images,
 *   where scripts never run). https: so card markdown can show linked images.
 * - Workers: blob: for the GIF/WebP encoders.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only meaningful (and only safe) when the site itself is served over HTTPS.
    ...(request.nextUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|icons|fonts|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
