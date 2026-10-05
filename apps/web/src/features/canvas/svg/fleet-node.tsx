"use client";

import { memo, useRef } from "react";
import { FLEET, type Box, type Point } from "@mogram/core/layout";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { fleetFrame, loadColor, percent, type FleetFrame } from "../capacity-frames";
import { iconHref, useIconCacheVersion } from "../icons";
import { tone } from "../theme";
import type { SceneComponent, SceneSpokes } from "../scene";
import { ExportLink } from "./glyphs";
import { actionProps, focusOpacity, useRender } from "./render-context";

const TILE = FLEET.tile;
const ICON = 32;
const RADIUS = 14;
const RING = 33;
const CIRCUMFERENCE = 2 * Math.PI * RING;
const BAR = { w: 40, h: 4, gap: 7 } as const;
/** Traffic dots along the spokes: spacing for one copy at full load. */
const DOT_SPACING = 14;
/** The most copies a scale set has (MAX_COPIES in the format). */
const POOL = 24;

const emptyCopy = (): CopyRefs => ({
  group: null,
  grey: null,
  color: null,
  tile: null,
  ring: null,
  tick: null,
  barFill: null,
  bar: null,
});

/** Scales a copy about its centre as it appears or leaves. */
function copyTransform(copy: { x: number; y: number; scale: number }): string {
  const cx = copy.x + TILE / 2;
  const cy = copy.y + TILE / 2;
  return `translate(${cx} ${cy}) scale(${copy.scale}) translate(${-cx} ${-cy}) translate(${copy.x} ${copy.y})`;
}

interface CopyRefs {
  group: SVGGElement | null;
  grey: SVGImageElement | null;
  color: SVGImageElement | null;
  tile: SVGRectElement | null;
  ring: SVGCircleElement | null;
  tick: SVGGElement | null;
  barFill: SVGRectElement | null;
  bar: SVGGElement | null;
}

interface Refs {
  frame: SVGRectElement | null;
  label: SVGGElement | null;
  stats: SVGTextElement | null;
  copies: CopyRefs[];
  spokes: (SVGPathElement | null)[];
  dots: (SVGPathElement | null)[];
}

/** Where a spoke meets a copy's tile: the side facing the other end. */
function tileSide(copy: { x: number; y: number; scale: number }, toward: Point): Point {
  const cx = copy.x + TILE / 2;
  const cy = copy.y + TILE / 2;
  const half = (TILE / 2) * copy.scale;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: cx + Math.sign(dx || -1) * half, y: cy };
  return { x: cx, y: cy + Math.sign(dy || 1) * half };
}

