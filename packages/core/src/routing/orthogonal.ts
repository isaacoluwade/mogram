import { inflate, intersects, union, type Box, type Point } from "../layout/geometry";
import { MinHeap } from "./heap";
import { simplify } from "./path";

/**
 * Orthogonal connector routing (ED-17).
 *
 * Builds a sparse grid from "rulers" — the inflated edges of obstacles plus the port lines —
 * then runs A* over (node, heading) states with a penalty per bend. Rulers make the grid tiny
 * compared with a pixel grid while still containing every useful turning point, so routes hug
 * obstacles cleanly and stay fast enough to recompute on every edit.
 */

export type Side = "top" | "right" | "bottom" | "left";

/** An end pinned to one side, `offset` px from that side's midpoint (positive = right/down). */
export interface FixedPort {
  readonly side: Side;
  readonly offset: number;
}

export interface RouteRequest {
  readonly source: Box;
  readonly target: Box;
  /** Boxes the route must not pass through (endpoints and their ancestors excluded by caller). */
  readonly obstacles: readonly Box[];
  /** Extra cost for leaving/entering a side (e.g. a component's label sits under its tile). */
  readonly sidePenalty?: Partial<Record<Side, number>>;
  /** Pins the ends to a side and position, so several connections on one side don't overlap. */
  readonly sourcePort?: FixedPort;
  readonly targetPort?: FixedPort;
}

const MARGIN = 12;
export const STUB = 14;
const BEND_COST = 36;
const MAX_NODES = 60_000;
const DIRS: readonly Side[] = ["top", "right", "bottom", "left"];

const OUTWARD: Readonly<Record<Side, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function sidePoint(box: Box, side: Side): Point {
  switch (side) {
    case "top":
      return { x: box.x + box.w / 2, y: box.y };
    case "right":
      return { x: box.x + box.w, y: box.y + box.h / 2 };
    case "bottom":
      return { x: box.x + box.w / 2, y: box.y + box.h };
    case "left":
      return { x: box.x, y: box.y + box.h / 2 };
  }
}

interface Port {
  readonly side: Side;
  readonly point: Point;
  readonly stub: Point;
  readonly penalty: number;
}

/** A point on `side`, moved `offset` px along it from the midpoint (clamped inside the side). */
export function sidePointAt(box: Box, side: Side, offset: number): Point {
  const mid = sidePoint(box, side);
  if (side === "top" || side === "bottom") {
    const limit = box.w / 2 - 4;
    return { x: mid.x + Math.max(-limit, Math.min(limit, offset)), y: mid.y };
  }
  const limit = box.h / 2 - 4;
  return { x: mid.x, y: mid.y + Math.max(-limit, Math.min(limit, offset)) };
}

function portsOf(
  box: Box,
  other: Box,
  extraPenalty: Partial<Record<Side, number>>,
  fixed?: FixedPort,
): Port[] {
  if (fixed !== undefined) {
    const point = sidePointAt(box, fixed.side, fixed.offset);
    const out = OUTWARD[fixed.side];
    return [
      {
        side: fixed.side,
        point,
        stub: { x: point.x + out.x * STUB, y: point.y + out.y * STUB },
        penalty: 0,
      },
    ];
  }
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const ox = other.x + other.w / 2;
  const oy = other.y + other.h / 2;
  return DIRS.map((side) => {
    const point = sidePoint(box, side);
    const out = OUTWARD[side];
    // Prefer sides that face the other end.
    const facing = out.x * (ox - cx) + out.y * (oy - cy);
    const penalty = (facing > 0 ? 0 : 60) + (extraPenalty[side] ?? 0);
    return { side, point, stub: { x: point.x + out.x * STUB, y: point.y + out.y * STUB }, penalty };
  });
}

