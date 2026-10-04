"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./tooltip";

export const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center text-fg-soft transition-colors duration-150 hover:bg-fill-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40 data-[active=true]:bg-fill-active data-[active=true]:text-fg [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "size-7 rounded-sm [&_svg]:size-[15px]",
        md: "size-8 rounded-md [&_svg]:size-4",
        lg: "size-10 rounded-lg [&_svg]:size-[18px]",
      },
      shape: {
        square: "",
        round: "rounded-full",
        dashed: "rounded-full border border-dashed border-border-strong text-fg-secondary",
        outline: "rounded-full border border-border-strong bg-raised",
      },
    },
    defaultVariants: { size: "md", shape: "square" },
  },
);

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Accessible name, also shown as the tooltip. Required: icon-only buttons need both. */
    label: string;
    shortcut?: string;
    active?: boolean;
    tooltipSide?: "top" | "right" | "bottom" | "left";
  };

export function IconButton({
  label,
  shortcut,
  active,
  size,
  shape,
  tooltipSide,
  className,
  type,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip
      content={label}
      {...(shortcut !== undefined ? { shortcut } : {})}
      {...(tooltipSide !== undefined ? { side: tooltipSide } : {})}
    >
      <button
        type={type ?? "button"}
        aria-label={label}
        data-active={active === true ? "true" : undefined}
        aria-pressed={active}
        className={cn(iconButtonVariants({ size, shape }), className)}
        {...props}
      />
    </Tooltip>
  );
}

/** Icon-only navigation link with the same look and a required label/tooltip. */
export function IconLink({
  href,
  label,
  children,
  size,
  shape,
  tooltipSide,
  className,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  size?: VariantProps<typeof iconButtonVariants>["size"];
  shape?: VariantProps<typeof iconButtonVariants>["shape"];
  tooltipSide?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <Tooltip content={label} {...(tooltipSide !== undefined ? { side: tooltipSide } : {})}>
      <Link
        href={href as Route}
        aria-label={label}
        className={cn(iconButtonVariants({ size, shape }), className)}
      >
        {children}
      </Link>
    </Tooltip>
  );
}
