"use client";

import { memo, useRef } from "react";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { connectionAnimates, connectionFrame, progressAt, type FlowLayer } from "../frames";
import type { SceneConnection } from "../scene";
import { measure } from "../text";
import { actionProps, focusOpacity, useRender } from "./render-context";

interface Refs {
  line: SVGPathElement | null;
  start: SVGPathElement | null;
  end: SVGPathElement | null;
  cross: SVGGElement | null;
  fromDots: SVGPathElement | null;
  fromReverse: SVGPathElement | null;
  toDots: SVGPathElement | null;
  toReverse: SVGPathElement | null;
}

function setDots(path: SVGPathElement | null, layer: FlowLayer, reverse: boolean): void {
  if (path === null) return;
  const offset = reverse ? layer.reverseOffset : layer.offset;
  path.setAttribute("stroke-dasharray", `0 ${layer.spacing}`);
  path.setAttribute("stroke-dashoffset", String(offset ?? 0));
  path.setAttribute("opacity", String(reverse && layer.reverseOffset === null ? 0 : layer.opacity));
}

/** Dots that follow the traffic a connection carries (D-82): denser with more, fading out with none. */
function withTraffic(layer: FlowLayer, traffic: number): FlowLayer {
  const scale = Math.min(3, Math.max(0.45, Math.sqrt(traffic)));
  const spacing = layer.spacing / scale;
  const ratio = spacing / layer.spacing;
  return {
    ...layer,
    spacing,
    offset: layer.offset * ratio,
    reverseOffset: layer.reverseOffset === null ? null : layer.reverseOffset * ratio,
    opacity: layer.opacity * Math.min(1, traffic / 0.08),
  };
}

/** The line's dash pattern: the author's, else the flow's own dashes (blocked, idle…). */
function dashArray(dash: readonly number[] | null, flowDashed: boolean): string | undefined {
  if (dash !== null) return dash.map((value) => Math.round(value * 100) / 100).join(" ");
  return flowDashed ? "6 6" : undefined;
}

