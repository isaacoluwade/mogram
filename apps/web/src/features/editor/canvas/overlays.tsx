"use client";

import { memo } from "react";
import {
  SHAPE_ADJUST,
  TONES,
  shapeParam,
  type ShapeId,
  type ShapeParams,
} from "@mogram/core/presets";
import type { Guide } from "./guides";
import type { Box, LayoutResult, Point } from "@mogram/core/layout";
import type { RoutedPath } from "@mogram/core/routing";
import type { CanvasTheme } from "@/features/canvas/theme";
import {
  ConnectionHandles,
  LooseEndPreview,
  type ConnectionEditInfo,
  type LooseEnd,
} from "./connection-handles";

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
  /** The connection a dropped component would split (ED-29). */
  readonly splitTarget: RoutedPath | null;
  /** The selected connection's handles (ED-29), and an end being dragged to another element. */
  readonly connectionEdit: ConnectionEditInfo | null;
  readonly loose: LooseEnd | null;
  readonly showConnectHandles: Box | null;
  readonly unpinned: ReadonlySet<string>;
  /** Selected elements that are locked: they get a lock badge and no resize handles. */
  readonly locked: ReadonlySet<string>;
  /** Smart guides and the position hint while moving (06-canvas-interactions §8). */
  readonly guides: readonly Guide[];
  /** A selected shape's adjustable measure (corner, lid, slant, wave), for its diamond handle. */
  readonly adjustable: (name: string) => { shape: ShapeId; params: ShapeParams } | null;
  /** While resizing: the resized element and the siblings whose width or height it matches. */
  readonly sizeMatches: {
    readonly name: string;
    readonly w: readonly string[];
    readonly h: readonly string[];
  } | null;
  readonly hint: { readonly text: string; readonly at: { x: number; y: number } } | null;
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

      <GuideLines guides={props.guides} zoom={zoom} color={TONES.rose[theme.mode].solid} />
      {props.sizeMatches !== null ? (
        <SizeMarks
          layout={layout}
          matches={props.sizeMatches}
          zoom={zoom}
          color={TONES.rose[theme.mode].solid}
        />
      ) : null}
      {props.hint !== null ? (
        <g data-overlay="move-hint" transform={`translate(${props.hint.at.x} ${props.hint.at.y})`}>
          <rect
            x={-px(26)}
            y={0}
            width={px(52)}
            height={px(18)}
            rx={px(9)}
            fill={theme.base}
            stroke={theme.tileBorder}
            strokeWidth={px(1)}
          />
          <text
            x={0}
            y={px(12.5)}
            textAnchor="middle"
            fontSize={px(10.5)}
            fontWeight={500}
            fill={theme.textMuted}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {props.hint.text}
          </text>
        </g>
      ) : null}

      {props.splitTarget !== null ? (
        <path
          data-overlay="split-target"
          d={props.splitTarget.d}
          fill="none"
          stroke={color}
          strokeOpacity={0.7}
          strokeWidth={px(5)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* The container holding the one selected element, quietly: it explains the nesting. */}
      {singleElement?.parent != null && !selected.has(singleElement.parent) ? (
        <ParentOutline
          box={layout.elements.get(singleElement.parent)?.box}
          color={color}
          zoom={zoom}
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
            {props.locked.has(name) ? (
              <g
                data-overlay="locked"
                transform={`translate(${box.x + box.w + pad - px(9)} ${box.y - pad - px(9)})`}
              >
                <circle r={px(9)} cx={px(9)} cy={px(9)} fill={color} />
                {/* A padlock: the shackle, then the body. */}
                <path
                  d={`M${px(6.5)} ${px(8.5)} v${-px(1.8)} a${px(2.5)} ${px(2.5)} 0 0 1 ${px(5)} 0 v${px(1.8)}`}
                  fill="none"
                  stroke={theme.base}
                  strokeWidth={px(1.4)}
                />
                <rect
                  x={px(5.5)}
                  y={px(8.5)}
                  width={px(7)}
                  height={px(5)}
                  rx={px(1)}
                  fill={theme.base}
                />
              </g>
            ) : null}
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

      {props.connectionEdit !== null && props.loose === null ? (
        <ConnectionHandles info={props.connectionEdit} theme={theme} zoom={zoom} />
      ) : null}
      {props.loose !== null ? (
        <LooseEndPreview loose={props.loose} theme={theme} zoom={zoom} />
      ) : null}

      {props.showConnectHandles !== null && props.hovered !== null ? (
        <ConnectHandles
          name={props.hovered}
          box={props.showConnectHandles}
          footprint={layout.elements.get(props.hovered)?.box ?? props.showConnectHandles}
          color={color}
          base={theme.base}
          zoom={zoom}
        />
      ) : null}

      {single !== undefined && singleElement !== undefined && !props.locked.has(single) ? (
        <AdjustHandle
          adjustable={props.adjustable(single)}
          box={singleElement.box}
          zoom={zoom}
          color={TONES.amber[theme.mode].solid}
          base={theme.base}
        />
      ) : null}

      {/* Above the hover halo and arrows, so a selected element's handles can always be grabbed. */}
      {single !== undefined &&
      singleElement !== undefined &&
      props.resizable(single) &&
      !props.locked.has(single)
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
    element?.kind === "component"
      ? (layout.tiles.get(name) ?? element.box)
      : (element?.box ?? groups.get(name));
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

function ConnectHandles({
  name,
  box,
  footprint,
  color,
  base,
  zoom,
}: {
  name: string;
  box: Box;
  /** The whole element, label included: the lower arrow goes beneath it. */
  footprint: Box;
  color: string;
  base: string;
  zoom: number;
}) {
  const halo = 22 / zoom;
  const gap = 14 / zoom;
  const size = 7 / zoom;
  const arrows = [
    { direction: "up", x: box.x + box.w / 2, y: box.y - gap, angle: -90 },
    { direction: "right", x: box.x + box.w + gap, y: box.y + box.h / 2, angle: 0 },
    {
      direction: "down",
      x: box.x + box.w / 2,
      y: Math.max(box.y + box.h + gap, footprint.y + footprint.h + gap / 2),
      angle: 90,
    },
    { direction: "left", x: box.x - gap, y: box.y + box.h / 2, angle: 180 },
  ] as const;
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
        height={Math.max(box.y + box.h, footprint.y + footprint.h) - box.y + halo * 2}
        rx={halo}
        fill="transparent"
        pointerEvents="all"
      />
      {/*
        Hover arrows (06-canvas-interactions §9): click for a connected copy that way, Alt-click
        to choose what to add there, drag to draw a connection.
      */}
      {arrows.map((arrow) => (
        <g
          key={arrow.direction}
          data-handle="connect"
          data-direction={arrow.direction}
          className="opacity-40 transition-opacity hover:opacity-100"
          transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
          style={{ cursor: "pointer" }}
          pointerEvents="all"
        >
          <title>{`Add a connected copy ${arrow.direction === "up" ? "above" : arrow.direction === "down" ? "below" : `to the ${arrow.direction}`} (drag to connect)`}</title>
          <circle r={size * 1.6} fill={base} stroke={color} strokeWidth={1.25 / zoom} />
          <path
            d={`M${-size * 0.55} 0 H${size * 0.55} M${size * 0.1} ${-size * 0.45} L${size * 0.6} 0 L${size * 0.1} ${size * 0.45}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5 / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </g>
  );
}

/** Alignment lines spanning the shapes that line up, and equal gaps with end ticks. */
function GuideLines({
  guides,
  zoom,
  color,
}: {
  guides: readonly Guide[];
  zoom: number;
  color: string;
}) {
  const px = (value: number): number => value / zoom;
  if (guides.length === 0) return null;
  return (
    <g data-overlay="guides" stroke={color} strokeWidth={px(1)} fill="none">
      {guides.map((guide, index) => {
        if (guide.kind === "align") {
          return guide.axis === "x" ? (
            <line
              key={index}
              data-guide="align-x"
              x1={guide.at}
              x2={guide.at}
              y1={guide.from - px(6)}
              y2={guide.to + px(6)}
            />
          ) : (
            <line
              key={index}
              data-guide="align-y"
              y1={guide.at}
              y2={guide.at}
              x1={guide.from - px(6)}
              x2={guide.to + px(6)}
            />
          );
        }
        return (
          <g key={index} data-guide="spacing">
            {guide.gaps.map((gap, i) =>
              guide.axis === "x" ? (
                <g key={i}>
                  <line x1={gap.from} x2={gap.to} y1={gap.cross} y2={gap.cross} />
                  <line x1={gap.from} x2={gap.from} y1={gap.cross - px(5)} y2={gap.cross + px(5)} />
                  <line x1={gap.to} x2={gap.to} y1={gap.cross - px(5)} y2={gap.cross + px(5)} />
                </g>
              ) : (
                <g key={i}>
                  <line y1={gap.from} y2={gap.to} x1={gap.cross} x2={gap.cross} />
                  <line y1={gap.from} y2={gap.from} x1={gap.cross - px(5)} x2={gap.cross + px(5)} />
                  <line y1={gap.to} y2={gap.to} x1={gap.cross - px(5)} x2={gap.cross + px(5)} />
                </g>
              ),
            )}
          </g>
        );
      })}
    </g>
  );
}

function ParentOutline({
  box,
  color,
  zoom,
}: {
  box: Box | undefined;
  color: string;
  zoom: number;
}) {
  if (box === undefined) return null;
  return (
    <rect
      data-overlay="parent"
      x={box.x - 2 / zoom}
      y={box.y - 2 / zoom}
      width={box.w + 4 / zoom}
      height={box.h + 4 / zoom}
      rx={16}
      fill="none"
      stroke={color}
      strokeOpacity={0.22}
      strokeWidth={1 / zoom}
      strokeDasharray={`${4 / zoom} ${3 / zoom}`}
    />
  );
}

/**
 * Size guides (06-canvas-interactions §5.4): a short bar along the top of every element as wide
 * as the one being resized (or down the left side when the heights match), the resized one
 * included, so the matching sizes read at a glance.
 */
function SizeMarks({
  layout,
  matches,
  zoom,
  color,
}: {
  layout: LayoutResult;
  matches: { readonly name: string; readonly w: readonly string[]; readonly h: readonly string[] };
  zoom: number;
  color: string;
}) {
  const px = (value: number): number => value / zoom;
  const marks: React.ReactNode[] = [];
  const mark = (name: string, axis: "w" | "h") => {
    const box = layout.elements.get(name)?.box;
    if (box === undefined) return;
    const off = px(8);
    marks.push(
      axis === "w" ? (
        <g key={`${name}-w`} data-guide="size-w">
          <line x1={box.x} x2={box.x + box.w} y1={box.y - off} y2={box.y - off} />
          <line x1={box.x} x2={box.x} y1={box.y - off - px(4)} y2={box.y - off + px(4)} />
          <line
            x1={box.x + box.w}
            x2={box.x + box.w}
            y1={box.y - off - px(4)}
            y2={box.y - off + px(4)}
          />
        </g>
      ) : (
        <g key={`${name}-h`} data-guide="size-h">
          <line y1={box.y} y2={box.y + box.h} x1={box.x - off} x2={box.x - off} />
          <line y1={box.y} y2={box.y} x1={box.x - off - px(4)} x2={box.x - off + px(4)} />
          <line
            y1={box.y + box.h}
            y2={box.y + box.h}
            x1={box.x - off - px(4)}
            x2={box.x - off + px(4)}
          />
        </g>
      ),
    );
  };
  if (matches.w.length > 0) for (const name of [matches.name, ...matches.w]) mark(name, "w");
  if (matches.h.length > 0) for (const name of [matches.name, ...matches.h]) mark(name, "h");
  if (marks.length === 0) return null;
  return (
    <g stroke={color} strokeWidth={px(1)} fill="none">
      {marks}
    </g>
  );
}

/**
 * The amber diamond that drags a shape's one adjustable measure (03-shapes-styles-library P1-2,
 * draw.io's yellow handles): a rectangle's corners, a cylinder's lid, a hexagon's slant.
 */
function AdjustHandle({
  adjustable,
  box,
  zoom,
  color,
  base,
}: {
  adjustable: { shape: ShapeId; params: ShapeParams } | null;
  box: Box;
  zoom: number;
  color: string;
  base: string;
}) {
  if (adjustable === null) return null;
  const adjust = SHAPE_ADJUST[adjustable.shape];
  const param = shapeParam(adjustable.shape, box.w, box.h, adjustable.params);
  if (adjust === undefined || param === null) return null;
  const at = adjust.at(box.w, box.h, param.value);
  const size = 7 / zoom;
  return (
    <g
      data-handle="adjust"
      data-key={adjust.key}
      transform={`translate(${box.x + at.x} ${box.y + at.y}) rotate(45)`}
      pointerEvents="all"
      style={{ cursor: "pointer" }}
    >
      <title>{`Drag to change the ${adjust.label.toLowerCase()} (${Math.round(param.value)} px)`}</title>
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill={color}
        stroke={base}
        strokeWidth={1.25 / zoom}
      />
    </g>
  );
}
