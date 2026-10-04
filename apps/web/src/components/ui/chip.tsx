import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Eden filter chip: hairline idle, filled active, dashed "add". */
export const chipVariants = cva(
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-micro font-medium transition-colors duration-150 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      state: {
        idle: "border-border-muted bg-fill-faint text-fg-dim hover:border-border-strong hover:text-fg-soft",
        active: "border-fill-strong bg-fill-active text-fg-strong shadow-chip-active",
        add: "border-dashed border-border-strong bg-transparent text-fg-ghost hover:text-fg-soft",
      },
    },
    defaultVariants: { state: "idle" },
  },
);

export type ChipProps = ComponentProps<"button"> &
  VariantProps<typeof chipVariants> & { selected?: boolean };

export function Chip({ className, state, selected, type, ...props }: ChipProps) {
  const resolved = state ?? (selected === true ? "active" : "idle");
  return (
    <button
      type={type ?? "button"}
      aria-pressed={selected}
      className={cn(chipVariants({ state: resolved }), className)}
      {...props}
    />
  );
}
