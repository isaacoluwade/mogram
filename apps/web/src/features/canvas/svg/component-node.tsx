"use client";

import { memo, useRef } from "react";
import { LABEL } from "@mogram/core/layout";
import { SCENE_TRANSITION } from "@mogram/core/timeline";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { componentAnimates, componentFrame, progressAt, type ComponentFrame } from "../frames";
import { iconHref, useIconCacheVersion } from "../icons";
import { measure } from "../text";
import type { SceneComponent } from "../scene";
import { Badge, CardMark, ExportLink, LinkMark, NestedMark } from "./glyphs";
import { loadColor, percent } from "../capacity-frames";
import { tone } from "../theme";
import { actionProps, focusOpacity, useRender } from "./render-context";

const ICON = 34;
const TILE_RADIUS = 14;
/** How far each copy in the "scaling" stack sits up and to the right of the one in front. */
const STACK_STEP = 6;
/** Gap between a tile (or its stack) and the state ring around it. */
const RING_GAP = 4;

function initials(label: string): string {
  const words = label.split(/\s+/).filter((word) => word.length > 0);
  return (
    words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : label.slice(0, 2)
  ).toUpperCase();
}

interface NodeRefs {
  motion: SVGGElement | null;
  glow: SVGCircleElement | null;
  ring: SVGRectElement | null;
  ghosts: SVGGElement | null;
  ghostNear: SVGRectElement | null;
  ghostFar: SVGRectElement | null;
  content: SVGGElement | null;
  color: SVGImageElement | null;
  grey: SVGImageElement | null;
  badgeFrom: SVGGElement | null;
  badgeTo: SVGGElement | null;
  loadFill: SVGRectElement | null;
  backlog: SVGRectElement | null;
}

