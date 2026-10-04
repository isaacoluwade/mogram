"use client";

import "@/styles/globals.css";
import { fontVariables } from "./fonts";

/** Last-resort error screen when the root layout itself fails. It must render its own <html>. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
          <h1 className="font-display text-title font-medium tracking-title text-fg">
            Mogram couldn&apos;t load
          </h1>
          <p className="max-w-sm text-body text-fg-secondary">
            Something went wrong before the page could start. Your saved work is safe.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-accent px-5 py-2.5 text-label font-medium text-fg-inverse"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
