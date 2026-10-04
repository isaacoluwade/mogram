import type { ReactNode } from "react";
import { Eyebrow } from "./frames";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Long-form pages (security, file format) in Eden's editorial style: eyebrow, two-tone headline,
 * "the short version", then sections with a muted label on the left and content on the right.
 */
export function DocPage({
  signedIn,
  eyebrow,
  title,
  lead,
  summary,
  children,
}: {
  signedIn: boolean;
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-page">
      <SiteHeader signedIn={signedIn} />
      <main>
        <section className="light-hero">
          <div className="mx-auto max-w-content px-6 pb-16 pt-20 md:px-8 md:pt-28">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-5 max-w-4xl text-balance font-display text-display font-medium tracking-display text-fg-secondary">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-feature text-fg-secondary">{lead}</p>
          </div>
        </section>
        {summary !== undefined ? (
          <section className="mx-auto max-w-content px-6 md:px-8">
            <div className="grid gap-6 border-y border-hairline py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:py-20">
              <p className="text-body text-fg-muted">The short version</p>
              <div className="text-balance font-display text-summary font-medium tracking-snug text-fg-secondary">
                {summary}
              </div>
            </div>
          </section>
        ) : null}
        <div className="mx-auto max-w-content px-6 pb-24 md:px-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** One section: label on the left (sticky on desktop), content on the right. */
export function DocSection({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="grid scroll-mt-24 gap-6 border-b border-hairline py-14 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:py-16"
    >
      <h2 className="text-body text-fg-muted md:sticky md:top-24 md:self-start">{label}</h2>
      <div className="flex max-w-3xl flex-col gap-4 text-body-lg leading-relaxed text-fg-secondary">
        {children}
      </div>
    </section>
  );
}

/** Key/value facts in Eden's hairline table style. */
export function FactList({ facts }: { facts: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="mt-2 overflow-hidden rounded-xl border border-border">
      {facts.map(([key, value]) => (
        <div
          key={key}
          className="grid gap-1 border-b border-border-subtle px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4"
        >
          <dt className="text-label text-fg-muted">{key}</dt>
          <dd className="text-body text-fg-soft">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <span className="text-fg">{children}</span>;
}
