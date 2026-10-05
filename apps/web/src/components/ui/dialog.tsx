"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const TABBABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Eden modal: solid card, 24px radius, hairline border, deep shadow, Geist title. */
export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  hideClose = false,
  onOpenAutoFocus,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  hideClose?: boolean;
}) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;
  const content = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-popover animate-pop-in focus:outline-none",
          widths[size],
          className,
        )}
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
        {...props}
        ref={content}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          // Start in the dialog's own content (a form's first field), not on the close button;
          // with nothing to operate, focus the dialog itself so no ring flashes on the X.
          event.preventDefault();
          const first = body.current?.querySelector<HTMLElement>(TABBABLE);
          (first ?? content.current)?.focus();
        }}
      >
        <div className="flex items-start gap-4 px-6 pb-2 pt-6">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="font-display text-heading font-medium tracking-title text-fg">
              {title}
            </DialogPrimitive.Title>
            {description !== undefined ? (
              <DialogPrimitive.Description className="mt-1 text-body-sm text-fg-secondary">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {hideClose ? null : (
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 -mt-1 flex size-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fill-hover hover:text-fg"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Actions stay pinned to the bottom of the dialog while its body scrolls (short screens). Sticky
 * offsets count from inside the body's padding, so `-bottom-6` cancels its `pb-6`: with
 * `bottom-0` the footer rode 24px up over the space above it, leaving that space under it.
 */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky -bottom-6 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border-muted bg-card px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}
