import Link from "next/link";
import type { Route } from "next";
import { LogoMark, Wordmark } from "@/components/ui/logo";

const COLUMNS: readonly { title: string; links: readonly { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/diagrams", label: "Your diagrams" },
      { href: "/draft/new?template=blank", label: "Blank canvas" },
      { href: "/#templates", label: "Templates" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs/format", label: "The file format" },
      { href: "/security", label: "Security and storage" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/sign-in", label: "Create an account" },
    ],
  },
];

/** Eden's footer: logo and line on the left, muted column headings, quiet legal line. */
export function SiteFooter() {
  return (
    <footer className="relative bg-card">
      <div aria-hidden className="bg-brand-hairline absolute inset-x-0 top-0 h-px" />
      <div className="mx-auto grid max-w-content gap-10 px-6 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-8 md:py-12">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Mogram home">
            <LogoMark />
            <Wordmark variant="site" />
          </Link>
          <p className="mt-4 font-display text-body-lg font-medium tracking-tight text-fg-secondary">
            Architecture diagrams that move, explain themselves, and live in your repo.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="font-display text-footnote text-fg-muted">{column.title}</p>
            <ul className="mt-3 flex flex-col gap-1">
              {column.links.map((link) => (
                <li key={link.label}>
                  {/* 24px rows: comfortable to tap without spreading the columns out. */}
                  <Link
                    href={link.href as Route}
                    className="inline-flex min-h-6 items-center text-footer text-fg-secondary transition-colors hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-6 text-footnote text-fg-muted md:flex-row md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Mogram</p>
          <p className="max-w-2xl md:text-right">
            Azure is a trademark of Microsoft; AWS of Amazon.com, Inc. or its affiliates; Google
            Cloud of Google LLC; Kubernetes is a registered trademark of The Linux Foundation. Their
            icons and the tool logos belong to their owners, and none of them endorses Mogram.
          </p>
        </div>
      </div>
    </footer>
  );
}