function motionTransform(component: SceneComponent, frame: ComponentFrame): string {
  const { motion } = frame;
  if (motion.dx === 0 && motion.dy === 0 && motion.scale === 1 && motion.rotate === 0) return "";
  const cx = component.tile.x + component.tile.w / 2;
  const cy = component.tile.y + component.tile.h / 2;
  return `translate(${cx + motion.dx} ${cy + motion.dy}) rotate(${motion.rotate}) scale(${motion.scale}) translate(${-cx} ${-cy})`;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Where the "scaling" stack and the ring sit for a ghost amount 0..1. The copies slide out from
 * behind the tile as the state fades in, and the ring grows to enclose the whole stack, so its
 * line never crosses a copy's outline.
 */
function stackGeometry(tile: Box, ghost: number) {
  const step = STACK_STEP * ghost;
  return {
    near: { x: tile.x + step, y: tile.y - step },
    far: { x: tile.x + step * 2, y: tile.y - step * 2 },
    ring: {
      x: tile.x - RING_GAP,
      y: tile.y - RING_GAP - step * 2,
      w: tile.w + RING_GAP * 2 + step * 2,
      h: tile.h + RING_GAP * 2 + step * 2,
    },
    badge: `translate(${step * 2} ${-step * 2})`,
  };
}

function apply(refs: NodeRefs, component: SceneComponent, frame: ComponentFrame): void {
  refs.motion?.setAttribute("transform", motionTransform(component, frame));
  const stack = stackGeometry(component.tile, frame.ghostOpacity);
  refs.ghostNear?.setAttribute("x", String(stack.near.x));
  refs.ghostNear?.setAttribute("y", String(stack.near.y));
  refs.ghostFar?.setAttribute("x", String(stack.far.x));
  refs.ghostFar?.setAttribute("y", String(stack.far.y));
  refs.ring?.setAttribute("x", String(stack.ring.x));
  refs.ring?.setAttribute("y", String(stack.ring.y));
  refs.ring?.setAttribute("width", String(stack.ring.w));
  refs.ring?.setAttribute("height", String(stack.ring.h));
  refs.badgeFrom?.setAttribute("transform", stack.badge);
  refs.badgeTo?.setAttribute("transform", stack.badge);
  refs.glow?.setAttribute("opacity", String(frame.glowOpacity * 0.55));
  refs.glow?.setAttribute("fill", frame.glowColor);
  refs.ring?.setAttribute("opacity", String(frame.ringOpacity));
  refs.ring?.setAttribute("stroke", frame.ringColor);
  refs.ghosts?.setAttribute("opacity", String(frame.ghostOpacity));
  refs.ghosts?.setAttribute("stroke", frame.ghostColor);
  refs.content?.setAttribute("opacity", String(frame.contentOpacity));
  refs.color?.setAttribute("opacity", String(frame.colorOpacity));
  refs.grey?.setAttribute("opacity", String(frame.greyOpacity));
  refs.badgeFrom?.setAttribute("opacity", String(frame.badgeFrom.opacity));
  refs.badgeTo?.setAttribute("opacity", String(frame.badgeTo.opacity));
}

/** A component: icon tile with its state look, motion and label (PR-1, PR-3, PR-6, IC-6). */
export const ComponentNode = memo(function ComponentNode({
  component,
}: {
  component: SceneComponent;
}) {
  const settings = useRender();
  const { theme, fontFamily, transitionStart } = settings;
  const source = useTimeSource();
  useIconCacheVersion();
  const now = currentTime(source);
  const transitioning = transitionStart !== null && now - transitionStart < SCENE_TRANSITION + 0.1;
  const frame = componentFrame(component, theme, now, progressAt(now, transitionStart));
  const refs = useRef<NodeRefs>({
    motion: null,
    glow: null,
    ring: null,
    ghosts: null,
    ghostNear: null,
    ghostFar: null,
    content: null,
    color: null,
    grey: null,
    badgeFrom: null,
    badgeTo: null,
    loadFill: null,
    backlog: null,
  }).current;
  // Capacity (D-82): how loaded it is, and how full a queue is, as traffic changes.
  const timeline = settings.capacity?.timeline ?? null;
  const metered = timeline !== null && (component.measured || component.queue);
  const meterAt = (t: number) => ({
    load: timeline?.load(component.name, t) ?? 0,
    backlog: timeline?.backlog(component.name, t) ?? 0,
  });
  const meter = meterAt(now);
  const BAR_INSET = 10;
  const QUEUE_INSET = 5;

  useFrame(componentAnimates(component, transitioning) || metered, (t) => {
    apply(refs, component, componentFrame(component, theme, t, progressAt(t, transitionStart)));
    if (!metered) return;
    const next = meterAt(t);
    const width = (component.tile.w - BAR_INSET * 2) * Math.min(1, next.load);
    refs.loadFill?.setAttribute("width", String(width));
    refs.loadFill?.setAttribute("fill", loadColor(next.load, theme));
    const height = (component.tile.h - QUEUE_INSET * 2) * next.backlog;
    refs.backlog?.setAttribute("height", String(height));
    refs.backlog?.setAttribute(
      "y",
      String(component.tile.y + component.tile.h - QUEUE_INSET - height),
    );
  });

  const { tile, box } = component;
  const cx = tile.x + tile.w / 2;
  const cy = tile.y + tile.h / 2;
  const href = iconHref(component.icon, theme);
  const iconX = cx - ICON / 2;
  const labelWidth = Math.max(0, ...component.lines.map((line) => measure(line, 12, 500)));
  const iconY = cy - ICON / 2;
  const stack = stackGeometry(tile, frame.ghostOpacity);

  return (
    <ExportLink link={component.link} mode={settings.mode}>
      <g
        data-element={component.name}
        data-kind="component"
        data-state={component.state.to}
        {...actionProps(settings, component.label)}
        opacity={focusOpacity(settings, component.name)}
        style={{ transition: "opacity 400ms ease" }}
      >
        {component.tooltip !== null ? <title>{component.tooltip}</title> : null}
        <g
          ref={(node) => void (refs.motion = node)}
          transform={motionTransform(component, frame) || undefined}
        >
          <circle
            ref={(node) => void (refs.glow = node)}
            cx={cx}
            cy={cy}
            r={tile.w * 0.72}
            fill={frame.glowColor}
            opacity={frame.glowOpacity * 0.55}
            filter={`url(#${settings.ids.glow})`}
          />
          <g
            ref={(node) => void (refs.ghosts = node)}
            opacity={frame.ghostOpacity}
            stroke={frame.ghostColor}
            fill={theme.tile}
            strokeWidth={1.2}
          >
            <rect
              ref={(node) => void (refs.ghostFar = node)}
              x={stack.far.x}
              y={stack.far.y}
              width={tile.w}
              height={tile.h}
              rx={TILE_RADIUS}
              strokeOpacity={0.45}
            />
            <rect
              ref={(node) => void (refs.ghostNear = node)}
              x={stack.near.x}
              y={stack.near.y}
              width={tile.w}
              height={tile.h}
              rx={TILE_RADIUS}
              strokeOpacity={0.7}
            />
          </g>
          <rect
            ref={(node) => void (refs.ring = node)}
            x={stack.ring.x}
            y={stack.ring.y}
            width={stack.ring.w}
            height={stack.ring.h}
            rx={TILE_RADIUS + RING_GAP}
            fill="none"
            stroke={frame.ringColor}
            strokeWidth={2}
            opacity={frame.ringOpacity}
          />
          <rect
            x={tile.x}
            y={tile.y}
            width={tile.w}
            height={tile.h}
            rx={TILE_RADIUS}
            fill={theme.tile}
            stroke={theme.tileBorder}
            strokeWidth={1}
          />
          <rect
            x={tile.x + 1}
            y={tile.y + 1}
            width={tile.w - 2}
            height={tile.h / 2}
            rx={TILE_RADIUS - 1}
            fill={`url(#${settings.ids.sheen})`}
          />
          {timeline !== null && component.queue ? (
            <rect
              ref={(node) => void (refs.backlog = node)}
              data-part="backlog"
              x={tile.x + QUEUE_INSET}
              y={tile.y + tile.h - QUEUE_INSET - (tile.h - QUEUE_INSET * 2) * meter.backlog}
              width={tile.w - QUEUE_INSET * 2}
              height={(tile.h - QUEUE_INSET * 2) * meter.backlog}
              rx={9}
              fill={tone("amber", theme.mode).solid}
              opacity={0.28}
            />
          ) : null}
          <g ref={(node) => void (refs.content = node)} opacity={frame.contentOpacity}>
            {href != null ? (
              <>
                <image
                  ref={(node) => void (refs.color = node)}
                  href={href}
                  x={iconX}
                  y={iconY}
                  width={ICON}
                  height={ICON}
                  opacity={frame.colorOpacity}
                  preserveAspectRatio="xMidYMid meet"
                />
                <image
                  ref={(node) => void (refs.grey = node)}
                  href={href}
                  x={iconX}
                  y={iconY}
                  width={ICON}
                  height={ICON}
                  opacity={frame.greyOpacity}
                  filter={`url(#${settings.ids.desaturate})`}
                  preserveAspectRatio="xMidYMid meet"
                />
              </>
            ) : (
              <text
                x={cx}
                y={cy + 5}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill={theme.textMuted}
                style={{ fontFamily }}
              >
                {href === undefined ? "" : initials(component.label)}
              </text>
            )}
          </g>
          <g
            ref={(node) => void (refs.badgeFrom = node)}
            opacity={frame.badgeFrom.opacity}
            transform={stack.badge}
          >
            <Badge
              badge={frame.badgeFrom.badge}
              color={frame.badgeFrom.color}
              background={theme.base}
              opacity={1}
              x={tile.x + tile.w - 2}
              y={tile.y + 2}
            />
          </g>
          <g
            ref={(node) => void (refs.badgeTo = node)}
            opacity={frame.badgeTo.opacity}
            transform={stack.badge}
          >
            <Badge
              badge={frame.badgeTo.badge}
              color={frame.badgeTo.color}
              background={theme.base}
              opacity={1}
              x={tile.x + tile.w - 2}
              y={tile.y + 2}
            />
          </g>
          {component.hasCard ? (
            <CardMark x={tile.x + 9} y={tile.y + tile.h - 9} color={theme.textMuted} />
          ) : null}
          {component.opens ? (
            <NestedMark x={tile.x + tile.w - 10} y={tile.y + tile.h - 9} color={theme.textMuted} />
          ) : null}
          {component.link !== null ? (
            <LinkMark x={tile.x + 10} y={tile.y + 10} color={theme.textMuted} />
          ) : null}
          {timeline !== null && component.measured ? (
            <g data-part="load">
              <rect
                x={tile.x + BAR_INSET}
                y={tile.y + tile.h + 3}
                width={tile.w - BAR_INSET * 2}
                height={3}
                rx={1.5}
                fill={theme.tileBorder}
              />
              <rect
                ref={(node) => void (refs.loadFill = node)}
                x={tile.x + BAR_INSET}
                y={tile.y + tile.h + 3}
                width={(tile.w - BAR_INSET * 2) * Math.min(1, meter.load)}
                height={3}
                rx={1.5}
                fill={loadColor(meter.load, theme)}
              />
            </g>
          ) : null}
          {timeline !== null && component.hit !== null ? (
            <g
              data-part="hit"
              transform={`translate(${tile.x + tile.w - 6} ${tile.y + tile.h - 8})`}
            >
              <rect
                x={-4}
                y={-7}
                width={46}
                height={14}
                rx={7}
                fill={theme.base}
                stroke={tone("green", theme.mode).solid}
                strokeOpacity={0.6}
              />
              <text
                x={19}
                y={3.5}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill={tone("green", theme.mode).solid}
                style={{ fontFamily }}
              >
                {`${percent(component.hit)} hit`}
              </text>
            </g>
          ) : null}
        </g>
        <rect
          x={box.x + box.w / 2 - labelWidth / 2 - 5}
          y={box.y + LABEL.top - 1}
          width={labelWidth + 10}
          height={component.lines.length * LABEL.lineHeight + 4}
          rx={5}
          fill={theme.base}
          opacity={0.82}
        />
        <text
          x={box.x + box.w / 2}
          textAnchor="middle"
          fontSize={12}
          fontWeight={500}
          fill={theme.text}
          opacity={Math.max(0.55, frame.contentOpacity)}
          style={{ fontFamily }}
        >
          {component.lines.map((line, index) => (
            <tspan
              key={index}
              x={box.x + box.w / 2}
              y={box.y + LABEL.top + 10 + index * LABEL.lineHeight}
            >
              {line}
            </tspan>
          ))}
        </text>
      </g>
    </ExportLink>
  );
}, sameComponent);

function sameComponent(
  a: { component: SceneComponent },
  b: { component: SceneComponent },
): boolean {
  const x = a.component;
  const y = b.component;
  return (
    x === y ||
    (x.name === y.name &&
      x.label === y.label &&
      x.lines.join("\n") === y.lines.join("\n") &&
      x.box.x === y.box.x &&
      x.box.y === y.box.y &&
      x.icon.url === y.icon.url &&
      x.icon.inline === y.icon.inline &&
      x.icon.kind === y.icon.kind &&
      x.state.from === y.state.from &&
      x.state.to === y.state.to &&
      x.motion === y.motion &&
      x.intensity === y.intensity &&
      x.speed === y.speed &&
      x.color === y.color &&
      x.hasCard === y.hasCard &&
      x.opens === y.opens &&
      x.link === y.link &&
      x.tooltip === y.tooltip &&
      x.measured === y.measured &&
      x.queue === y.queue &&
      x.hit === y.hit)
  );
}
