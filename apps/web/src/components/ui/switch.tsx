"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-fill-strong p-0.5 transition-colors duration-200 data-[state=checked]:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-fg shadow-panel transition-transform duration-200 ease-thumb data-[state=checked]:translate-x-4 data-[state=checked]:bg-fg-inverse" />
    </SwitchPrimitive.Root>
  );
}
