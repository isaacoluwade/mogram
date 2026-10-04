import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Eden's floating app surface (the sidebar in Eden's app): #171717, white/10 border, 12px radius,
 * soft shadow. Used for every piece of editor chrome that floats over the canvas.
 */
export const panelVariants = cva(
  "border border-white/10 bg-sidebar/95 text-fg shadow-panel backdrop-blur-xl",
  {
    variants: {
      shape: {
        card: "rounded-lg",
        pill: "rounded-full",
      },
    },
    defaultVariants: { shape: "card" },
  },
);

export type PanelProps = ComponentProps<"div"> & VariantProps<typeof panelVariants>;

export function Panel({ className, shape, ...props }: PanelProps) {
  return <div className={cn(panelVariants({ shape }), className)} {...props} />;
}

/** Panel header row: title on the left, actions on the right. */
export function PanelHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b border-border-muted px-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "min-w-0 flex-1 truncate font-display text-body font-medium tracking-snug text-fg-strong",
        className,
      )}
      {...props}
    />
  );
}

/** Vertical divider between toolbar groups. */
export function ToolbarDivider({ className }: { className?: string }) {
  return <span aria-hidden className={cn("mx-1 h-5 w-px shrink-0 bg-border-muted", className)} />;
}
