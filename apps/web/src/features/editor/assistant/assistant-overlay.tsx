"use client";

import type { LayoutResult } from "@mogram/core/layout";
import { TONES } from "@mogram/core/presets";
import type { RoutedPath } from "@mogram/core/routing";
import type { CanvasTheme } from "@/features/canvas/theme";
import { useEditor } from "../editor-context";

const NONE: readonly string[] = [];

/**
 * While the assistant works, what it has added or changed so far glows violet on the canvas, so
 * the person can see where it's working (A4).
 */
export function AssistantOverlay({
  layout,
  routes,
  theme,
  zoom,
}: {
  layout: LayoutResult;
  routes: ReadonlyMap<string, RoutedPath>;
  theme: CanvasTheme;
  zoom: number;
}) {
  const touched = useEditor((s) => s.assistant?.touched ?? NONE);
  if (touched.length === 0) return null;
  const color = TONES.violet[theme.mode].solid;
  const px = (value: number) => value / zoom;
  return (
    <g data-overlay="assistant" pointerEvents="none" className="animate-pulse">
      {touched.map((name) => {
        const route = routes.get(name);
        if (route !== undefined)
          return (
            <path
              key={name}
              data-name={name}
              d={route.d}
              fill="none"
              stroke={color}
              strokeOpacity={0.45}
              strokeWidth={px(7)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        const box = layout.elements.get(name)?.box ?? layout.groups.get(name);
        if (box === undefined) return null;
        const pad = px(5);
        return (
          <rect
            key={name}
            data-name={name}
            x={box.x - pad}
            y={box.y - pad}
            width={box.w + pad * 2}
            height={box.h + pad * 2}
            rx={14}
            fill={color}
            fillOpacity={0.08}
            stroke={color}
            strokeWidth={px(2)}
          />
        );
      })}
    </g>
  );
}