function spokePath(from: Point, to: Point): string {
  const dx = (to.x - from.x) * 0.5;
  return `M${from.x} ${from.y}C${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
}

function statsText(frame: FleetFrame): string {
  const parts = [`${frame.serving} running`];
  if (frame.starting > 0) parts.push(`${frame.starting} starting`);
  if (frame.stopping > 0) parts.push(`${frame.stopping} stopping`);
  parts.push(percent(frame.load));
  return parts.join(" · ");
}

/**
 * A component that scales out (D-82): its copies, each with the element's own icon, in a scale
 * set that grows and shrinks inside its room. New copies appear, start (the ring fills) and take
 * traffic (a green tick); leaving ones stop taking traffic, then go. Traffic fans out from where
 * it arrives to every copy that's running, and back out again.
 */
export const FleetNode = memo(function FleetNode({
  component,
  spokes,
}: {
  component: SceneComponent;
  spokes: SceneSpokes | null;
}) {
  const settings = useRender();
  const { theme, fontFamily } = settings;
  const source = useTimeSource();
  useIconCacheVersion();
  const scaling = component.scaling;
  const room: Box = scaling?.room ?? component.tile;
  const max = scaling?.kind === "out" ? scaling.max : 1;
  const framed = scaling?.kind === "out" && scaling.framed;
  const timeline = settings.capacity?.timeline ?? null;
  const ends = { in: spokes?.in ?? [], out: spokes?.out ?? [] };
  const refs = useRef<Refs>({
    frame: null,
    label: null,
    stats: null,
    copies: Array.from({ length: POOL }, emptyCopy),
    spokes: [],
    dots: [],
  }).current;

  const now = currentTime(source);
  const frameAt = (t: number): FleetFrame | null =>
    timeline === null ? null : fleetFrame(timeline, component.name, room, max, t);
  const frame = frameAt(now);
  const href = iconHref(component.icon, theme);
  const green = tone("green", theme.mode).solid;
  const violet = tone("violet", theme.mode).solid;
  const overloadColor = tone("orange", theme.mode).solid;

  // Copies, spokes and the frame change every frame while traffic flows or copies come and go.
  useFrame(timeline !== null, (t) => {
    const next = frameAt(t);
    if (next === null) return;
    apply(next, t);
  });

  function apply(next: FleetFrame, t: number): void {
    if (!framed) {
      refs.frame?.setAttribute("width", String(next.frame.w));
      refs.frame?.setAttribute("height", String(next.frame.h));
      refs.frame?.setAttribute("stroke", next.load > 1 ? overloadColor : theme.tileBorder);
    }
    refs.label?.setAttribute("transform", `translate(0 ${next.frame.h - room.h})`);
    if (refs.stats !== null) refs.stats.textContent = statsText(next);
    next.copies.forEach((copy, index) => {
      const r = refs.copies[index];
      if (r === undefined) return;
      if (copy === null) {
        r.group?.setAttribute("opacity", "0");
        return;
      }
      r.group?.setAttribute("opacity", String(copy.opacity));
      r.group?.setAttribute("transform", copyTransform(copy));
      r.color?.setAttribute("opacity", copy.serving ? "1" : "0");
      r.grey?.setAttribute("opacity", copy.serving ? "0" : "0.75");
      r.tile?.setAttribute("stroke-dasharray", copy.leaving ? "4 3" : "none");
      r.ring?.setAttribute("opacity", String(copy.ringOpacity));
      r.ring?.setAttribute("stroke-dasharray", `${CIRCUMFERENCE * copy.boot} ${CIRCUMFERENCE}`);
      r.tick?.setAttribute("opacity", String(copy.tickOpacity));
      r.bar?.setAttribute("opacity", copy.serving ? "1" : "0.35");
      r.barFill?.setAttribute("width", String(BAR.w * Math.min(1, copy.load)));
      r.barFill?.setAttribute("fill", loadColor(copy.load, theme));
    });
    // Spokes: from where traffic arrives to each running copy, and from each copy onward.
    const all = [
      ...ends.in.map((end) => ({ end, out: false })),
      ...ends.out.map((end) => ({ end, out: true })),
    ];
    // Each spoke carries its copy's share: the more copies, the fewer dots on each, so the fan
    // reads as traffic being split rather than multiplied. Busier copies still get denser dots.
    const share = Math.sqrt(Math.max(1, next.serving));
    all.forEach(({ end, out }, e) => {
      next.copies.forEach((copy, index) => {
        const k = e * max + index;
        const line = refs.spokes[k];
        const dots = refs.dots[k];
        if (copy === null || !copy.serving) {
          line?.setAttribute("opacity", "0");
          dots?.setAttribute("opacity", "0");
          return;
        }
        const side = tileSide(copy, end.at);
        const d = out ? spokePath(side, end.at) : spokePath(end.at, side);
        line?.setAttribute("d", d);
        line?.setAttribute("opacity", String(0.3 * copy.opacity));
        dots?.setAttribute("d", d);
        const busy = Math.min(1.6, Math.max(0.5, Math.sqrt(copy.load + 0.05)));
        const spacing = (DOT_SPACING * share) / busy;
        // Offset each copy's dots so the fan doesn't pulse in step.
        const phase = (index * 0.37 * spacing) % spacing;
        dots?.setAttribute("stroke-dasharray", `0 ${spacing}`);
        dots?.setAttribute("stroke-dashoffset", String(-((t * 38 + phase) % spacing)));
        dots?.setAttribute("opacity", String(copy.opacity));
      });
    });
  }

  const labelY = room.y + room.h + 18;
  const pool = Array.from({ length: Math.min(max, POOL) }, (_, index) => index);
  const allEnds = [...ends.in, ...ends.out];
  /** A ref callback for one part of one copy. */
  const part =
    <K extends keyof CopyRefs>(index: number, key: K) =>
    (node: CopyRefs[K]) => {
      const r = refs.copies[index];
      if (r !== undefined) r[key] = node;
    };

  return (
    <ExportLink link={component.link} mode={settings.mode}>
      <g
        data-element={component.name}
        data-kind="component"
        data-scaling="out"
        data-state={component.state.to}
        {...actionProps(settings, component.label)}
        opacity={focusOpacity(settings, component.name)}
        style={{ transition: "opacity 400ms ease" }}
      >
        {component.tooltip !== null ? <title>{component.tooltip}</title> : null}
        {/* The room it can grow into, faint: how far it can scale. */}
        {!framed ? (
          <>
            <rect
              data-part="room"
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              rx={RADIUS + 4}
              fill="none"
              stroke={theme.tileBorder}
              strokeDasharray="3 5"
              opacity={0.55}
            />
            <rect
              ref={(node) => void (refs.frame = node)}
              data-part="frame"
              x={room.x}
              y={room.y}
              width={frame?.frame.w ?? room.w}
              height={frame?.frame.h ?? room.h}
              rx={RADIUS + 4}
              fill={theme.base}
              fillOpacity={0.35}
              stroke={(frame?.load ?? 0) > 1 ? overloadColor : theme.tileBorder}
              strokeWidth={1.25}
            />
          </>
        ) : null}
        <g data-part="spokes" pointerEvents="none">
          {allEnds.flatMap((end, e) =>
            pool.map((index) => (
              <g key={`${end.connection}-${e}-${index}`}>
                <path
                  ref={(node) => void (refs.spokes[e * max + index] = node)}
                  fill="none"
                  stroke={theme.line}
                  strokeWidth={1}
                  opacity={0}
                />
                <path
                  ref={(node) => void (refs.dots[e * max + index] = node)}
                  fill="none"
                  stroke={component.color ?? green}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeDasharray={`0 ${DOT_SPACING}`}
                  opacity={0}
                />
              </g>
            )),
          )}
        </g>
        {pool.map((index) => {
          const copy = frame?.copies[index] ?? null;
          return (
            <g
              key={index}
              data-copy={index}
              data-serving={copy?.serving === true ? "true" : undefined}
              ref={part(index, "group")}
              opacity={copy?.opacity ?? 0}
              transform={copyTransform(copy ?? { x: room.x, y: room.y, scale: 1 })}
            >
              <circle
                ref={part(index, "ring")}
                cx={TILE / 2}
                cy={TILE / 2}
                r={RING}
                fill="none"
                stroke={violet}
                strokeWidth={2}
                strokeLinecap="round"
                transform={`rotate(-90 ${TILE / 2} ${TILE / 2})`}
                strokeDasharray={`${CIRCUMFERENCE * (copy?.boot ?? 1)} ${CIRCUMFERENCE}`}
                opacity={copy?.ringOpacity ?? 0}
              />
              <rect
                ref={part(index, "tile")}
                width={TILE}
                height={TILE}
                rx={RADIUS}
                fill={theme.tile}
                stroke={theme.tileBorder}
                strokeWidth={1}
              />
              <rect
                x={1}
                y={1}
                width={TILE - 2}
                height={TILE / 2}
                rx={RADIUS - 1}
                fill={`url(#${settings.ids.sheen})`}
              />
              {href != null ? (
                <>
                  <image
                    ref={part(index, "color")}
                    href={href}
                    x={(TILE - ICON) / 2}
                    y={(TILE - ICON) / 2}
                    width={ICON}
                    height={ICON}
                    opacity={copy?.serving === false ? 0 : 1}
                  />
                  <image
                    ref={part(index, "grey")}
                    href={href}
                    x={(TILE - ICON) / 2}
                    y={(TILE - ICON) / 2}
                    width={ICON}
                    height={ICON}
                    filter={`url(#${settings.ids.desaturate})`}
                    opacity={copy?.serving === false ? 0.75 : 0}
                  />
                </>
              ) : null}
              <g
                ref={part(index, "tick")}
                opacity={copy?.tickOpacity ?? 0}
                transform={`translate(${TILE - 4} 4)`}
              >
                <circle r={7} fill={green} />
                <path
                  d="M-3 0l2 2 4-4"
                  fill="none"
                  stroke={theme.base}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              <g
                ref={part(index, "bar")}
                transform={`translate(${(TILE - BAR.w) / 2} ${TILE + BAR.gap})`}
              >
                <rect width={BAR.w} height={BAR.h} rx={BAR.h / 2} fill={theme.tileBorder} />
                <rect
                  ref={part(index, "barFill")}
                  width={BAR.w * Math.min(1, copy?.load ?? 0)}
                  height={BAR.h}
                  rx={BAR.h / 2}
                  fill={loadColor(copy?.load ?? 0, theme)}
                />
              </g>
            </g>
          );
        })}
        <g
          ref={(node) => void (refs.label = node)}
          transform={`translate(0 ${(frame?.frame.h ?? room.h) - room.h})`}
        >
          <text
            x={room.x + 4}
            y={labelY}
            fontSize={12}
            fontWeight={600}
            fill={theme.text}
            style={{ fontFamily }}
          >
            {component.label}
          </text>
          <text
            ref={(node) => void (refs.stats = node)}
            x={room.x + 4}
            y={labelY + 14}
            fontSize={11}
            fill={theme.textMuted}
            style={{ fontFamily }}
          >
            {frame === null ? "" : statsText(frame)}
          </text>
        </g>
      </g>
    </ExportLink>
  );
});
