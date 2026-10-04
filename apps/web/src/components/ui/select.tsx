"use client";

import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

/** A compact select styled like Eden's filter pill. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next);
        if (option !== undefined) onChange(option.value);
      }}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          "inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-fill-field px-2.5 text-label text-fg outline-none transition-colors hover:bg-fill-hover focus-visible:ring-1 focus-visible:ring-border-emphasis disabled:opacity-50 [&_svg]:size-3.5",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="text-fg-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-popover animate-pop-in"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-default select-none items-center gap-2.5 rounded-md py-1.5 pl-2 pr-7 text-label text-fg-soft outline-none data-[highlighted]:bg-menu-active data-[highlighted]:text-fg [&_svg]:size-4"
              >
                {option.icon}
                <span className="flex min-w-0 flex-col">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.description !== undefined ? (
                    <span className="text-micro text-fg-muted">{option.description}</span>
                  ) : null}
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="text-fg" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
