import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { SITE_LINKS } from "./links";
import { SiteMenu } from "./site-menu";

/** Eden's marketing header: logo tile + wordmark, muted links, Sign in, white "Start free" pill. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-page/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-6 px-6 md:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Mogram home">
          <LogoMark />
          <Wordmark variant="site" />
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-7 max-lg:hidden">
          {SITE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as Route}
              className="text-body text-fg-secondary transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={(signedIn ? "/diagrams" : "/sign-in") as Route}
            className="text-body text-fg-secondary transition-colors hover:text-fg"
          >
            {signedIn ? "Your diagrams" : "Sign in"}
          </Link>
        </nav>
        <Button variant="primary" size="md" asChild className="max-lg:ml-auto">
          <Link href="/diagrams">Start free</Link>
        </Button>
        <SiteMenu signedIn={signedIn} />
      </div>
    </header>
  );
}
