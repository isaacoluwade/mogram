"use client";

import type { Box, Point } from "@mogram/core/layout";
import type { RouteStyle } from "@mogram/core/model";
import { cubicPoint, type RoutedPath } from "@mogram/core/routing";
import type { CanvasTheme } from "@/features/canvas/theme";

/**
 * Handles on a selected connection (ED-18, ED-29), after draw.io's edge handler
 * (docs/research/drawio/02-connectors.md §4): an end handle at each end (a ring when the end
 * floats, a filled dot with a cross when it is fixed to a point), a handle on every waypoint,
 * faded "add" handles between them, and on orthogonal lines a handle on each segment that slides
 * it sideways. Sizes are in screen pixels.
 */
export interface ConnectionEditInfo {
  readonly name: string;
  readonly route: RoutedPath;
  readonly style: RouteStyle;
  /** No hand-placed waypoints: the path is the router's. */
  readonly automatic: boolean;
  readonly fromFixed: boolean;
  readonly toFixed: boolean;
}

/** An end being dragged to another element (reconnecting). */
export interface LooseEnd {
  /** The end that stays put. */
  readonly from: Point;
  readonly pointer: Point;
  /** The element it would attach to, and its connection points. */
  readonly target: Box | null;
  readonly anchors: readonly Point[];
  readonly anchor: Point | null;
}

const MIN_SEGMENT = 20;

/** Where the "add a waypoint" handles go: halfway along each piece of the drawn line. */
export function addHandlePoints(route: RoutedPath): Point[] {
  if (route.kind === "curve") {
    const out: Point[] = [];
    for (let i = 0; i + 3 < route.points.length; i += 3) {
      const [p0, p1, p2, p3] = route.points.slice(i, i + 4) as [Point, Point, Point, Point];
      out.push(cubicPoint(p0, p1, p2, p3, 0.5));
    }
    return out;
  }
  return route.through.slice(1).map((b, i) => {
    const a = route.through[i] as Point;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  });
}

export function ConnectionHandles({
  info,
  theme,
  zoom,
}: {
  info: ConnectionEditInfo;
  theme: CanvasTheme;
  zoom: number;
}) {
  const px = (value: number): number => value / zoom;
  const color = theme.selection;
  const { route } = info;
  const through = route.through;
  const start = through[0];
  const end = through[through.length - 1];
  if (start === undefined || end === undefined) return null;

  const segments: { point: Point; index: number; horizontal: boolean }[] = [];
  if (info.style === "orthogonal") {
    for (let i = 0; i < route.points.length - 1; i++) {
      const a = route.points[i] as Point;
      const b = route.points[i + 1] as Point;
      if (Math.hypot(b.x - a.x, b.y - a.y) < px(MIN_SEGMENT)) continue;
      segments.push({
        point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        index: i,
        horizontal: Math.abs(b.y - a.y) <= Math.abs(b.x - a.x),
      });
    }
  }
  const waypoints = info.style === "orthogonal" ? [] : through.slice(1, -1);
  const adds = info.style === "orthogonal" ? [] : addHandlePoints(route);

  const endHandle = (point: Point, which: "from" | "to", fixed: boolean) => {
    // The far end is drawn a little larger, as draw.io does, so the two ends read apart.
    const r = px(which === "to" ? 6 : 5);
    return (
      <g key={which}>
        <circle
          data-handle="end"
          data-end={which}
          cx={point.x}
          cy={point.y}
          r={r}
          fill={fixed ? color : theme.base}
          stroke={fixed ? theme.base : color}
          strokeWidth={px(1.75)}
          pointerEvents="all"
          style={{ cursor: "move" }}
        />
        {fixed ? (
          <path
            d={`M${point.x - r * 0.45} ${point.y - r * 0.45} L${point.x + r * 0.45} ${point.y + r * 0.45} M${point.x - r * 0.45} ${point.y + r * 0.45} L${point.x + r * 0.45} ${point.y - r * 0.45}`}
            stroke={theme.base}
            strokeWidth={px(1.5)}
            strokeLinecap="round"
            pointerEvents="none"
          />
        ) : null}
      </g>
    );
  };

  return (
    <g data-connection-handles={info.name}>
      {adds.map((point, index) => (
        <circle
          key={`add${index}`}
          data-handle="add-waypoint"
          data-index={index}
          data-x={point.x}
          data-y={point.y}
          cx={point.x}
          cy={point.y}
          r={px(4.5)}
          fill={color}
          fillOpacity={0.4}
          stroke={theme.base}
          strokeWidth={px(1.25)}
          pointerEvents="all"
          style={{ cursor: "copy" }}
        />
      ))}
      {segments.map(({ point, index, horizontal }) => (
        <rect
          key={`seg${index}`}
          data-handle="segment"
          data-index={index}
          x={point.x - (horizontal ? px(7) : px(3))}
          y={point.y - (horizontal ? px(3) : px(7))}
          width={horizontal ? px(14) : px(6)}
          height={horizontal ? px(6) : px(14)}
          rx={px(3)}
          fill={color}
          fillOpacity={info.automatic ? 0.45 : 1}
          stroke={theme.base}
          strokeWidth={px(1.25)}
          pointerEvents="all"
          style={{ cursor: horizontal ? "row-resize" : "col-resize" }}
        />
      ))}
      {waypoints.map((point, index) => (
        <circle
          key={`way${index}`}
          data-handle="waypoint"
          data-index={index}
          cx={point.x}
          cy={point.y}
          r={px(5)}
          fill={color}
          stroke={theme.base}
          strokeWidth={px(1.5)}
          pointerEvents="all"
          style={{ cursor: "move" }}
        />
      ))}
      {endHandle(start, "from", info.fromFixed)}
      {endHandle(end, "to", info.toFixed)}
    </g>
  );
}

/** The preview while an end is dragged to another element. */
export function LooseEndPreview({
  loose,
  theme,
  zoom,
}: {
  loose: LooseEnd;
  theme: CanvasTheme;
  zoom: number;
}) {
  const px = (value: number): number => value / zoom;
  const color = theme.selection;
  const tip = loose.anchor ?? loose.pointer;
  return (
    <g>
      {loose.target !== null ? (
        <rect
          x={loose.target.x - px(4)}
          y={loose.target.y - px(4)}
          width={loose.target.w + px(8)}
          height={loose.target.h + px(8)}
          rx={px(10)}
          fill="none"
          stroke={color}
          strokeOpacity={0.6}
          strokeWidth={px(3)}
        />
      ) : null}
      {loose.anchors.map((point, index) => {
        const active =
          loose.anchor !== null && point.x === loose.anchor.x && point.y === loose.anchor.y;
        const r = px(active ? 4.5 : 3);
        return (
          <path
            key={index}
            d={`M${point.x - r} ${point.y - r} L${point.x + r} ${point.y + r} M${point.x - r} ${point.y + r} L${point.x + r} ${point.y - r}`}
            stroke={color}
            strokeOpacity={active ? 1 : 0.7}
            strokeWidth={px(active ? 2 : 1.5)}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1={loose.from.x}
        y1={loose.from.y}
        x2={tip.x}
        y2={tip.y}
        stroke={color}
        strokeWidth={px(1.75)}
        strokeDasharray={`${px(6)} ${px(5)}`}
      />
      <circle cx={tip.x} cy={tip.y} r={px(4)} fill={color} />
    </g>
  );
}
