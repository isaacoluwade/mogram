"use client";

import { useRef, type ReactNode } from "react";
import type { Point } from "@mogram/core/layout";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { progressAt } from "../frames";
import type { Pair, Travel } from "../scene";
import { useRender } from "./render-context";

/**
 * How a thing takes part in a change of picture (D-86): it stays (perhaps more or less faded),
 * or it's the old or the new version of something whose words or look are changing.
 */
export type PresenceRole = "stay" | "old" | "new";

/** How much smaller something starts as it arrives, growing to full size. */
const ARRIVE_SCALE = 0.9;

/**
 * Strength at eased progress `p`. A crossfade keeps the pair nearly solid throughout: the old
 * version lingers and the new one comes in early, so nothing behind shows through half-way.
 */
function strengthAt(pair: Pair<number>, role: PresenceRole, p: number): number {
  if (role === "old") return pair.from * (1 - p * p);
  if (role === "new") return pair.to * (1 - (1 - p) * (1 - p));
  return pair.from + (pair.to - pair.from) * p;
}

function scaleAt(pair: Pair<number>, role: PresenceRole, origin: Point | null, p: number): string {
  // Only something arriving from nothing grows; fading, leaving and crossfades hold still.
  if (origin === null || role !== "stay" || pair.from !== 0 || p >= 1) return "";
  const scale = ARRIVE_SCALE + (1 - ARRIVE_SCALE) * p;
  return `translate(${origin.x} ${origin.y}) scale(${scale}) translate(${-origin.x} ${-origin.y})`;
}

/** The point a fraction `p` of the way along a line. */
function pointOnLine(line: readonly Point[], p: number): Point {
  const first = line[0] ?? { x: 0, y: 0 };
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] ?? first;
    const b = line[i] ?? first;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  let left = total * Math.min(1, Math.max(0, p));
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] ?? first;
    const b = line[i] ?? first;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= length && length > 0)
      return { x: a.x + ((b.x - a.x) * left) / length, y: a.y + ((b.y - a.y) * left) / length };
    left -= length;
  }
  return line.at(-1) ?? first;
}

/**
 * How far something on its way is from where it'll end up (D-87): it's drawn at its new place
 * and shifted back along its route. It leaves and joins the route's ends from its own places.
 */
function travelAt(travel: Travel, p: number): string {
  if (p >= 1) return "";
  let at: Point;
  if (travel.along === null || travel.along.length < 2) {
    at = {
      x: travel.from.x + (travel.to.x - travel.from.x) * p,
      y: travel.from.y + (travel.to.y - travel.from.y) * p,
    };
  } else {
    // From where it was to the line's start, along the line, then to where it's going.
    at = pointOnLine([travel.from, ...travel.along, travel.to], p);
  }
  return `translate(${at.x - travel.to.x} ${at.y - travel.to.y})`;
}

/**
 * Draws its children as strongly as they're there, easing between two strengths while the
 * picture changes. Every painted thing is wrapped in one, so nothing is re-created when a
 * change starts or ends.
 */
export function PresenceGroup({
  pair,
  role = "stay",
  origin = null,
  travel,
  children,
}: {
  pair: Pair<number> | undefined;
  role?: PresenceRole;
  /** The point it grows from as it arrives. */
  origin?: Point | null;
  /** It's on its way here from somewhere else. */
  travel?: Travel | undefined;
  children: ReactNode;
}) {
  const { transitionStart, transitionSeconds } = useRender();
  const source = useTimeSource();
  const node = useRef<SVGGElement | null>(null);
  const now = currentTime(source);
  const solid = { from: 1, to: 1 };
  const strength = pair ?? solid;
  const moving =
    transitionStart !== null &&
    (travel !== undefined || (pair !== undefined && (pair.from !== pair.to || role !== "stay")));
  const active = moving && now - transitionStart < transitionSeconds + 0.1;
  // Something on its way moves; it doesn't also grow.
  const transformAt = (p: number): string =>
    travel !== undefined ? travelAt(travel, p) : scaleAt(strength, role, origin, p);

  useFrame(active, (t) => {
    const p = progressAt(t, transitionStart, transitionSeconds);
    node.current?.setAttribute("opacity", String(strengthAt(strength, role, p)));
    const transform = transformAt(p);
    if (transform === "") node.current?.removeAttribute("transform");
    else node.current?.setAttribute("transform", transform);
  });

  if (pair === undefined && travel === undefined) return <g>{children}</g>;
  const p = progressAt(now, transitionStart, transitionSeconds);
  const opacity = strengthAt(strength, role, p);
  return (
    <g
      ref={node}
      opacity={opacity}
      transform={transformAt(p) || undefined}
      // Something that's gone, or on its way out, can't be clicked or tabbed to.
      style={strength.to === 0 || role === "old" ? { pointerEvents: "none" } : undefined}
      aria-hidden={strength.to === 0 || role === "old" ? true : undefined}
    >
      {children}
    </g>
  );
}
