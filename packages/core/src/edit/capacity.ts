import { Scalar, YAMLMap, YAMLSeq, type Node } from "yaml";
import { PATTERN_DEFAULTS } from "../capacity/patterns";
import type {
  Connection,
  Diagram,
  FlowBehaviour,
  ProjectFiles,
  Scale,
  TrafficPattern,
} from "../model/types";
import { edit, type EditResult } from "./context";
import { EditError, flowMap, setKey } from "./session";

/**
 * Writing capacity (D-82): how an element scales and what it does to traffic, as readable YAML
 * (`3x`, `70%`, `scale: { min: 2, max: 8 }`), only where it differs from the default.
 */

/** 0.7 → "70%". */
export function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

/** 3 → "3x", 0.5 → "0.5x". */
export function formatMultiple(value: number): string {
  return `${Math.round(value * 100) / 100}x`;
}

const DEFAULT_TARGET = 0.7;

/** `scale:` as written: a flow map for copies; sizes as a list, by name when that's all they say. */
export function scaleNode(scale: Scale): Node {
  if (scale.kind === "out") {
    const entries: [string, string | number][] = [
      ["min", scale.min],
      ["max", scale.max],
    ];
    if (Math.abs(scale.target - DEFAULT_TARGET) > 1e-9)
      entries.push(["target", formatPercent(scale.target)]);
    return flowMap(entries);
  }
  const map = new YAMLMap();
  const sizes = new YAMLSeq();
  const plain = scale.sizes.every(
    (size, index) =>
      size.cpu === null &&
      size.memory === null &&
      size.disks === null &&
      Math.abs(size.capacity - 2 ** index) < 1e-9,
  );
  sizes.flow = plain;
  map.flow = plain;
  scale.sizes.forEach((size, index) => {
    if (plain) {
      sizes.add(new Scalar(size.name));
      return;
    }
    const entries: [string, string | number][] = [["name", size.name]];
    if (size.cpu !== null) entries.push(["cpu", size.cpu]);
    if (size.memory !== null) entries.push(["memory", size.memory]);
    if (size.disks !== null) entries.push(["disks", size.disks]);
    if (Math.abs(size.capacity - 2 ** index) > 1e-9)
      entries.push(["capacity", formatMultiple(size.capacity)]);
    sizes.add(flowMap(entries));
  });
  map.set("sizes", sizes);
  if (Math.abs(scale.target - DEFAULT_TARGET) > 1e-9)
    map.set("target", formatPercent(scale.target));
  return map;
}

/** Writes a component's capacity keys onto its definition (copy and paste, D-82). */
export function writeFlowBehaviour(map: YAMLMap, element: FlowBehaviour): void {
  if (element.scale !== null) map.set("scale", scaleNode(element.scale));
  if (element.capacity !== null) map.set("capacity", formatMultiple(element.capacity));
  if (element.routing !== null) map.set("routing", element.routing);
  if (element.hit !== null) map.set("hit", formatPercent(element.hit));
  if (element.queue !== null) map.set("queue", element.queue);
}

/** A pattern as written: its name alone when it's the default one, else what differs. */
export function patternNode(pattern: TrafficPattern): Node {
  const base = PATTERN_DEFAULTS[pattern.kind];
  const entries: [string, string | number][] = [["pattern", pattern.kind]];
  if (Math.abs(pattern.high - base.high) > 1e-9)
    entries.push(["high", formatMultiple(pattern.high)]);
  if (Math.abs(pattern.low - base.low) > 1e-9) entries.push(["low", formatMultiple(pattern.low)]);
  if (Math.abs(pattern.every - base.every) > 1e-9) entries.push(["every", `${pattern.every}s`]);
  return entries.length === 1 ? new Scalar(pattern.kind) : flowMap(entries);
}

/** Writes a connection's traffic and share. */
export function writeConnectionCapacity(map: YAMLMap, connection: Connection): void {
  if (connection.pattern !== null) map.set("traffic", patternNode(connection.pattern));
  else if (connection.traffic !== null) map.set("traffic", formatMultiple(connection.traffic));
  if (connection.share !== null) map.set("share", formatPercent(connection.share));
}

/** Makes an element scale out or up, or stops it scaling (`null`). */
export function setScale(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly scale: Scale | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const component = diagram.components.get(args.name);
    if (component === undefined)
      throw new EditError(`Only components scale, and "${args.name}" isn't one.`);
    if (component.shape !== null && args.scale !== null)
      throw new EditError("Shapes are outlines, so they don't scale. Use an icon component.");
    if (args.scale?.kind === "out" && args.scale.min > args.scale.max)
      throw new EditError("The least copies can't be more than the most.");
    if (args.scale?.kind === "up" && args.scale.sizes.length === 0)
      throw new EditError("Scaling up needs at least one size.");
    const definition = ctx.definition(args.name);
    const node = args.scale === null ? undefined : scaleNode(args.scale);
    // Sizes with cores and memory read best one to a line, so the element opens up into a block.
    if (node instanceof YAMLMap && !node.flow) definition.flow = false;
    setKey(definition, "scale", node);
    return [args.name];
  });
}

/**
 * Gives a connection traffic that changes on its own (D-84), or makes it steady again (`null`,
 * keeping no level).
 */
export function setTrafficPattern(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly pattern: TrafficPattern | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    if (!diagram.connections.has(args.name))
      throw new EditError(`Traffic patterns are set on connections, and "${args.name}" isn't one.`);
    const pattern = args.pattern;
    if (pattern !== null && pattern.low > pattern.high)
      throw new EditError("The quiet traffic can't be above the busy traffic.");
    setKey(
      ctx.definition(args.name),
      "traffic",
      pattern === null ? undefined : patternNode(pattern),
    );
    return [args.name];
  });
}

/**
 * Sets one capacity key on a component (`capacity`, `routing`, `hit`, `queue`) or a connection
 * (`traffic`, `share`); `null` removes it.
 */
export function setFlowValue(
  files: ProjectFiles,
  diagram: Diagram,
  args:
    | { readonly name: string; readonly key: "capacity" | "traffic"; readonly value: number | null }
    | { readonly name: string; readonly key: "hit" | "share"; readonly value: number | null }
    | { readonly name: string; readonly key: "routing"; readonly value: "split" | "copy" | null }
    | { readonly name: string; readonly key: "queue"; readonly value: boolean | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const onConnection = args.key === "traffic" || args.key === "share";
    if (onConnection ? !diagram.connections.has(args.name) : !diagram.components.has(args.name))
      throw new EditError(
        `${args.key === "traffic" ? "Traffic" : args.key === "share" ? "A share" : `"${args.key}"`} is set on ${onConnection ? "connections" : "components"}, and "${args.name}" isn't one.`,
      );
    let written: string | boolean | undefined;
    switch (args.key) {
      case "capacity":
      case "traffic":
        written = args.value === null ? undefined : formatMultiple(args.value);
        break;
      case "hit":
      case "share":
        written = args.value === null ? undefined : formatPercent(args.value);
        break;
      case "routing":
        written = args.value ?? undefined;
        break;
      case "queue":
        written = args.value ?? undefined;
        break;
    }
    setKey(ctx.definition(args.name), args.key, written);
    return [args.name];
  });
}
