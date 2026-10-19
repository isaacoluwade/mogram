import { partOf } from "../model/parts";
import type { Diagram, SceneCapacity, SceneEntry } from "../model/types";
import { planCapacity, type CapacityInput, type CapacityPlan } from "../capacity/plan";
import { nextPatternChange, patternCycle, type CapacityOverTime } from "../capacity/patterns";
import { severityOf } from "../presets/state";
import type { FlowPreset, MotionPreset, StatePreset } from "../presets/names";
import type { Picture } from "../picture/picture";

/**
 * Effective state of every element for one moment (SC-1 … SC-4, NE-11, NE-12, D-12).
 *
 * Layers, lowest to highest priority: the element's base state in the file → the active
 * scene's entry → the viewer's own change (SH-3). On top of that:
 *  - cascade: anything inside an effectively-down container (or a down nested-diagram owner)
 *    is down;
 *  - roll-up: a container without its own state shows the worst state inside, softened so a
 *    broken child makes the parent "degraded", not "down";
 *  - connections into or out of something down are blocked unless the scene says otherwise,
 *    and `backup_for` connections take over ("rerouted") when the one they back up is blocked.
 */

export type StateReason = "normal" | "base" | "scene" | "viewer" | "cascade" | "rollup" | "load";
export type FlowReason = "normal" | "base" | "scene" | "viewer" | "endpoint-down" | "backup";

export interface ElementStatus {
  readonly state: StatePreset;
  readonly motion: MotionPreset;
  readonly reason: StateReason;
}

export interface ConnectionStatus {
  readonly flow: FlowPreset;
  readonly reason: FlowReason;
}

export interface ResolvedState {
  readonly elements: ReadonlyMap<string, ElementStatus>;
  readonly connections: ReadonlyMap<string, ConnectionStatus>;
  /** Traffic, copies, sizes and load (D-82); with patterns, at the start of a cycle (quiet). */
  readonly capacity: CapacityPlan;
  /** When traffic follows patterns (D-84), the plan over time; null when it's steady. */
  readonly capacityOverTime: CapacityOverTime | null;
  /** Entries for each nested instance, keyed by the owning component, with the prefix removed (SC-10). */
  readonly nested: ReadonlyMap<
    string,
    { readonly scene: readonly SceneEntry[]; readonly viewer: readonly SceneEntry[] }
  >;
  /**
   * The picture this was resolved from (D-86): what's there, with labels and looks as they
   * stand. Null when a diagram was resolved as written.
   */
  readonly picture: Picture | null;
}

/** The plan over time when connections carry patterns, else null. */
function overTime(
  input: CapacityInput,
  overrides: ReadonlyMap<string, SceneCapacity>,
): CapacityOverTime | null {
  const patterned = [...input.diagram.connections.values()].filter(
    (c) => c.pattern !== null && overrides.get(c.name)?.traffic === undefined,
  );
  if (patterned.length === 0) return null;
  const patterns = patterned.flatMap((c) => (c.pattern === null ? [] : [c.pattern]));
  const at = (level: "low" | "high") => {
    const held = new Map(overrides);
    for (const c of patterned)
      if (c.pattern !== null)
        held.set(c.name, {
          ...held.get(c.name),
          traffic: level === "low" ? c.pattern.low : c.pattern.high,
        });
    return planCapacity({ ...input, overrides: held });
  };
  return {
    planAt: (time) => planCapacity({ ...input, time }),
    nextChange: (after) => Math.min(...patterns.map((p) => nextPatternChange(p, after))),
    cycle: patternCycle(patterns),
    quiet: at("low"),
    busy: at("high"),
  };
}

export interface ResolveInput {
  readonly diagram: Diagram;
  /** Entries of the active scene (empty for Normal). */
  readonly scene?: readonly SceneEntry[];
  /**
   * The picture to resolve (D-86), in place of `diagram` and `scene`: what's hidden in it is
   * already gone, so nothing here sees it.
   */
  readonly picture?: Picture;
  /** Changes made by a viewer when the share allows it (SH-3). */
  readonly viewer?: readonly SceneEntry[];
  /** True when the component that opens this nested diagram is down (NE-11). */
  readonly ownerDown?: boolean;
  /**
   * Worst state inside the nested instance opened by `component`, or null when it isn't loaded
   * (NE-12). Provided by `@mogram/core/nested`, which resolves instances recursively.
   */
  readonly nestedWorst?: (component: string, entries: NestedEntries) => StatePreset | null;
  /** Everything entering the diagram, times this (the traffic slider, D-82). */
  readonly traffic?: number;
}

export interface NestedEntries {
  readonly scene: readonly SceneEntry[];
  readonly viewer: readonly SceneEntry[];
}

