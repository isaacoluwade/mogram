"use client";

import { Fragment, useId, useMemo, type ReactNode, type Ref } from "react";
import { GRID, type Box, type Point } from "@mogram/core/layout";
import { gridLevels, gridLines, type GridStyle } from "../grid";
import { wrap } from "../text";
import { TimeContext, type TimeSource } from "../clock";
import type { Camera } from "../camera";
import type { SceneModel } from "../scene";
import { TILE_SHEEN } from "@/styles/colors";
import type { CanvasTheme } from "../theme";
import type { CapacityRuntime } from "../capacity";
import { ComponentNode } from "./component-node";
import { FleetNode } from "./fleet-node";
import { MachineNode } from "./machine-node";
import { MeterNode } from "./meter-node";
import { ShapeNode } from "./shape-node";
import { ConnectionNode } from "./connection-node";
import { ContainerNode } from "./container-node";
import { GroupNode, NoteNode, TextNode, ZoneNode } from "./decoration-nodes";
import { PaintGradient, paintFill } from "./paint-gradient";
import { PresenceGroup } from "./presence";
import type { PaintKind } from "@mogram/core/layout";
import {
  RenderContext,
  svgIds,
  type RenderMode,
  type RenderSettings,
  type SvgIds,
} from "./render-context";

export interface DiagramSvgProps {
  readonly scene: SceneModel;
  readonly time: TimeSource;
  readonly mode: RenderMode;
  readonly fontFamily: string;
  /**
   * Live canvases pass a camera and their size; static renders (export, thumbnails) pass a
   * world-space `frame` and get a self-contained SVG with the background drawn inside.
   */
  readonly camera?: Camera;
  readonly size?: { readonly width: number; readonly height: number };
  readonly frame?: Box;
  readonly focus?: ReadonlySet<string> | null;
  readonly showGrid?: boolean;
  readonly gridStyle?: GridStyle;
  readonly transparent?: boolean;
  /** Extra SVG drawn in world space above the diagram (selection, handles, previews). */
  readonly overlay?: ReactNode;
  /** Extra SVG drawn in world space below the diagram (drop targets). */
  readonly underlay?: ReactNode;
  /** <style> content for exports (embedded @font-face). */
  readonly embeddedStyle?: string;
  readonly svgRef?: Ref<SVGSVGElement>;
  readonly className?: string;
  readonly title?: string;
  /** The viewer: elements are keyboard-reachable buttons (see `actionProps`). */
  readonly interactive?: boolean;
  /** The text or note being typed into on the canvas (its words are hidden underneath). */
  readonly editingText?: string | null;
  /** Capacity over time (D-82): copies booting, machines growing, traffic easing. */
  readonly capacity?: CapacityRuntime | null;
  /**
   * The story's words, drawn into a still or exported frame (D-86) in a band of the frame: the
   * viewer shows them in its own bar instead.
   */
  readonly caption?: { readonly text: string | null; readonly opacity: number; readonly box: Box };
}

/** Nodes by name, so the paint order can interleave kinds. */
function nodesOf(scene: SceneModel) {
  const byName = <T extends { readonly name: string }>(items: readonly T[]) =>
    new Map(items.map((item) => [item.name, item]));
  return {
    zone: byName(scene.zones),
    container: byName(scene.containers),
    group: byName(scene.groups),
    connection: byName(scene.connections),
    component: byName(scene.components),
    text: byName(scene.texts),
  };
}

type SceneNodes = ReturnType<typeof nodesOf>;

function useNodes(scene: SceneModel): SceneNodes;
function useNodes(scene: SceneModel | null): SceneNodes | null;
function useNodes(scene: SceneModel | null): SceneNodes | null {
  return useMemo(() => (scene === null ? null : nodesOf(scene)), [scene]);
}

