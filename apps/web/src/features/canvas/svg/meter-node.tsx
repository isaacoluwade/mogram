"use client";

import { memo, useRef } from "react";
import { currentTime, useFrame, useTimeSource } from "../clock";
import type { SceneComponent, SceneMeter } from "../scene";
import { ellipsize } from "../text";
import { tone, type CanvasTheme } from "../theme";
import { MarkBadge } from "./glyphs";
import { actionProps, focusOpacity, useRender } from "./render-context";

/** A value as a meter writes it: whole when it is, one place otherwise. */
function written(value: number, unit: string): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

/**
 * The colour a value gets from the meter's limit: red at it, amber near it. A limit in the top
 * half of the range is something not to reach (load); one in the bottom half, something not to
 * fall to (a budget left).
 */
function colourFor(meter: SceneMeter, value: number, theme: CanvasTheme): string {
  const calm = tone("green", theme.mode).solid;
  if (meter.limit === null) return tone("blue", theme.mode).solid;
  const high = meter.limit >= meter.max / 2;
  const near = meter.max * 0.15;
  const past = high ? value >= meter.limit : value <= meter.limit;
  const close = high ? value >= meter.limit - near : value <= meter.limit + near;
  return past ? tone("rose", theme.mode).solid : close ? tone("amber", theme.mode).solid : calm;
}

const RING = { r: 13, width: 4 } as const;
const CIRCUMFERENCE = 2 * Math.PI * RING.r;

interface MeterRefs {
  fill: SVGRectElement | null;
  arc: SVGCircleElement | null;
  text: SVGTextElement | null;
}

/**
 * A meter (D-88): a value against a most, as a bar, a ring (a timer) or a number. When the step
 * showing runs the value from one number to another, the meter moves with it, evenly, for as
 * long as the step lasts.
 */
export const MeterNode = memo(function MeterNode({ component }: { component: SceneComponent }) {
  const settings = useRender();
  const { theme, fontFamily, ramp } = settings;
  const source = useTimeSource();
  const refs = useRef<MeterRefs>({ fill: null, arc: null, text: null }).current;
  const meter = component.meter;
  const now = currentTime(source);
  const valueAt = (t: number): number => {
    if (meter === null) return 0;
    if (ramp === null || meter.value.from === meter.value.to) return meter.value.to;
    const p = Math.min(1, Math.max(0, (t - ramp.start) / Math.max(0.01, ramp.seconds)));
    return meter.value.from + (meter.value.to - meter.value.from) * p;
  };
  const { box } = component;
  const pad = 10;
  const barWidth = Math.max(8, box.w - pad * 2);
  const share = (value: number): number =>
    meter === null ? 0 : Math.min(1, Math.max(0, value / meter.max));
  const running =
    meter !== null &&
    ramp !== null &&
    meter.value.from !== meter.value.to &&
    now < ramp.start + ramp.seconds + 0.1;

  useFrame(running, (t) => {
    if (meter === null) return;
    const value = valueAt(t);
    const colour = colourFor(meter, value, theme);
    refs.fill?.setAttribute("width", String(barWidth * share(value)));
    refs.fill?.setAttribute("fill", colour);
    refs.arc?.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE * (1 - share(value))));
    refs.arc?.setAttribute("stroke", colour);
    if (refs.text !== null) refs.text.textContent = written(value, meter.unit);
  });

  if (meter === null || component.shape === null) return null;
  const value = valueAt(now);
  const colour = colourFor(meter, value, theme);
  const label = component.label;
  const text = { fontFamily } as const;

  return (
    <g
      data-element={component.name}
      data-kind="component"
      data-shape="meter"
      data-value={Math.round(meter.value.to * 100) / 100}
      {...actionProps(settings, `${label}: ${written(meter.value.to, meter.unit)}`, false)}
      opacity={focusOpacity(settings, component.name)}
      style={{ transition: "opacity 400ms ease" }}
    >
      <g transform={`translate(${box.x} ${box.y})`}>
        <rect
          width={box.w}
          height={box.h}
          rx={Math.min(10, box.h / 2)}
          fill={theme.tile}
          stroke={component.shape.stroke ?? theme.tileBorder}
          strokeWidth={1}
        />
        {meter.as === "bar" ? (
          <>
            <text x={pad} y={box.h / 2 - 3} fontSize={11} fill={theme.textMuted} style={text}>
              {ellipsize(label, Math.max(20, box.w - pad * 2 - 46), 11, 500)}
            </text>
            <text
              ref={(node) => void (refs.text = node)}
              x={box.w - pad}
              y={box.h / 2 - 3}
              textAnchor="end"
              fontSize={12}
              fontWeight={600}
              fill={theme.text}
              style={{ ...text, fontVariantNumeric: "tabular-nums" }}
            >
              {written(value, meter.unit)}
            </text>
            <rect
              x={pad}
              y={box.h / 2 + 4}
              width={barWidth}
              height={6}
              rx={3}
              fill={theme.tileBorder}
            />
            <rect
              ref={(node) => void (refs.fill = node)}
              data-part="meter-fill"
              x={pad}
              y={box.h / 2 + 4}
              width={barWidth * share(value)}
              height={6}
              rx={3}
              fill={colour}
            />
          </>
        ) : meter.as === "ring" ? (
          <>
            <g transform={`translate(${pad + RING.r + 2} ${box.h / 2})`}>
              <circle r={RING.r} fill="none" stroke={theme.tileBorder} strokeWidth={RING.width} />
              <circle
                ref={(node) => void (refs.arc = node)}
                data-part="meter-fill"
                r={RING.r}
                fill="none"
                stroke={colour}
                strokeWidth={RING.width}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - share(value))}
                transform="rotate(-90)"
              />
            </g>
            <text
              ref={(node) => void (refs.text = node)}
              x={pad + RING.r * 2 + 14}
              y={box.h / 2 - 2}
              fontSize={14}
              fontWeight={600}
              fill={theme.text}
              style={{ ...text, fontVariantNumeric: "tabular-nums" }}
            >
              {written(value, meter.unit)}
            </text>
            <text
              x={pad + RING.r * 2 + 14}
              y={box.h / 2 + 13}
              fontSize={11}
              fill={theme.textMuted}
              style={text}
            >
              {ellipsize(label, Math.max(20, box.w - pad * 2 - RING.r * 2 - 16), 11, 500)}
            </text>
          </>
        ) : (
          <>
            <text
              ref={(node) => void (refs.text = node)}
              x={box.w / 2}
              y={box.h / 2 + 2}
              textAnchor="middle"
              fontSize={Math.min(26, box.h * 0.5)}
              fontWeight={600}
              fill={colour}
              style={{ ...text, fontVariantNumeric: "tabular-nums" }}
            >
              {written(value, meter.unit)}
            </text>
            <text
              x={box.w / 2}
              y={box.h - 8}
              textAnchor="middle"
              fontSize={11}
              fill={theme.textMuted}
              style={text}
            >
              {ellipsize(label, Math.max(20, box.w - pad * 2), 11, 500)}
            </text>
          </>
        )}
        {component.mark !== null ? (
          <MarkBadge
            mark={component.mark}
            mode={theme.mode}
            muted={theme.textMuted}
            background={theme.base}
            x={2}
            y={2}
          />
        ) : null}
      </g>
    </g>
  );
});
