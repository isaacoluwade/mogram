import type { Component, Connection, Diagram, SceneCapacity } from "../model/types";
import type { FlowPreset, StatePreset } from "../presets/names";
import { patternLevel } from "./patterns";

/**
 * Capacity (D-82): how much traffic each part of a diagram carries, and what the parts that
 * scale do about it. Traffic is relative (1 is normal). It enters where nothing feeds an element,
 * and every element passes it on: to all the next elements (calls), or to one of them (load
 * balancing), by share or evenly. A connection's `traffic` multiplies what it carries (a scene's
 * `users_to_lb: 5x` is five times the usual there), so a spike flows on through everything after. Elements that scale
 * out add copies to keep each copy's load at their target; elements that scale up move to a
 * bigger size. Everything here is a pure function of the diagram, its states and the scene.
 */

export interface ElementCapacity {
  /** Traffic arriving, relative to normal. */
  readonly inflow: number;
  /** Traffic passed on (before it's divided among connections). */
  readonly outflow: number;
  /** Copies running (1 unless it scales out). */
  readonly copies: number;
  /** The size in use (its index in `scale.sizes`), when it scales up. */
  readonly size: number | null;
  /** Traffic one copy (or the current size) takes at 100%. */
  readonly capacityEach: number;
  /** Load on each copy: 1 is 100%. */
  readonly load: number;
  /** It would scale further but can't (at its most copies or largest size). */
  readonly limited: boolean;
  /** Queues: traffic waiting builds up at this rate (negative: it could drain this fast). */
  readonly backlogRate: number;
  /** Shown with a load: it scales or has a capacity of its own. */
  readonly measured: boolean;
  /** A cache's hit rate in effect (the scene's, else its own). */
  readonly hit: number | null;
}

export interface CapacityPlan {
  /** Whether the diagram says anything about capacity at all (otherwise nothing is drawn). */
  readonly active: boolean;
  readonly elements: ReadonlyMap<string, ElementCapacity>;
  /** Traffic each connection carries. */
  readonly connections: ReadonlyMap<string, number>;
}

export interface CapacityInput {
  readonly diagram: Diagram;
  /** Effective states (something down passes nothing on). */
  readonly states: ReadonlyMap<string, StatePreset>;
  /** Effective flows (blocked connections carry nothing; rerouted backups take over). */
  readonly flows: ReadonlyMap<string, FlowPreset>;
  /** The scene's (and a viewer's) capacity values, by element or connection. */
  readonly overrides?: ReadonlyMap<string, SceneCapacity>;
  /** Everything entering the diagram, times this. */
  readonly traffic?: number;
  /** The moment (seconds on the clock) traffic patterns are read at (D-84); default 0. */
  readonly time?: number;
}

const EPSILON = 1e-9;

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

/** Load balancers, gateways, front doors and ingresses send each request to one of the next. */
const SPLITTERS =
  /(load-?balanc|application-gateway|front-?door|traffic-manager|\/alb$|\/elb$|\/nlb$|api-gateway|api-management|ingress|haproxy|nginx|envoy|traefik|\/svc$|\/service$|cloud-load-balancing|gateway-load-balancer)/;
/** Queues, buses and streams hold what their consumers can't take yet. */
const QUEUES =
  /(\/sqs$|queue|service-bus|pub-?sub|kafka|rabbitmq|event-hubs?$|kinesis|activemq|nats)/;

export function routingOf(component: Component): "split" | "copy" {
  return component.routing ?? (SPLITTERS.test(component.type) ? "split" : "copy");
}

export function isQueue(component: Component): boolean {
  return component.queue ?? (component.shape === "queue" || QUEUES.test(component.type));
}

/** Whether anything in the diagram models capacity (traffic levels, shares, scaling…). */
export function modelsCapacity(diagram: Diagram): boolean {
  for (const component of diagram.components.values())
    if (
      component.scale !== null ||
      component.capacity !== null ||
      component.hit !== null ||
      component.routing !== null ||
      component.queue === true
    )
      return true;
  for (const connection of diagram.connections.values())
    if (connection.traffic !== null || connection.pattern !== null || connection.share !== null)
      return true;
  for (const scene of diagram.scenes)
    if (scene.entries.some((entry) => entry.capacity !== undefined)) return true;
  return false;
}