/** One painted thing, and the point it grows from when it arrives. */
function draw(
  nodes: SceneNodes,
  scene: SceneModel,
  kind: PaintKind,
  name: string,
  capacity: boolean,
): { readonly node: ReactNode; readonly origin: Point | null } | null {
  const centre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
  switch (kind) {
    case "zone": {
      const zone = nodes.zone.get(name);
      return zone === undefined ? null : { node: <ZoneNode zone={zone} />, origin: null };
    }
    case "container": {
      const container = nodes.container.get(name);
      return container === undefined
        ? null
        : { node: <ContainerNode container={container} />, origin: null };
    }
    case "group": {
      const group = nodes.group.get(name);
      return group === undefined ? null : { node: <GroupNode group={group} />, origin: null };
    }
    case "connection": {
      const connection = nodes.connection.get(name);
      return connection === undefined
        ? null
        : { node: <ConnectionNode connection={connection} />, origin: null };
    }
    case "component": {
      const component = nodes.component.get(name);
      if (component === undefined) return null;
      const spokes = scene.spokes.get(name) ?? null;
      // Scaling is drawn only while the diagram models capacity (D-82).
      const node =
        component.scaling !== null && capacity ? (
          component.scaling.kind === "out" ? (
            <FleetNode component={component} spokes={spokes} />
          ) : (
            <MachineNode component={component} spokes={spokes} />
          )
        ) : component.meter !== null ? (
          <MeterNode component={component} />
        ) : component.shape !== null ? (
          <ShapeNode component={component} />
        ) : (
          <ComponentNode component={component} />
        );
      return { node, origin: centre(component.shape !== null ? component.box : component.tile) };
    }
    case "text": {
      const item = nodes.text.get(name);
      if (item === undefined) return null;
      return {
        node: item.variant === "note" ? <NoteNode note={item} /> : <TextNode item={item} />,
        origin: centre(item.box),
      };
    }
  }
}