interface Split {
  readonly own: Map<string, SceneEntry>;
  readonly nested: Map<string, SceneEntry[]>;
}

function split(entries: readonly SceneEntry[], diagram: Diagram): Split {
  const own = new Map<string, SceneEntry>();
  const nested = new Map<string, SceneEntry[]>();
  for (const entry of entries) {
    const dot = entry.target.indexOf(".");
    // A part (D-104) is the element's own; anything else after a dot is inside a nested one.
    if (dot === -1 || partOf(diagram.components, entry.target) !== null) {
      own.set(entry.target, entry);
      continue;
    }
    const owner = entry.target.slice(0, dot);
    const list = nested.get(owner) ?? [];
    list.push({ ...entry, target: entry.target.slice(dot + 1) });
    nested.set(owner, list);
  }
  return { own, nested };
}

/** Roll-up of child states (D-12): only "scaling" and "degraded" ever reach the parent. */
export function rollupState(
  children: readonly StatePreset[],
  rule: "worst" | "best" | "none",
): StatePreset {
  if (rule === "none" || children.length === 0) return "healthy";
  const severities = children.map(severityOf);
  const pick = rule === "worst" ? Math.max(...severities) : Math.min(...severities);
  if (pick >= severityOf("degraded")) return "degraded";
  if (pick === severityOf("scaling")) return "scaling";
  return "healthy";
}

