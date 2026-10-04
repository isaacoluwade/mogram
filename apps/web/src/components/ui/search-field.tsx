import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Eden's pill search with an optional trailing slot (filter pill, shortcut). */
export function SearchField({
  className,
  inputClassName,
  trailing,
  ...props
}: ComponentProps<"input"> & { trailing?: ReactNode; inputClassName?: string }) {
  return (
    <label
      className={cn(
        "flex min-h-10 cursor-text items-center gap-2.5 rounded-full bg-fill-field px-4 text-fg-soft transition-colors focus-within:bg-fill-hover",
        className,
      )}
    >
      <Search aria-hidden className="size-4 shrink-0 text-fg-faint" />
      <input
        type="search"
        className={cn(
          "min-w-0 flex-1 bg-transparent py-2 text-body-sm text-fg outline-none placeholder:text-fg-ghost [&::-webkit-search-cancel-button]:hidden",
          inputClassName,
        )}
        {...props}
      />
      {trailing}
    </label>
  );
}