/** The diagram as one SVG, drawn back to front in the scene's paint order (architecture.md §5). */
export function DiagramSvg({
  scene,
  time,
  mode,
  fontFamily,
  camera,
  size,
  frame,
  focus = null,
  showGrid = false,
  gridStyle = "dots",
  transparent,
  overlay,
  underlay,
  embeddedStyle,
  svgRef,
  className,
  title,
  interactive = false,
  editingText = null,
  capacity: live = null,
  caption,
}: DiagramSvgProps) {
  // Without a live timeline (thumbnails, the minimap), capacity is drawn as it settles.
  const capacity = useMemo<CapacityRuntime | null>(
    () => live ?? (scene.settled === null ? null : { timeline: scene.settled, version: 0 }),
    [live, scene.settled],
  );
  // useId gives characters like «» that url(#…) would need escaped: keep letters and digits.
  const prefix = `mogram${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ids = useMemo(() => svgIds(prefix), [prefix]);
  const settings = useMemo<RenderSettings>(
    () => ({
      theme: scene.theme,
      fontFamily,
      transitionStart: scene.transitionStart,
      transitionSeconds: scene.transitionSeconds,
      mode,
      focus: focus ?? scene.focus,
      ids,
      interactive,
      editingText,
      capacity,
      ramp: scene.ramp,
    }),
    [
      scene.theme,
      fontFamily,
      scene.transitionStart,
      scene.transitionSeconds,
      scene.focus,
      mode,
      focus,
      ids,
      interactive,
      editingText,
      capacity,
      scene.ramp,
    ],
  );
  const nodes = useNodes(scene);
  const old = useNodes(scene.leaving);
  const isStatic = frame !== undefined;
  const page = scene.page;
  const transform =
    camera === undefined ? undefined : `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={isStatic ? frame.w : (size?.width ?? "100%")}
      height={isStatic ? frame.h : (size?.height ?? "100%")}
      viewBox={isStatic ? `${frame.x} ${frame.y} ${frame.w} ${frame.h}` : undefined}
      // An image hides its children from assistive tech; the viewer's elements are buttons.
      role={interactive ? "group" : "img"}
      aria-label={title ?? "Architecture diagram"}
      style={{ display: "block", fontFamily }}
    >
      {title !== undefined ? <title>{title}</title> : null}
      {embeddedStyle !== undefined ? <style>{embeddedStyle}</style> : null}
      <Defs theme={scene.theme} ids={ids} />
      {isStatic && transparent !== true ? (
        <Background theme={scene.theme} box={frame} ids={ids} />
      ) : null}
      <TimeContext value={time}>
        <RenderContext value={settings}>
          <g transform={transform}>
            {showGrid && camera !== undefined && size !== undefined ? (
              <Grid
                camera={camera}
                size={size}
                color={scene.theme.grid}
                id={ids.grid}
                style={gridStyle}
              />
            ) : null}
            {underlay}
            {/* With a page (D-98), someone watching sees the page and nothing beyond it. */}
            {page !== null && mode !== "edit" ? (
              <clipPath id={ids.page}>
                <rect x={page.x} y={page.y} width={page.w} height={page.h} />
              </clipPath>
            ) : null}
            <g
              data-layer="diagram"
              clipPath={page !== null && mode !== "edit" ? `url(#${ids.page})` : undefined}
            >
              {scene.paint.map(({ kind, name }) => {
                const key = `${kind}:${name}`;
                const pair = scene.presence.get(key);
                const now = draw(nodes, scene, kind, name, capacity !== null);
                // While the picture changes (D-86): what's leaving is drawn as it was, and
                // what's changing its words or look has its old self underneath.
                // Something on its way from one place to another is one thing moving, not
                // an old one fading out and a new one fading in.
                const travel = scene.travel.get(key);
                const fading = scene.crossfade.has(key) && travel === undefined;
                const was =
                  old !== null && scene.leaving !== null && (now === null || fading)
                    ? draw(old, scene.leaving, kind, name, capacity !== null)
                    : null;
                if (now === null && was === null) return null;
                const solid = { from: 1, to: 1 };
                return (
                  <Fragment key={key}>
                    {was !== null ? (
                      <PresenceGroup
                        key="was"
                        pair={pair ?? solid}
                        role={now === null ? "stay" : "old"}
                      >
                        {was.node}
                      </PresenceGroup>
                    ) : null}
                    {now !== null ? (
                      <PresenceGroup
                        key="now"
                        pair={fading ? (pair ?? solid) : pair}
                        role={fading ? "new" : "stay"}
                        origin={now.origin}
                        travel={travel}
                      >
                        {now.node}
                      </PresenceGroup>
                    ) : null}
                  </Fragment>
                );
              })}
            </g>
            {/* In the editor the page is drawn, and what's off stage is dimmed, not hidden. */}
            {page !== null && mode === "edit" ? (
              <g data-layer="page" pointerEvents="none">
                <path
                  d={`M-100000 -100000H100000V100000H-100000Z M${page.x} ${page.y}v${page.h}h${page.w}v${-page.h}Z`}
                  fillRule="evenodd"
                  fill={scene.theme.base}
                  opacity={0.6}
                />
                <rect
                  data-testid="page-frame"
                  x={page.x}
                  y={page.y}
                  width={page.w}
                  height={page.h}
                  fill="none"
                  stroke={scene.theme.line}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : null}
            {overlay}
          </g>
          {caption !== undefined ? (
            <CaptionBand caption={caption} theme={scene.theme} fontFamily={fontFamily} />
          ) : null}
        </RenderContext>
      </TimeContext>
    </svg>
  );
}

const CAPTION_SIZE = 17;
const CAPTION_LINE = 24;