/** Returns the routed polyline, or a simple elbow when no clear route exists. */
export function routeOrthogonal(request: RouteRequest): Point[] {
  const { source, target } = request;
  const penalty = request.sidePenalty ?? {};
  const sourcePorts = portsOf(source, target, penalty, request.sourcePort);
  const targetPorts = portsOf(target, source, penalty, request.targetPort);

  // Only obstacles near the two ends matter; this keeps the grid small on big diagrams.
  const region = inflate(union([source, target]) ?? source, 320);
  const obstacles = request.obstacles
    .filter((box) => intersects(box, region))
    .map((box) => inflate(box, MARGIN));

  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const box of obstacles) {
    xs.add(box.x);
    xs.add(box.x + box.w);
    ys.add(box.y);
    ys.add(box.y + box.h);
  }
  for (const port of [...sourcePorts, ...targetPorts]) {
    xs.add(port.stub.x);
    ys.add(port.stub.y);
  }
  const bounds = inflate(union([region, ...obstacles]) ?? region, MARGIN * 2);
  xs.add(bounds.x);
  xs.add(bounds.x + bounds.w);
  ys.add(bounds.y);
  ys.add(bounds.y + bounds.h);
  xs.add((source.x + source.w / 2 + target.x + target.w / 2) / 2);
  ys.add((source.y + source.h / 2 + target.y + target.h / 2) / 2);

  const xList = [...xs].sort((a, b) => a - b);
  const yList = [...ys].sort((a, b) => a - b);
  if (xList.length * yList.length > MAX_NODES) return elbow(source, target);

  const blocked = (x: number, y: number): boolean =>
    obstacles.some(
      (box) =>
        x > box.x + 0.01 &&
        x < box.x + box.w - 0.01 &&
        y > box.y + 0.01 &&
        y < box.y + box.h - 0.01,
    );

  const cols = xList.length;
  const index = (col: number, row: number): number => row * cols + col;
  const open = new Uint8Array(cols * yList.length);
  for (let row = 0; row < yList.length; row++) {
    for (let col = 0; col < cols; col++) {
      open[index(col, row)] = blocked(xList[col] ?? 0, yList[row] ?? 0) ? 0 : 1;
    }
  }
  const colOf = new Map(xList.map((x, i) => [x, i]));
  const rowOf = new Map(yList.map((y, i) => [y, i]));

  // A segment between neighbouring rulers is blocked only if its midpoint is inside an obstacle.
  const passable = (x1: number, y1: number, x2: number, y2: number): boolean =>
    !blocked((x1 + x2) / 2, (y1 + y2) / 2);

  const goals = new Map<number, Port>();
  for (const port of targetPorts) {
    const col = colOf.get(port.stub.x);
    const row = rowOf.get(port.stub.y);
    if (col !== undefined && row !== undefined && open[index(col, row)] === 1)
      goals.set(index(col, row), port);
  }
  if (goals.size === 0) return elbow(source, target);

  const heuristic = (col: number, row: number): number => {
    let best = Infinity;
    for (const port of goals.values()) {
      best = Math.min(
        best,
        Math.abs((xList[col] ?? 0) - port.stub.x) + Math.abs((yList[row] ?? 0) - port.stub.y),
      );
    }
    return best;
  };

  // State = node index * 4 + heading.
  const cost = new Map<number, number>();
  const previous = new Map<number, number>();
  const startPort = new Map<number, Port>();
  const heap = new MinHeap<number>();
  for (const port of sourcePorts) {
    const col = colOf.get(port.stub.x);
    const row = rowOf.get(port.stub.y);
    if (col === undefined || row === undefined || open[index(col, row)] !== 1) continue;
    const state = index(col, row) * 4 + DIRS.indexOf(port.side);
    const initial = STUB + port.penalty;
    if (initial < (cost.get(state) ?? Infinity)) {
      cost.set(state, initial);
      startPort.set(state, port);
      heap.push(state, initial + heuristic(col, row));
    }
  }

  let bestGoal: { state: number; total: number; port: Port } | null = null;
  while (heap.size > 0) {
    const state = heap.pop();
    if (state === undefined) break;
    const current = cost.get(state) ?? Infinity;
    if (bestGoal !== null && current >= bestGoal.total) break;
    const node = Math.floor(state / 4);
    const heading = state % 4;
    const col = node % cols;
    const row = Math.floor(node / cols);

    const goal = goals.get(node);
    if (goal !== undefined) {
      // Must arrive travelling into the target side, i.e. opposite to its outward direction.
      const arriving = DIRS[heading];
      const needed = opposite(goal.side);
      const total = current + STUB + goal.penalty + (arriving === needed ? 0 : BEND_COST);
      if (bestGoal === null || total < bestGoal.total) bestGoal = { state, total, port: goal };
    }

    for (let dir = 0; dir < 4; dir++) {
      const side = DIRS[dir];
      if (side === undefined) continue;
      const step = OUTWARD[side];
      const nextCol = col + step.x;
      const nextRow = row + step.y;
      if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= yList.length) continue;
      const nextNode = index(nextCol, nextRow);
      if (open[nextNode] !== 1) continue;
      const x1 = xList[col] ?? 0;
      const y1 = yList[row] ?? 0;
      const x2 = xList[nextCol] ?? 0;
      const y2 = yList[nextRow] ?? 0;
      if (!passable(x1, y1, x2, y2)) continue;
      const reverse = dir === (heading + 2) % 4;
      if (reverse) continue;
      const stepCost = Math.abs(x2 - x1) + Math.abs(y2 - y1) + (dir === heading ? 0 : BEND_COST);
      const nextState = nextNode * 4 + dir;
      const nextCost = current + stepCost;
      if (nextCost < (cost.get(nextState) ?? Infinity)) {
        cost.set(nextState, nextCost);
        previous.set(nextState, state);
        heap.push(nextState, nextCost + heuristic(nextCol, nextRow));
      }
    }
  }

  if (bestGoal === null) return elbow(source, target);

  const nodes: Point[] = [];
  let walk: number | undefined = bestGoal.state;
  let first = bestGoal.state;
  while (walk !== undefined) {
    const node = Math.floor(walk / 4);
    nodes.push({ x: xList[node % cols] ?? 0, y: yList[Math.floor(node / cols)] ?? 0 });
    first = walk;
    walk = previous.get(walk);
  }
  nodes.reverse();
  const start = startPort.get(first);
  if (start === undefined) return elbow(source, target);
  return simplify([start.point, ...nodes, bestGoal.port.point]);
}

