"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  content: ReactNode;
  /** Keyboard shortcut shown beside the label, e.g. "V" or "⌘Z". */
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: ReactNode;
}

/** Dark pill tooltip used on every icon-only control. */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  align = "center",
  children,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            "z-50 flex items-center gap-2 rounded-sm border border-border bg-raised px-2 py-1 text-caption font-medium text-fg shadow-popover",
            "animate-fade-in",
          )}
        >
          {content}
          {shortcut !== undefined ? <Kbd>{shortcut}</Kbd> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
