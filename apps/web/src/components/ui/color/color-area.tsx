"use client";

import type { Hsv } from "@mogram/core/presets";
import type { KeyboardEvent, PointerEvent } from "react";
import { cn } from "@/lib/cn";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function keyStep(event: KeyboardEvent): number {
  return event.shiftKey ? 0.1 : 0.01;
}

/**
 * The saturation (across) and brightness (up) square of a colour editor. Dragging reports
 * `live` changes; letting go reports the final one. Arrow keys move by 1% (10% with Shift).
 */
export function ColorArea({
  hsv,
  onChange,
  label,
}: {
  hsv: Hsv;
  onChange: (hsv: Hsv, live: boolean) => void;
  label: string;
}) {
  const pick = (event: PointerEvent<HTMLDivElement>, live: boolean) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(
      {
        h: hsv.h,
        s: clamp((event.clientX - rect.left) / rect.width),
        v: clamp(1 - (event.clientY - rect.top) / rect.height),
      },
      live,
    );
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${label}: saturation and brightness`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s * 100)}
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      className="relative h-36 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-emphasis"
      style={{
        background: `linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, hsl(${hsv.h} 100% 50%))`,
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event, true);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event, true);
      }}
      onPointerUp={(event) => pick(event, false)}
      onKeyDown={(event) => {
        const step = keyStep(event);
        const moves: Record<string, Partial<Hsv>> = {
          ArrowLeft: { s: clamp(hsv.s - step) },
          ArrowRight: { s: clamp(hsv.s + step) },
          ArrowUp: { v: clamp(hsv.v + step) },
          ArrowDown: { v: clamp(hsv.v - step) },
        };
        const move = moves[event.key];
        if (move === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        onChange({ ...hsv, ...move }, false);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-popover"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
      />
    </div>
  );
}

/**
 * A horizontal slider over a painted track (the hue rainbow, an opacity ramp). `value` runs
 * 0..1; the thumb shows `thumb` as its colour.
 */
export function ColorStrip({
  value,
  onChange,
  label,
  valueText,
  track,
  thumb,
  className,
}: {
  value: number;
  onChange: (value: number, live: boolean) => void;
  label: string;
  valueText: string;
  track: string;
  thumb: string;
  className?: string;
}) {
  const pick = (event: PointerEvent<HTMLDivElement>, live: boolean) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(clamp((event.clientX - rect.left) / rect.width), live);
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={valueText}
      className={cn(
        "relative h-3 w-full cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-emphasis",
        className,
      )}
      style={{ background: track }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event, true);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event, true);
      }}
      onPointerUp={(event) => pick(event, false)}
      onKeyDown={(event) => {
        const step = keyStep(event);
        const next =
          event.key === "ArrowLeft" || event.key === "ArrowDown"
            ? value - step
            : event.key === "ArrowRight" || event.key === "ArrowUp"
              ? value + step
              : null;
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(clamp(next), false);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-popover"
        style={{ left: `${value * 100}%`, background: thumb }}
      />
    </div>
  );
}

/** The hue rainbow, red to red. */
export const HUE_TRACK =
  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";