/** The side a routed polyline leaves its source from (`start`) or enters its target on (`end`). */
export function endSide(points: readonly Point[], end: "start" | "end"): Side | null {
  const [a, b] =
    end === "start"
      ? [points[0], points[1]]
      : [points[points.length - 1], points[points.length - 2]];
  if (a === undefined || b === undefined) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

function opposite(side: Side): Side {
  switch (side) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/** Facing sides of two boxes, used by the fallback and by curved/straight routes. */
export function facingSides(source: Box, target: Box): { from: Side; to: Side } {
  const dx = target.x + target.w / 2 - (source.x + source.w / 2);
  const dy = target.y + target.h / 2 - (source.y + source.h / 2);
  if (Math.abs(dx) >= Math.abs(dy))
    return dx >= 0 ? { from: "right", to: "left" } : { from: "left", to: "right" };
  return dy >= 0 ? { from: "bottom", to: "top" } : { from: "top", to: "bottom" };
}

/** A simple three-segment orthogonal route between facing sides. */
export function elbow(source: Box, target: Box): Point[] {
  const { from, to } = facingSides(source, target);
  const a = sidePoint(source, from);
  const b = sidePoint(target, to);
  if (from === "left" || from === "right") {
    const midX = (a.x + b.x) / 2;
    return simplify([a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]);
  }
  const midY = (a.y + b.y) / 2;
  return simplify([a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]);
}

/**
 * A route through hand-placed waypoints (ED-18). Each end leaves or enters perpendicular to
 * the side facing its nearest waypoint; corners keep the previous direction where possible so
 * the path has as few bends as the waypoints allow.
 */
export function routeThrough(
  source: Box,
  target: Box,
  via: readonly Point[],
  ports: { readonly sourcePort?: FixedPort; readonly targetPort?: FixedPort } = {},
): Point[] {
  const firstVia = via[0];
  const lastVia = via[via.length - 1];
  if (firstVia === undefined || lastVia === undefined) return elbow(source, target);
  // A fixed port wins; otherwise leave from the side facing the waypoint, level with it when
  // the side spans it, so a waypoint in line with an element gives a straight line, no jog.
  const startSide = ports.sourcePort?.side ?? sideToward(source, firstVia);
  const endSide = ports.targetPort?.side ?? sideToward(target, lastVia);
  const start =
    ports.sourcePort !== undefined
      ? sidePointAt(source, ports.sourcePort.side, ports.sourcePort.offset)
      : alignedSidePoint(source, startSide, firstVia);
  const end =
    ports.targetPort !== undefined
      ? sidePointAt(target, ports.targetPort.side, ports.targetPort.offset)
      : alignedSidePoint(target, endSide, lastVia);
  const startStub = offset(start, startSide, STUB);
  const endStub = offset(end, endSide, STUB);

  const points: Point[] = [start, startStub];
  let horizontal = isHorizontal(startSide);
  const stops = [...via, endStub];
  stops.forEach((next, index) => {
    const current = points[points.length - 1] ?? start;
    const intoEnd = index === stops.length - 1;
    if (current.x !== next.x && current.y !== next.y) {
      // Into the end stub, arrive along the end side's axis; elsewhere keep going straight first.
      const finalHorizontal = intoEnd ? isHorizontal(endSide) : !horizontal;
      points.push(finalHorizontal ? { x: current.x, y: next.y } : { x: next.x, y: current.y });
      horizontal = finalHorizontal;
    } else {
      horizontal = current.y === next.y;
    }
    points.push(next);
  });
  points.push(end);
  return simplify(points);
}

/** The point on `side` level with `toward` when the side spans it, else the side's midpoint. */
export function alignedSidePoint(box: Box, side: Side, toward: Point): Point {
  const inset = 4;
  if (side === "left" || side === "right") {
    const y =
      toward.y >= box.y + inset && toward.y <= box.y + box.h - inset ? toward.y : box.y + box.h / 2;
    return { x: side === "left" ? box.x : box.x + box.w, y };
  }
  const x =
    toward.x >= box.x + inset && toward.x <= box.x + box.w - inset ? toward.x : box.x + box.w / 2;
  return { x, y: side === "top" ? box.y : box.y + box.h };
}

function isHorizontal(side: Side): boolean {
  return side === "left" || side === "right";
}

function offset(point: Point, side: Side, distance: number): Point {
  const out = OUTWARD[side];
  return { x: point.x + out.x * distance, y: point.y + out.y * distance };
}

export function sideToward(box: Box, point: Point): Side {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = (point.x - cx) / Math.max(1, box.w);
  const dy = (point.y - cy) / Math.max(1, box.h);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}
