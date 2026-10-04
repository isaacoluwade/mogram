import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full min-w-0 bg-fill-field text-body text-fg placeholder:text-fg-ghost outline-none transition-colors duration-150 focus:bg-fill-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-9 rounded-md px-3", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-label font-medium text-fg-soft", className)} {...props} />;
}

/** Labelled form row with optional hint and error. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error != null && error.length > 0 ? (
        <p role="alert" className="text-caption text-rose">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p className="text-caption text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