/** Copies and size for a demand, and the load they'd carry. */
export function sizeFor(
  component: Component,
  inflow: number,
  override?: SceneCapacity,
): Pick<ElementCapacity, "copies" | "size" | "capacityEach" | "load" | "limited"> {
  const each = component.capacity ?? 1;
  const scale = component.scale;
  if (scale?.kind === "out") {
    const wanted = Math.max(1, Math.ceil(inflow / (each * scale.target) - EPSILON));
    const copies = override?.copies ?? Math.min(scale.max, Math.max(scale.min, wanted));
    return {
      copies,
      size: null,
      capacityEach: each,
      load: inflow / (copies * each),
      limited: override?.copies === undefined && wanted > scale.max,
    };
  }
  if (scale?.kind === "up") {
    const named =
      override?.size === undefined
        ? -1
        : scale.sizes.findIndex((size) => size.name === override.size);
    const fits = scale.sizes.findIndex(
      (size) => each * size.capacity * scale.target >= inflow - EPSILON,
    );
    const last = scale.sizes.length - 1;
    const size = named >= 0 ? named : fits >= 0 ? fits : last;
    const capacity = each * (scale.sizes[size]?.capacity ?? 1);
    return {
      copies: 1,
      size,
      capacityEach: capacity,
      load: inflow / capacity,
      limited: named < 0 && fits < 0,
    };
  }
  return { copies: 1, size: null, capacityEach: each, load: inflow / each, limited: false };
}

