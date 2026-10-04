import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Eden empty state: round icon well, title, one helpful line, optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-surface text-fg-secondary [&_svg]:size-6">
        {icon}
      </span>
      <p className="font-display text-body-lg font-medium tracking-snug text-fg">{title}</p>
      {description !== undefined ? (
        <p className="mt-1 max-w-sm text-body-sm text-fg-muted">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
