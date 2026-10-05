"use client";

import type { CSSProperties } from "react";
import { setPreference, usePreference } from "@/lib/preferences";
import { PANEL } from "./panel-sizes";

export const RIGHT_MIN = 280;
export const RIGHT_MAX = 420;

const clampWidth = (width: number): number =>
  Math.round(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, width)));

/**
 * The inspector and tours panel's width (04-format-panel §16.8): 316 px by default, 280–420 px
 * by dragging its left edge, remembered in this browser. Applied by overriding the panel tokens
 * on the editor, so everything placed against the panel moves with it.
 */
export function useRightPanelWidth(): {
  width: number;
  setWidth: (width: number) => void;
  style: CSSProperties;
} {
  const stored = usePreference("rightPanelWidth");
  const width = stored === null ? PANEL.right : clampWidth(stored);
  return {
    width,
    setWidth: (next) => setPreference("rightPanelWidth", clampWidth(next)),
    style: {
      ["--spacing-panel-right" as string]: `${width}px`,
      ["--spacing-clear-right" as string]: `${width + PANEL.edge * 2}px`,
    },
  };
}

/** A grip on the panel's left edge: drag to resize, double-click for the default width. */
export function RightPanelGrip({
  width,
  onResize,
}: {
  width: number;
  onResize: (width: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuemin={RIGHT_MIN}
      aria-valuemax={RIGHT_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize. Double-click for the default width."
      className="group absolute inset-y-3 -left-1.5 z-10 w-3 cursor-col-resize touch-none outline-none max-md:hidden"
      onPointerDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        const node = event.currentTarget;
        node.setPointerCapture(event.pointerId);
        const move = (e: PointerEvent) => onResize(startWidth + (startX - e.clientX));
        const up = () => {
          node.removeEventListener("pointermove", move);
          node.removeEventListener("pointerup", up);
          node.removeEventListener("pointercancel", up);
        };
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerup", up);
        node.addEventListener("pointercancel", up);
      }}
      onDoubleClick={() => onResize(PANEL.right)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onResize(width + 8);
        if (event.key === "ArrowRight") onResize(width - 8);
      }}
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover:bg-border-emphasis group-focus-visible:bg-border-emphasis" />
    </div>
  );
}
