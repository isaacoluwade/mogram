"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when the label is an icon. */
  ariaLabel?: string;
}

/**
 * Eden's segmented control: a soft track with a sliding thumb (300ms, Eden's curve).
 * Radio-group semantics with arrow-key navigation.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  /** Null shows nothing pressed (a mixed selection); the first option takes keyboard focus. */
  value: T | null;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const node = value === null ? undefined : refs.current.get(value);
    setThumb(node === undefined ? null : { left: node.offsetLeft, width: node.offsetWidth });
  }, [value, options]);

  const move = (direction: 1 | -1) => {
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + direction + options.length) % options.length];
    if (next !== undefined) {
      onChange(next.value);
      refs.current.get(next.value)?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full bg-fill-track p-1",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {thumb !== null ? (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-fill-active ring-1 ring-border ring-inset transition-[left,width] duration-300 ease-thumb"
          style={{ left: thumb.left, width: thumb.width }}
        />
      ) : null}
      {options.map((option, index) => {
        const selected = option.value === value;
        const focusable = selected || (value === null && index === 0);
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node === null) refs.current.delete(option.value);
              else refs.current.set(option.value, node);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-200 [&_svg]:size-3.5",
              // Touch screens get 32px targets.
              size === "sm"
                ? "h-6 px-2.5 text-micro pointer-coarse:h-8 pointer-coarse:px-3"
                : "h-7 px-3 text-caption pointer-coarse:h-8",
              selected ? "text-fg-strong" : "text-fg-faint hover:text-fg-soft",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