/** A connection with traffic flowing along its routed path (PR-2, PR-7). */
export const ConnectionNode = memo(function ConnectionNode({
  connection,
}: {
  connection: SceneConnection;
}) {
  const settings = useRender();
  const { theme, fontFamily, transitionStart, transitionSeconds, mode } = settings;
  const source = useTimeSource();
  const now = currentTime(source);
  const transitioning = transitionStart !== null && now - transitionStart < transitionSeconds + 0.1;
  const timeline = connection.carries ? (settings.capacity?.timeline ?? null) : null;
  const frameAt = (t: number) => {
    const base = connectionFrame(
      connection,
      theme,
      t,
      progressAt(t, transitionStart, transitionSeconds),
    );
    if (timeline === null) return base;
    const traffic = timeline.carried(connection.name, t);
    return { ...base, from: withTraffic(base.from, traffic), to: withTraffic(base.to, traffic) };
  };
  const frame = frameAt(now);
  const refs = useRef<Refs>({
    line: null,
    start: null,
    end: null,
    cross: null,
    fromDots: null,
    fromReverse: null,
    toDots: null,
    toReverse: null,
  }).current;

  useFrame(connectionAnimates(connection, transitioning), (t) => {
    const next = frameAt(t);
    refs.line?.setAttribute("stroke", next.lineColor);
    refs.line?.setAttribute("stroke-opacity", String(next.lineOpacity));
    refs.line?.setAttribute("stroke-dasharray", dashArray(look.dash, next.dashed) ?? "none");
    for (const [marker, node] of [
      [look.start, refs.start],
      [look.end, refs.end],
    ] as const) {
      if (node === null || marker === null) continue;
      node.setAttribute("stroke", next.lineColor);
      if (marker.shape.filled) node.setAttribute("fill", next.lineColor);
      node.setAttribute("stroke-opacity", String(Math.min(1, next.lineOpacity + 0.25)));
      node.setAttribute("fill-opacity", String(Math.min(1, next.lineOpacity + 0.25)));
    }
    refs.cross?.setAttribute("opacity", String(next.crossOpacity));
    setDots(refs.fromDots, next.from, false);
    setDots(refs.fromReverse, next.from, true);
    setDots(refs.toDots, next.to, false);
    setDots(refs.toReverse, next.to, true);
  });

  const d = connection.path.d;
  const look = connection.look;
  const mid = connection.labelAt;
  const labelWidth = connection.label === null ? 0 : measure(connection.label, 11, 500) + 16;
  const dots = (layer: FlowLayer, reverse: boolean, ref: (node: SVGPathElement | null) => void) => (
    <path
      ref={ref}
      d={look.lineD}
      fill="none"
      stroke={layer.color}
      strokeWidth={Math.max(4.5, look.width * 2.2)}
      strokeLinecap="round"
      strokeDasharray={`0 ${layer.spacing}`}
      strokeDashoffset={(reverse ? layer.reverseOffset : layer.offset) ?? 0}
      opacity={reverse && layer.reverseOffset === null ? 0 : layer.opacity}
    />
  );

  return (
    <g
      data-element={connection.name}
      data-kind="connection"
      {...actionProps(settings, connection.label ?? "Connection", connection.hasCard)}
      opacity={focusOpacity(settings, connection.name)}
      style={{ transition: "opacity 400ms ease" }}
    >
      {mode !== "export" ? (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(14, look.width + 10)}
          data-hit="connection"
        />
      ) : null}
      <path
        ref={(node) => void (refs.line = node)}
        d={look.lineD}
        fill="none"
        stroke={frame.lineColor}
        strokeOpacity={frame.lineOpacity}
        strokeWidth={look.width}
        strokeDasharray={dashArray(look.dash, frame.dashed)}
        strokeLinecap={look.dash !== null ? "butt" : "round"}
        strokeLinejoin="round"
        data-part="line"
      />
      {dots(frame.from, false, (node) => void (refs.fromDots = node))}
      {dots(frame.from, true, (node) => void (refs.fromReverse = node))}
      {dots(frame.to, false, (node) => void (refs.toDots = node))}
      {dots(frame.to, true, (node) => void (refs.toReverse = node))}
      {[look.start, look.end].map((marker, index) =>
        marker === null ? null : (
          <path
            key={index === 0 ? "start" : "end"}
            ref={(node) => void (index === 0 ? (refs.start = node) : (refs.end = node))}
            data-part={index === 0 ? "start-arrow" : "end-arrow"}
            d={marker.shape.d}
            transform={marker.transform}
            fill={
              marker.shape.filled ? frame.lineColor : marker.shape.knockout ? theme.base : "none"
            }
            fillOpacity={marker.shape.filled ? Math.min(1, frame.lineOpacity + 0.25) : 1}
            stroke={frame.lineColor}
            strokeOpacity={Math.min(1, frame.lineOpacity + 0.25)}
            strokeWidth={look.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      <g
        ref={(node) => void (refs.cross = node)}
        opacity={frame.crossOpacity}
        transform={`translate(${mid.x} ${mid.y})`}
      >
        <circle r={9} fill={theme.base} stroke={frame.crossColor} strokeWidth={1.3} />
        <path
          d="M-3.2 -3.2l6.4 6.4M3.2 -3.2l-6.4 6.4"
          stroke={frame.crossColor}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
      {connection.label !== null ? (
        <g
          data-part="label"
          data-x={mid.x}
          data-y={mid.y}
          transform={`translate(${mid.x} ${mid.y - (frame.crossOpacity > 0.5 ? 20 : 0)})`}
          style={mode === "edit" ? { cursor: "move" } : undefined}
        >
          <rect
            x={-labelWidth / 2}
            y={-10}
            width={labelWidth}
            height={20}
            rx={10}
            fill={theme.base}
            stroke={theme.tileBorder}
          />
          <text
            y={4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill={theme.textMuted}
            style={{ fontFamily }}
          >
            {connection.label}
          </text>
        </g>
      ) : null}
    </g>
  );
});