/** What every element and connection carries, for one moment. */
export function planCapacity(input: CapacityInput): CapacityPlan {
  const { diagram } = input;
  const multiplier = Math.max(0, input.traffic ?? 1);
  const override = (name: string): SceneCapacity | undefined => input.overrides?.get(name);
  const nodes = new Set<string>([...diagram.containers.keys(), ...diagram.components.keys()]);
  const parentOf = (name: string): string | null =>
    diagram.components.get(name)?.parent ?? diagram.containers.get(name)?.parent ?? null;

  const incoming = new Map<string, Connection[]>();
  const outgoing = new Map<string, Connection[]>();
  for (const connection of diagram.connections.values()) {
    if (!nodes.has(connection.from.element) || !nodes.has(connection.to.element)) continue;
    push(outgoing, connection.from.element, connection);
    push(incoming, connection.to.element, connection);
  }

  // Traffic sent to a container goes, evenly, to what's inside that nothing else feeds (a scale
  // set's machines, a cluster's services).
  const entries = new Map<string, string[]>();
  for (const container of diagram.containers.keys()) {
    if ((incoming.get(container) ?? []).length === 0) continue;
    entries.set(
      container,
      [...nodes].filter(
        (name) => parentOf(name) === container && (incoming.get(name) ?? []).length === 0,
      ),
    );
  }

  const carried = new Map<string, number>();
  const fromContainer = new Map<string, number>();
  const plan = new Map<string, ElementCapacity>();

  // Ordering: along connections, and from a container to what's inside it.
  const after = new Map<string, string[]>();
  const waiting = new Map<string, number>([...nodes].map((n) => [n, 0]));
  const link = (from: string, to: string) => {
    push(after, from, to);
    waiting.set(to, (waiting.get(to) ?? 0) + 1);
  };
  for (const list of outgoing.values()) for (const c of list) link(c.from.element, c.to.element);
  for (const [container, kids] of entries) for (const kid of kids) link(container, kid);

  const visit = (name: string): void => {
    const fed = (incoming.get(name) ?? []).length > 0;
    const viaContainer = fromContainer.get(name);
    // Traffic starts at components nothing feeds (people, clients, schedulers).
    const sourced =
      diagram.components.has(name) &&
      !fed &&
      viaContainer === undefined &&
      !insideFedContainer(name);
    const inflow =
      (incoming.get(name) ?? []).reduce((sum, c) => sum + (carried.get(c.name) ?? 0), 0) +
      (viaContainer ?? 0) +
      (sourced ? multiplier : 0);

    const component = diagram.components.get(name);
    const down = input.states.get(name) === "down";
    const sized = component === undefined ? null : sizeFor(component, inflow, override(name));
    let outflow = down ? 0 : inflow;
    let backlogRate = 0;
    const hit = component === undefined ? null : (override(name)?.hit ?? component.hit);
    if (component !== undefined && !down) {
      if (hit !== null) outflow = inflow * (1 - hit);
      if (isQueue(component)) {
        const take = consumerCapacity(name, outflow);
        backlogRate = outflow - take;
        outflow = Math.min(outflow, take);
      }
    }
    if (component !== undefined && sized !== null)
      plan.set(name, {
        inflow,
        outflow,
        ...sized,
        backlogRate,
        measured: component.scale !== null || component.capacity !== null,
        hit,
      });
    else
      plan.set(name, {
        inflow,
        outflow,
        copies: 1,
        size: null,
        capacityEach: 1,
        load: 0,
        limited: false,
        backlogRate: 0,
        measured: false,
        hit: null,
      });

    // On along the connections.
    const out = outgoing.get(name) ?? [];
    const flowOf = (c: Connection) => input.flows.get(c.name) ?? c.flow;
    // A backup carries nothing until the connection it backs up is blocked; then it takes over.
    const active = out.filter((c) => c.backupFor === null || flowOf(c) === "rerouted");
    // `traffic` on a connection scales what it carries: 5x is five times what it otherwise would.
    const factor = (c: Connection): number =>
      Math.max(
        0,
        override(c.name)?.traffic ??
          (c.pattern === null ? (c.traffic ?? 1) : patternLevel(c.pattern, input.time ?? 0)),
      );
    const routing = component === undefined ? "copy" : routingOf(component);
    if (routing === "split") {
      const open = active.filter((c) => flowOf(c) !== "blocked");
      const shareOf = (c: Connection): number | null => {
        const own = override(c.name)?.share ?? c.share;
        if (own !== null) return own;
        // A backup that took over carries the share of the one it backs up.
        const primary = c.backupFor === null ? undefined : diagram.connections.get(c.backupFor);
        return primary === undefined ? null : (override(primary.name)?.share ?? primary.share);
      };
      const given = open.reduce((sum, c) => sum + (shareOf(c) ?? 0), 0);
      const even = open.filter((c) => shareOf(c) === null);
      const rest = Math.max(0, 1 - given);
      const weights = open.map((c) => shareOf(c) ?? (even.length === 0 ? 0 : rest / even.length));
      const total = weights.reduce((a, b) => a + b, 0);
      for (const c of active) carried.set(c.name, 0);
      open.forEach((c, i) =>
        carried.set(
          c.name,
          total <= EPSILON ? 0 : ((outflow * (weights[i] ?? 0)) / total) * factor(c),
        ),
      );
    } else {
      for (const c of active)
        carried.set(c.name, flowOf(c) === "blocked" ? 0 : outflow * factor(c));
    }
    for (const c of out) if (!carried.has(c.name)) carried.set(c.name, 0);

    // Into a container's front door.
    const kids = entries.get(name) ?? [];
    if (diagram.containers.has(name) && kids.length > 0 && !down) {
      for (const kid of kids)
        fromContainer.set(kid, (fromContainer.get(kid) ?? 0) + inflow / kids.length);
    }
  };

  /** Inside a container that receives traffic, an element is fed through the container. */
  function insideFedContainer(name: string): boolean {
    for (let at = parentOf(name); at !== null; at = parentOf(at)) {
      if ((incoming.get(at) ?? []).length > 0) return true;
      if (at === parentOf(at)) break;
    }
    return false;
  }

  /** What the consumers of a queue can take, when they scale for what's waiting. */
  function consumerCapacity(queue: string, demand: number): number {
    const consumers = (outgoing.get(queue) ?? [])
      .filter((c) => (input.flows.get(c.name) ?? c.flow) !== "blocked")
      .map((c) => diagram.components.get(c.to.element))
      .filter((c): c is Component => c !== undefined);
    if (consumers.length === 0) return demand;
    let total = 0;
    for (const consumer of consumers) {
      if (consumer.scale === null && consumer.capacity === null) return demand;
      if (input.states.get(consumer.name) === "down") continue;
      const sized = sizeFor(consumer, demand / consumers.length, override(consumer.name));
      total += sized.copies * sized.capacityEach;
    }
    return total;
  }

  // Kahn's order; anything left in a loop is visited in document order with what it has.
  const ready = [...nodes].filter((n) => (waiting.get(n) ?? 0) === 0);
  const done = new Set<string>();
  while (ready.length > 0 || done.size < nodes.size) {
    const next = ready.shift() ?? [...nodes].find((n) => !done.has(n));
    if (next === undefined) break;
    if (done.has(next)) continue;
    done.add(next);
    visit(next);
    for (const to of after.get(next) ?? []) {
      const left = (waiting.get(to) ?? 1) - 1;
      waiting.set(to, left);
      if (left === 0 && !done.has(to)) ready.push(to);
    }
  }
  for (const connection of diagram.connections.values())
    if (!carried.has(connection.name)) carried.set(connection.name, 0);

  return { active: modelsCapacity(diagram), elements: plan, connections: carried };
}
