import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Eden's eyebrow above a headline: small Geist, dimmed. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-display text-eyebrow font-medium tracking-eyebrow text-fg-dim",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Eden's product-shot frame: a 1px gradient hairline, a #111 inside, a deep shadow, and (for the
 * hero) a soft green glow underneath.
 */
export function ProductFrame({
  children,
  glow = false,
  className,
}: {
  children: ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {glow ? (
        <div
          aria-hidden
          className="bg-frame-glow pointer-events-none absolute -inset-x-[8%] -bottom-[12%] top-[30%] -z-10 blur-2xl"
        />
      ) : null}
      <div className="bg-frame-hairline rounded-frame p-px shadow-product">
        <div className="relative overflow-hidden rounded-xl bg-main">{children}</div>
      </div>
    </div>
  );
}

/** Eden's three-up card: one quiet box, no inner frame. */
export function CardFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-fill-faint",
        className,
      )}
    >
      {children}
    </div>
  );
}
