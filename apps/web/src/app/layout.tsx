import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { PAGE_BACKGROUND } from "@/styles/colors";
import { fontVariables } from "./fonts";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3100"),
  title: {
    default: "Mogram — Architecture diagrams that move",
    template: "%s · Mogram",
  },
  description:
    "Build animated, stateful architecture diagrams as easily as a design, and keep them in your repository as clean YAML.",
  applicationName: "Mogram",
  openGraph: {
    title: "Mogram — Architecture diagrams that move",
    description: "Animated, stateful architecture diagrams that live in your repo as clean YAML.",
    siteName: "Mogram",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: PAGE_BACKGROUND,
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading request headers renders every page per request, which the CSP nonce in
  // src/proxy.ts requires (Next applies the nonce during server rendering).
  await headers();
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
