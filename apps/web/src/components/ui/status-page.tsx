import type { ReactNode } from "react";
import { LogoMark } from "./logo";

/** Full-page message (not found, errors) on Eden's grain backdrop. */
export function StatusPage({
  code,
  title,
  description,
  actions,
}: {
  code?: string | undefined;
  title: string;
  description: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-backdrop px-6 py-16 text-center">
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0" />
      <div className="relative flex max-w-md flex-col items-center animate-reveal">
        <LogoMark size="lg" />
        {code !== undefined ? (
          <p className="mt-8 font-mono text-caption text-fg-muted">{code}</p>
        ) : null}
        <h1 className="mt-3 font-display text-title-lg font-semibold tracking-heading text-fg-title">
          {title}
        </h1>
        <p className="mt-3 text-body text-fg-secondary">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </main>
  );
}
