import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Key/value row (Eden "Ad Brief" card): muted key left, value right, hairline between rows. */
export function PropertyRow({
  label,
  children,
  className,
  align = "center",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /**
   * `start` keeps the key level with a 32px field whose value can grow below it (a field with a
   * message under it), instead of drifting to the middle of the taller row.
   */
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 gap-3 border-b border-border-subtle py-1.5 last:border-b-0",
        align === "start" ? "items-start" : "items-center",
        className,
      )}
    >
      <span
        className={cn("w-20 shrink-0 text-caption text-fg-muted", align === "start" && "leading-8")}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-label text-fg-soft">
        {children}
      </div>
    </div>
  );
}
