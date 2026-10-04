import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-border bg-fill-subtle px-1 font-sans text-micro font-medium text-fg-secondary",
        className,
      )}
      {...props}
    />
  );
}
