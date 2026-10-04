"use client";

import { memo } from "react";
import type { Box, LayoutResult, Point } from "@mogram/core/layout";
import type { RoutedPath } from "@mogram/core/routing";
import type { CanvasTheme } from "@/features/canvas/theme";

/**
 * Editor-only drawing on top of the diagram: selection, handles, previews. Sizes are divided by
 * the zoom so handles stay the same size on screen at any zoom level.
 */

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const RESIZE_HANDLES: readonly ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Reads a handle's `data-dir` back into a direction (anything unexpected is "se"). */
export function resizeHandleOf(value: string | null): ResizeHandle {
  return RESIZE_HANDLES.find((handle) => handle === value) ?? "se";
}

export function handlePoint(box: Box, handle: ResizeHandle): Point {
  const x = handle.includes("w") ? box.x : handle.includes("e") ? box.x + box.w : box.x + box.w / 2;
  const y = handle.includes("n") ? box.y : handle.includes("s") ? box.y + box.h : box.y + box.h / 2;
  return { x, y };
}

const CURSORS: Readonly<Record<ResizeHandle, string>> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

export interface OverlayProps {
  readonly layout: LayoutResult;
  readonly routes: ReadonlyMap<string, RoutedPath>;
  readonly theme: CanvasTheme;
  readonly zoom: number;
  readonly selection: readonly string[];
  readonly hovered: string | null;
  readonly groups: ReadonlyMap<string, Box>;
  readonly connectionNames: ReadonlySet<string>;
  readonly resizable: (name: string) => boolean;
  readonly marquee: Box | null;
  readonly marqueeKind: "select" | "container" | "zone";
  readonly connect: { from: Point; to: Point; target: Box | null } | null;
  readonly dropTarget: Box | null;
  readonly waypoints: { readonly connection: string; readonly points: readonly Point[] } | null;
  readonly showConnectHandles: Box | null;
  readonly unpinned: ReadonlySet<string>;
}

/**
 * Selection, handles and gesture previews. Memoised: panning changes only the camera's position,
 * which the SVG transform handles, so this redraws for zoom and editing changes only.
 */
