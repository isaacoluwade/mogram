import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Eden badge: 12% tint, 35–45% border, full-strength text. */
export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium tabular-nums tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-fill-subtle text-fg-secondary",
        green: "border-green-line bg-green-fill text-green",
        amber: "border-amber-line bg-amber-fill text-amber",
        orange: "border-orange-line bg-orange-fill text-orange",
        rose: "border-rose-line bg-rose-fill text-rose",
        violet: "border-violet-line bg-violet-fill text-violet",
        solid: "border-transparent bg-accent text-fg-inverse",
      },
      size: {
        sm: "px-1.5 py-px text-[0.66rem]",
        md: "px-2 py-0.5 text-micro",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
