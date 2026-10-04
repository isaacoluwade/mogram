"use client";

import { Toaster as Sonner } from "sonner";

/** Toasts in Eden's popover style. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      theme="dark"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-label text-fg shadow-popover",
          title: "font-medium",
          description: "text-caption text-fg-muted",
          actionButton:
            "ml-auto rounded-full bg-accent px-3 py-1 text-caption font-medium text-fg-inverse",
          cancelButton: "rounded-full bg-fill-button px-3 py-1 text-caption text-fg-soft",
          error: "border-rose-line",
          success: "border-green-line",
        },
      }}
    />
  );
}
