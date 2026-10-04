import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  amber: { border: "border-amber-line", title: "text-amber" },
  rose: { border: "border-rose-line", title: "text-rose" },
} as const;

/** An alert card over the canvas: a coloured lead sentence, an explanation, and actions. */
export function Banner({
  tone,
  title,
  children,
  actions,
  className,
}: {
  tone: keyof typeof TONES;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-popover",
        TONES[tone].border,
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-label text-fg-soft">
        <span className={cn("font-medium", TONES[tone].title)}>{title}</span> {children}
      </p>
      {actions !== undefined ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
