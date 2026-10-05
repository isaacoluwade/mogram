"use client";

import { paintCss, type Paint } from "@mogram/core/presets";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** The checkerboard behind see-through colours, so opacity is visible. */
export const CHECKERBOARD =
  "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 8px 8px";

/**
 * What a swatch shows: the paint over a checkerboard, or the "none" mark (a red slash). The paint
 * covers the whole swatch once (no tiling), and the swatch's outline is an inset ring drawn over
 * it rather than a border it would repeat under: a gradient's far end showing in the rim read as
 * a second shape inside the circle.
 */
export function swatchBackground(paint: Paint | null): string {
  if (paint === null) {
    return "linear-gradient(135deg, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)) no-repeat border-box, #ffffff";
  }
  const layer =
    paint.kind === "solid" ? `linear-gradient(${paint.color}, ${paint.color})` : paintCss(paint);
  return `${layer} no-repeat border-box, ${CHECKERBOARD}`;
}

export const swatchVariants = cva(
  "relative shrink-0 rounded-full inset-ring inset-ring-border-strong outline-none transition-[box-shadow,transform] focus-visible:ring-2 focus-visible:ring-border-emphasis focus-visible:ring-offset-2 focus-visible:ring-offset-card hover:scale-105",
  {
    variants: {
      size: { sm: "size-6", md: "size-8", lg: "size-9" },
      selected: {
        true: "ring-2 ring-fg ring-offset-2 ring-offset-card",
        false: "",
      },
    },
    defaultVariants: { size: "md", selected: false },
  },
);

/** A round colour (or gradient) button; `name` is its accessible name and tooltip. */
export const Swatch = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<"button">, "children"> &
    VariantProps<typeof swatchVariants> & { paint: Paint | null; name: string }
>(function Swatch({ paint, name, size, selected, className, style, type, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={name}
      title={name}
      aria-pressed={selected === true || undefined}
      className={cn(swatchVariants({ size, selected }), className)}
      style={{ background: swatchBackground(paint), ...style }}
      {...props}
    />
  );
});

/** A swatch to show inside another control (a picker's trigger button): not itself focusable. */
export function SwatchFace({ paint, className }: { paint: Paint | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-6 shrink-0 rounded-sm inset-ring inset-ring-border-strong", className)}
      style={{ background: swatchBackground(paint) }}
    />
  );
}