/** The story's words under an exported picture: up to three lines, centred in their band. */
function CaptionBand({
  caption,
  theme,
  fontFamily,
}: {
  caption: NonNullable<DiagramSvgProps["caption"]>;
  theme: CanvasTheme;
  fontFamily: string;
}) {
  const { box, text } = caption;
  if (text === null || text === "") return null;
  const lines = wrap(text, Math.max(120, box.w - 64), CAPTION_SIZE, 3, 500, "Inter");
  const top = box.y + (box.h - lines.length * CAPTION_LINE) / 2 - 6;
  return (
    <text
      data-part="caption"
      textAnchor="middle"
      fontSize={CAPTION_SIZE}
      fontWeight={500}
      fill={theme.text}
      opacity={caption.opacity}
      style={{ fontFamily }}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={box.x + box.w / 2} y={top + CAPTION_SIZE + index * CAPTION_LINE}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function Defs({ theme, ids }: { theme: CanvasTheme; ids: SvgIds }) {
  const sheenTop = theme.mode === "dark" ? 0.06 : 0.5;
  return (
    <defs>
      <filter id={ids.desaturate} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0.08" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.85" />
        </feComponentTransfer>
      </filter>
      <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <linearGradient id={ids.sheen} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={TILE_SHEEN} stopOpacity={sheenTop} />
        <stop offset="1" stopColor={TILE_SHEEN} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

function Background({ theme, box, ids }: { theme: CanvasTheme; box: Box; ids: SvgIds }) {
  return (
    <>
      <defs>
        <PaintGradient paint={theme.background} box={box} id={ids.background} />
      </defs>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill={paintFill(theme.background, ids.background)}
      />
    </>
  );
}

/**
 * The 8px grid (ED-9), drawn only when turned on: every mark a snap point; single cells while
 * things can be placed cell by cell, and a stronger mark every 10 cells (canvas/grid.ts).
 * Zoomed out only the 10-cell marks remain, drawn like single cells, and the grid eases
 * lighter. Lines are fainter than dots, since they cover far more of the canvas.
 */
function Grid({
  camera,
  size,
  color,
  id,
  style,
}: {
  camera: Camera;
  size: { width: number; height: number };
  color: string;
  id: string;
  style: GridStyle;
}) {
  const levels = gridLevels(camera.zoom);
  const fine = levels.fine > 0;
  // The 10-cell marks stand out only while single cells show; alone, they look like them.
  const emphasis = levels.fine;
  const px = 1 / camera.zoom;
  const x0 = -camera.x / camera.zoom;
  const y0 = -camera.y / camera.zoom;
  const x1 = x0 + size.width / camera.zoom;
  const y1 = y0 + size.height / camera.zoom;
  if (style === "lines") {
    const vertical = gridLines(x0, x1, { fine, coarse: levels.coarse }, (x) => `M${x} ${y0}V${y1}`);
    const horizontal = gridLines(
      y0,
      y1,
      { fine, coarse: levels.coarse },
      (y) => `M${x0} ${y}H${x1}`,
    );
    // Single-cell lines are faint; the 10-cell ones full while both show, and still clearly
    // there alone (zoomed out), where fainter lines all but vanish on a dark canvas.
    const faint = 0.45;
    const alone = 0.7;
    return (
      <g
        aria-hidden
        pointerEvents="none"
        data-grid="lines"
        stroke={color}
        strokeWidth={px}
        fill="none"
        opacity={levels.strength}
      >
        {fine ? (
          <path
            data-level="fine"
            d={vertical.fine + horizontal.fine}
            opacity={faint * levels.fine}
            shapeRendering="crispEdges"
          />
        ) : null}
        <path
          data-level="coarse"
          d={vertical.coarse + horizontal.coarse}
          opacity={alone + (1 - alone) * emphasis}
          shapeRendering="crispEdges"
        />
      </g>
    );
  }
  const finePx = GRID;
  const coarsePx = levels.coarse * GRID;
  // Each pattern tile is centred on its dot, so dots land exactly on multiples of the step.
  const dots = (step: number, radius: number, pattern: string) => (
    <pattern
      id={pattern}
      x={-step / 2}
      y={-step / 2}
      width={step}
      height={step}
      patternUnits="userSpaceOnUse"
    >
      <circle cx={step / 2} cy={step / 2} r={radius} fill={color} />
    </pattern>
  );
  const area = {
    x: Math.floor(x0 / coarsePx) * coarsePx - coarsePx,
    y: Math.floor(y0 / coarsePx) * coarsePx - coarsePx,
    width: x1 - x0 + coarsePx * 3,
    height: y1 - y0 + coarsePx * 3,
  };
  const dim = 0.8;
  return (
    <g aria-hidden pointerEvents="none" data-grid="dots" opacity={levels.strength}>
      <defs>
        {fine ? dots(finePx, px, `${id}-fine`) : null}
        {dots(coarsePx, px * (1 + 0.6 * emphasis), `${id}-coarse`)}
      </defs>
      {fine ? (
        <rect {...area} data-level="fine" fill={`url(#${id}-fine)`} opacity={dim * levels.fine} />
      ) : null}
      <rect
        {...area}
        data-level="coarse"
        fill={`url(#${id}-coarse)`}
        opacity={dim + (1 - dim) * emphasis}
      />
    </g>
  );
}