export const EditorOverlay = memo(function EditorOverlay(props: OverlayProps) {
  const { layout, routes, theme, zoom, selection } = props;
  const px = (value: number): number => value / zoom;
  const color = theme.selection;
  const selected = new Set(selection);
  const boxes: { name: string; box: Box }[] = [];
  for (const name of selection) {
    const element = layout.elements.get(name);
    if (element !== undefined)
      boxes.push({
        name,
        box: element.kind === "component" ? (layout.tiles.get(name) ?? element.box) : element.box,
      });
    const group = props.groups.get(name);
    if (group !== undefined) boxes.push({ name, box: group });
  }
  const single = selection.length === 1 ? selection[0] : undefined;
  const singleElement = single === undefined ? undefined : layout.elements.get(single);

  return (
    <g data-overlay pointerEvents="none">
      {props.dropTarget !== null ? (
        <rect
          x={props.dropTarget.x - px(3)}
          y={props.dropTarget.y - px(3)}
          width={props.dropTarget.w + px(6)}
          height={props.dropTarget.h + px(6)}
          rx={16}
          fill="none"
          stroke={color}
          strokeOpacity={0.55}
          strokeWidth={px(2)}
          strokeDasharray={`${px(6)} ${px(4)}`}
        />
      ) : null}

      {props.hovered !== null && !selected.has(props.hovered) ? (
        <HoverOutline {...props} name={props.hovered} />
      ) : null}

      {selection.map((name) => {
        const route = props.connectionNames.has(name) ? routes.get(name) : undefined;
        if (route === undefined) return null;
        return (
          <path
            key={name}
            d={route.d}
            fill="none"
            stroke={color}
            strokeOpacity={0.9}
            strokeWidth={px(2.5)}
            strokeLinecap="round"
          />
        );
      })}

      {boxes.map(({ name, box }) => {
        const isComponent = layout.elements.get(name)?.kind === "component";
        const pad = isComponent ? 5 : 3;
        return (
          <g key={name}>
            <rect
              x={box.x - pad}
              y={box.y - pad}
              width={box.w + pad * 2}
              height={box.h + pad * 2}
              rx={isComponent ? 18 : 16}
              fill="none"
              stroke={color}
              strokeWidth={px(1.5)}
            />
            {props.unpinned.has(name) && selection.length === 1 ? (
              <g transform={`translate(${box.x - pad} ${box.y - pad - px(22)})`}>
                <rect width={px(40)} height={px(17)} rx={px(8.5)} fill={color} />
                <text
                  x={px(20)}
                  y={px(12)}
                  textAnchor="middle"
                  fontSize={px(10)}
                  fontWeight={600}
                  fill={theme.base}
                >
                  Auto
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {single !== undefined && singleElement !== undefined && props.resizable(single)
        ? RESIZE_HANDLES.map((handle) => {
            const point = handlePoint(singleElement.box, handle);
            const size = px(8);
            return (
              <rect
                key={handle}
                data-handle="resize"
                data-dir={handle}
                x={point.x - size / 2}
                y={point.y - size / 2}
                width={size}
                height={size}
                rx={px(2)}
                fill={theme.base}
                stroke={color}
                strokeWidth={px(1.5)}
                pointerEvents="all"
                style={{ cursor: CURSORS[handle] }}
              />
            );
          })
        : null}

      {props.waypoints !== null ? <Waypoints {...props} /> : null}

      {props.showConnectHandles !== null && props.hovered !== null ? (
        <ConnectHandles
          name={props.hovered}
          box={props.showConnectHandles}
          color={color}
          base={theme.base}
          zoom={zoom}
        />
      ) : null}

      {props.connect !== null ? (
        <g>
          {props.connect.target !== null ? (
            <rect
              x={props.connect.target.x - 6}
              y={props.connect.target.y - 6}
              width={props.connect.target.w + 12}
              height={props.connect.target.h + 12}
              rx={18}
              fill="none"
              stroke={color}
              strokeWidth={px(2)}
            />
          ) : null}
          <line
            x1={props.connect.from.x}
            y1={props.connect.from.y}
            x2={props.connect.to.x}
            y2={props.connect.to.y}
            stroke={color}
            strokeWidth={px(1.75)}
            strokeDasharray={`${px(6)} ${px(5)}`}
          />
          <circle cx={props.connect.to.x} cy={props.connect.to.y} r={px(4)} fill={color} />
        </g>
      ) : null}

      {props.marquee !== null ? (
        <rect
          x={props.marquee.x}
          y={props.marquee.y}
          width={props.marquee.w}
          height={props.marquee.h}
          rx={props.marqueeKind === "select" ? px(2) : 14}
          fill={color}
          fillOpacity={props.marqueeKind === "select" ? 0.06 : 0.04}
          stroke={color}
          strokeOpacity={0.7}
          strokeWidth={px(1)}
          strokeDasharray={props.marqueeKind === "select" ? undefined : `${px(6)} ${px(4)}`}
        />
      ) : null}
    </g>
  );
});

function HoverOutline({
  layout,
  routes,
  groups,
  theme,
  zoom,
  name,
  connectionNames,
}: OverlayProps & { name: string }) {
  const px = (value: number): number => value / zoom;
  if (connectionNames.has(name)) {
    const route = routes.get(name);
    return route === undefined ? null : (
      <path
        d={route.d}
        fill="none"
        stroke={theme.selection}
        strokeOpacity={0.35}
        strokeWidth={px(4)}
        strokeLinecap="round"
      />
    );
  }
  const element = layout.elements.get(name);
  const box =
    element?.kind === "component" ? layout.tiles.get(name) : (element?.box ?? groups.get(name));
  if (box === undefined) return null;
  const pad = element?.kind === "component" ? 5 : 3;
  return (
    <rect
      x={box.x - pad}
      y={box.y - pad}
      width={box.w + pad * 2}
      height={box.h + pad * 2}
      rx={element?.kind === "component" ? 18 : 16}
      fill="none"
      stroke={theme.selection}
      strokeOpacity={0.3}
      strokeWidth={px(1.5)}
    />
  );
}

function Waypoints({ waypoints, routes, theme, zoom }: OverlayProps) {
  if (waypoints === null) return null;
  const px = (value: number): number => value / zoom;
  const route = routes.get(waypoints.connection);
  const midpoints: Point[] = [];
  if (route !== undefined && route.kind === "polyline") {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1];
      const b = route.points[i];
      if (a === undefined || b === undefined) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 36) continue;
      midpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }
  return (
    <g>
      {midpoints.map((point, index) => (
        <circle
          key={`m${index}`}
          data-handle="add-waypoint"
          data-x={point.x}
          data-y={point.y}
          cx={point.x}
          cy={point.y}
          r={px(4.5)}
          fill={theme.base}
          stroke={theme.selection}
          strokeOpacity={0.7}
          strokeWidth={px(1.25)}
          pointerEvents="all"
          style={{ cursor: "move" }}
        />
      ))}
      {waypoints.points.map((point, index) => (
        <circle
          key={`w${index}`}
          data-handle="waypoint"
          data-index={index}
          cx={point.x}
          cy={point.y}
          r={px(5.5)}
          fill={theme.selection}
          stroke={theme.base}
          strokeWidth={px(1.5)}
          pointerEvents="all"
          style={{ cursor: "move" }}
        />
      ))}
    </g>
  );
}

function ConnectHandles({
  name,
  box,
  color,
  base,
  zoom,
}: {
  name: string;
  box: Box;
  color: string;
  base: string;
  zoom: number;
}) {
  const r = 5 / zoom;
  const halo = 16 / zoom;
  const points = [
    { x: box.x + box.w / 2, y: box.y - 9 / zoom },
    { x: box.x + box.w + 9 / zoom, y: box.y + box.h / 2 },
    { x: box.x + box.w / 2, y: box.y + box.h + 9 / zoom },
    { x: box.x - 9 / zoom, y: box.y + box.h / 2 },
  ];
  return (
    <g>
      {/* An invisible halo that still counts as the component, so hover survives the gap to the handles. */}
      <rect
        data-element={name}
        data-kind="component"
        data-halo=""
        x={box.x - halo}
        y={box.y - halo}
        width={box.w + halo * 2}
        height={box.h + halo * 2}
        rx={halo}
        fill="transparent"
        pointerEvents="all"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          data-handle="connect"
          cx={point.x}
          cy={point.y}
          r={r}
          fill={base}
          stroke={color}
          strokeWidth={1.5 / zoom}
          pointerEvents="all"
          style={{ cursor: "crosshair" }}
        />
      ))}
    </g>
  );
}