export function resolveState(input: ResolveInput): ResolvedState {
  const diagram = input.picture?.diagram ?? input.diagram;
  const scene = split(input.picture?.entries ?? input.scene ?? [], diagram);
  const viewer = split(input.viewer ?? [], diagram);

  // 1. Own state: viewer > scene > base.
  const own = new Map<string, ElementStatus & { explicit: boolean }>();
  const placeables = [...diagram.containers.values(), ...diagram.components.values()];
  for (const element of placeables) {
    const viewerEntry = viewer.own.get(element.name);
    const sceneEntry = scene.own.get(element.name);
    const baseMotion = element.kind === "component" ? element.motion : "none";
    const motion = viewerEntry?.motion ?? sceneEntry?.motion ?? baseMotion;
    if (viewerEntry?.state != null) {
      own.set(element.name, { state: viewerEntry.state, motion, reason: "viewer", explicit: true });
    } else if (sceneEntry?.state != null) {
      own.set(element.name, { state: sceneEntry.state, motion, reason: "scene", explicit: true });
    } else if (element.hasExplicitState) {
      own.set(element.name, { state: element.state, motion, reason: "base", explicit: true });
    } else {
      own.set(element.name, { state: "healthy", motion, reason: "normal", explicit: false });
    }
  }

  // 2. Cascade top-down from down containers and a down owner.
  const parentOf = (name: string): string | null =>
    diagram.containers.get(name)?.parent ?? diagram.components.get(name)?.parent ?? null;
  const cascades = new Map<string, boolean>();
  const isCascaded = (name: string): boolean => {
    const known = cascades.get(name);
    if (known !== undefined) return known;
    cascades.set(name, false); // guards against cycles
    let result = input.ownerDown === true;
    const parent = parentOf(name);
    if (!result && parent !== null) {
      const parentOwn = own.get(parent);
      result = isCascaded(parent) || (parentOwn?.explicit === true && parentOwn.state === "down");
    }
    cascades.set(name, result);
    return result;
  };

  const status = new Map<string, ElementStatus>();
  for (const element of placeables) {
    const mine = own.get(element.name);
    if (mine === undefined) continue;
    if (isCascaded(element.name))
      status.set(element.name, { state: "down", motion: mine.motion, reason: "cascade" });
    else status.set(element.name, { state: mine.state, motion: mine.motion, reason: mine.reason });
  }

  // 3. Nested roll-up for components that open a diagram (NE-12).
  for (const component of diagram.components.values()) {
    if (component.opens === null || input.nestedWorst === undefined) continue;
    const current = status.get(component.name);
    if (current === undefined || current.reason !== "normal") continue;
    const worst = input.nestedWorst(component.name, {
      scene: scene.nested.get(component.name) ?? [],
      viewer: viewer.nested.get(component.name) ?? [],
    });
    if (worst === null) continue;
    const rolled = rollupState([worst], "worst");
    if (rolled !== "healthy")
      status.set(component.name, { state: rolled, motion: current.motion, reason: "rollup" });
  }

  // 5. Connections: explicit layers, then endpoint-down blocking, then backups.
  const connections = new Map<string, ConnectionStatus & { explicit: boolean }>();
  for (const connection of diagram.connections.values()) {
    const viewerEntry = viewer.own.get(connection.name);
    const sceneEntry = scene.own.get(connection.name);
    if (viewerEntry?.flow != null) {
      connections.set(connection.name, {
        flow: viewerEntry.flow,
        reason: "viewer",
        explicit: true,
      });
    } else if (sceneEntry?.flow != null) {
      connections.set(connection.name, { flow: sceneEntry.flow, reason: "scene", explicit: true });
    } else {
      const endDown =
        status.get(connection.from.element)?.state === "down" ||
        status.get(connection.to.element)?.state === "down";
      if (endDown)
        connections.set(connection.name, {
          flow: "blocked",
          reason: "endpoint-down",
          explicit: false,
        });
      else
        connections.set(connection.name, {
          flow: connection.flow,
          reason: connection.hasExplicitFlow ? "base" : "normal",
          explicit: false,
        });
    }
  }
  for (let pass = 0; pass < diagram.connections.size; pass++) {
    let changed = false;
    for (const connection of diagram.connections.values()) {
      if (connection.backupFor === null) continue;
      const current = connections.get(connection.name);
      if (
        current === undefined ||
        current.explicit ||
        current.reason === "endpoint-down" ||
        current.reason === "backup"
      )
        continue;
      if (connections.get(connection.backupFor)?.flow === "blocked") {
        connections.set(connection.name, { flow: "rerouted", reason: "backup", explicit: false });
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 6. Capacity: traffic through the diagram, then load (D-82). Something measured that's
  // over 100% is overloaded, unless a state is set for it.
  const overrides = new Map<string, SceneCapacity>();
  for (const layer of [scene.own, viewer.own])
    for (const [target, entry] of layer)
      if (entry.capacity !== undefined)
        overrides.set(target, { ...overrides.get(target), ...entry.capacity });
  const planInput: CapacityInput = {
    diagram,
    states: new Map([...status].map(([name, value]) => [name, value.state])),
    flows: new Map([...connections].map(([name, value]) => [name, value.flow])),
    overrides,
    ...(input.traffic !== undefined ? { traffic: input.traffic } : {}),
  };
  const capacity = planCapacity(planInput);
  const capacityOverTime = overTime(planInput, overrides);
  for (const [name, planned] of capacity.elements) {
    const current = status.get(name);
    if (current?.reason !== "normal" || !planned.measured) continue;
    if (planned.load > 1 + 1e-9)
      status.set(name, { state: "overloaded", motion: current.motion, reason: "load" });
  }

  // 7. Container roll-up, deepest first.
  const depth = (name: string): number => {
    let d = 0;
    let current = parentOf(name);
    const seen = new Set<string>();
    while (current !== null && !seen.has(current)) {
      seen.add(current);
      d++;
      current = parentOf(current);
    }
    return d;
  };
  const containersDeepestFirst = [...diagram.containers.values()].sort(
    (a, b) => depth(b.name) - depth(a.name),
  );
  for (const container of containersDeepestFirst) {
    const current = status.get(container.name);
    if (current === undefined || current.reason !== "normal") continue;
    const childStates = placeables
      .filter((element) => element.parent === container.name)
      .map((element) => status.get(element.name)?.state ?? "healthy");
    const rolled = rollupState(childStates, container.rollup);
    if (rolled !== "healthy")
      status.set(container.name, { state: rolled, motion: "none", reason: "rollup" });
  }

  // Down things stop moving: motion is about behaviour, and a down component has none.
  for (const [name, value] of status) {
    if (value.state === "down" && value.motion !== "none")
      status.set(name, { ...value, motion: "none" });
  }

  const nested = new Map<string, { scene: SceneEntry[]; viewer: SceneEntry[] }>();
  for (const component of diagram.components.values()) {
    if (component.opens === null) continue;
    nested.set(component.name, {
      scene: scene.nested.get(component.name) ?? [],
      viewer: viewer.nested.get(component.name) ?? [],
    });
  }

  return {
    picture: input.picture ?? null,
    elements: status,
    capacity,
    capacityOverTime,
    connections: new Map(
      [...connections].map(([name, value]) => [name, { flow: value.flow, reason: value.reason }]),
    ),
    nested,
  };
}

/** Worst state among all elements, for nested roll-up (NE-12). */
export function worstState(resolved: ResolvedState): StatePreset {
  let worst: StatePreset = "healthy";
  for (const status of resolved.elements.values()) {
    if (severityOf(status.state) > severityOf(worst)) worst = status.state;
  }
  return worst;
}

/** Scene entries of a scene by name (`null` or "normal" = no entries). */
export function sceneEntries(diagram: Diagram, scene: string | null): readonly SceneEntry[] {
  if (scene === null || scene === "normal")
    return diagram.scenes.find((s) => s.name === "normal")?.entries ?? [];
  return diagram.scenes.find((s) => s.name === scene)?.entries ?? [];
}
