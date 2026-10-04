import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Eden's button hierarchy: one white gradient pill per view (primary), soft filled pills
 * (secondary), hairline pills (outline), text buttons (ghost).
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium tracking-snug no-underline transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.05em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-b from-white to-[#e8e8e8] tracking-display text-fg-inverse shadow-pill hover:-translate-y-0.5 hover:from-white hover:to-white hover:shadow-pill-hover active:translate-y-0",
        secondary: "bg-fill-button text-fg-soft hover:bg-fill-active hover:text-fg",
        outline:
          "border border-border-strong bg-raised text-fg hover:border-border-emphasis hover:bg-surface",
        ghost: "text-fg-secondary hover:bg-fill-hover hover:text-fg",
        danger: "bg-rose-fill text-rose ring-1 ring-rose-line ring-inset hover:bg-rose-line/40",
      },
      size: {
        sm: "h-8 px-3 text-caption",
        md: "h-9 px-4 text-label",
        lg: "h-11 px-5 text-body",
        xl: "h-12 px-7 text-body-lg",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Link) with button styling. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
