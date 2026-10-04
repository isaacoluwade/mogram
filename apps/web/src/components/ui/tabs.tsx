"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

/** Tab rows get arrow-key movement and the tab roles from Radix; only the look is ours. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex items-center gap-1", className)} {...props} />;
}

const triggerVariants = cva("font-medium transition-colors", {
  variants: {
    variant: {
      /** Eden's underline tabs ("Posts | Ads"): active white with a 2px bar, inactive muted. */
      underline: [
        "relative px-3 pb-2.5 pt-1 text-label text-fg-muted hover:text-fg-secondary data-[state=active]:text-fg",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors data-[state=active]:after:bg-fg",
      ],
      /** Compact filled tabs, for file names in a panel. */
      pill: "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-caption text-fg-faint hover:bg-fill-hover hover:text-fg-soft data-[state=active]:bg-fill-active data-[state=active]:text-fg",
    },
  },
  defaultVariants: { variant: "underline" },
});

export function TabsTrigger({
  className,
  variant,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger> & VariantProps<typeof triggerVariants>) {
  return (
    <TabsPrimitive.Trigger className={cn(triggerVariants({ variant }), className)} {...props} />
  );
}
