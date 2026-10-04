"use client";

import { memo, useRef } from "react";
import { pointAtLength } from "@mogram/core/routing";
import { SCENE_TRANSITION } from "@mogram/core/timeline";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { connectionAnimates, connectionFrame, progressAt, type FlowLayer } from "../frames";
import type { SceneConnection } from "../scene";
import { measure } from "../text";
import { actionProps, focusOpacity, useRender } from "./render-context";

interface Refs {
  line: SVGPathElement | null;
  arrow: SVGPathElement | null;
  cross: SVGGElement | null;
  fromDots: SVGPathElement | null;
  fromReverse: SVGPathElement | null;
  toDots: SVGPathElement | null;
  toReverse: SVGPathElement | null;
}

function setDots(path: SVGPathElement | null, layer: FlowLayer, reverse: boolean): void {
  if (path === null) return;
  const offset = reverse ? layer.reverseOffset : layer.offset;
  path.setAttribute("stroke-dashoffset", String(offset ?? 0));
  path.setAttribute("opacity", String(reverse && layer.reverseOffset === null ? 0 : layer.opacity));
}

/** Arrowhead at the end of the path, pointing along the final segment. */
function arrowPath(connection: SceneConnection): string {
  const samples = connection.path.samples;
  const end = samples[samples.length - 1];
  if (end === undefined || samples.length < 2) return "";
  const back = pointAtLength(samples, Math.max(0, connection.path.length - 6)).point;
  const angle = Math.atan2(end.y - back.y, end.x - back.x);
  const size = 7;
  const left = {
    x: end.x - size * Math.cos(angle - 0.45),
    y: end.y - size * Math.sin(angle - 0.45),
  };
  const right = {
    x: end.x - size * Math.cos(angle + 0.45),
    y: end.y - size * Math.sin(angle + 0.45),
  };
  return `M${left.x} ${left.y} L${end.x} ${end.y} L${right.x} ${right.y}`;
}

/** A connection with traffic flowing along its routed path (PR-2, PR-7). */
export const ConnectionNode = memo(function ConnectionNode({
  connection,
}: {
  connection: SceneConnection;
}) {
  const settings = useRender();
  const { theme, fontFamily, transitionStart, mode } = settings;
  const source = useTimeSource();
  const now = currentTime(source);
  const transitioning = transitionStart !== null && now - transitionStart < SCENE_TRANSITION + 0.1;
  const frame = connectionFrame(connection, theme, now, progressAt(now, transitionStart));
  const refs = useRef<Refs>({
    line: null,
    arrow: null,
    cross: null,
    fromDots: null,
    fromReverse: null,
    toDots: null,
    toReverse: null,
  }).current;

  useFrame(connectionAnimates(connection, transitioning), (t) => {
    const next = connectionFrame(connection, theme, t, progressAt(t, transitionStart));
    refs.line?.setAttribute("stroke", next.lineColor);
    refs.line?.setAttribute("stroke-opacity", String(next.lineOpacity));
    refs.line?.setAttribute("stroke-dasharray", next.dashed ? "6 6" : "none");
    refs.arrow?.setAttribute("stroke", next.lineColor);
    refs.arrow?.setAttribute("stroke-opacity", String(Math.min(1, next.lineOpacity + 0.25)));
    refs.cross?.setAttribute("opacity", String(next.crossOpacity));
    setDots(refs.fromDots, next.from, false);
    setDots(refs.fromReverse, next.from, true);
    setDots(refs.toDots, next.to, false);
    setDots(refs.toReverse, next.to, true);
  });

  const d = connection.path.d;
  const mid = connection.labelAt;
  const labelWidth = connection.label === null ? 0 : measure(connection.label, 11, 500) + 16;
  const dots = (layer: FlowLayer, reverse: boolean, ref: (node: SVGPathElement | null) => void) => (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={layer.color}
      strokeWidth={4.5}
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
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} data-hit="connection" />
      ) : null}
      <path
        ref={(node) => void (refs.line = node)}
        d={d}
        fill="none"
        stroke={frame.lineColor}
        strokeOpacity={frame.lineOpacity}
        strokeWidth={1.6}
        strokeDasharray={frame.dashed ? "6 6" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        ref={(node) => void (refs.arrow = node)}
        d={arrowPath(connection)}
        fill="none"
        stroke={frame.lineColor}
        strokeOpacity={Math.min(1, frame.lineOpacity + 0.25)}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dots(frame.from, false, (node) => void (refs.fromDots = node))}
      {dots(frame.from, true, (node) => void (refs.fromReverse = node))}
      {dots(frame.to, false, (node) => void (refs.toDots = node))}
      {dots(frame.to, true, (node) => void (refs.toReverse = node))}
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
        <g transform={`translate(${mid.x} ${mid.y - (frame.crossOpacity > 0.5 ? 20 : 0)})`}>
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
