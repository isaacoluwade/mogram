import type { Diagram } from "../model/types";
import type { CapacityOverTime } from "./patterns";
import type { CapacityPlan } from "./plan";

/**
 * Capacity over time (D-82): what's drawn between one plan and the next. Scaling isn't instant,
 * and showing that is the point: when traffic rises, the copies already running take it (and may
 * be overloaded) until new ones have started; when it falls, copies stop taking traffic, then
 * leave, after a cool-down; a machine grows or shrinks smoothly into its new size. A queue fills
 * while more arrives than its consumers take, and drains after.
 *
 * Deterministic: the same plans at the same times always give the same picture, so the editor,
 * the viewer and exports agree. Times are in seconds.
 */
export const CAPACITY_TIMING = {
  /** Traffic eases to its new level. */
  traffic: 0.6,
  /** Load has to stay up this long before copies are added. */
  react: 0.5,
  /** A copy starts this long before it takes traffic. */
  boot: 1,
  /** Between copies starting. */
  stagger: 0.32,
  /** Load has to stay down this long before copies are removed. */
  cooldown: 1.2,
  /** A leaving copy stops taking traffic, then fades out over this long. */
  drain: 0.7,
  /** Between copies leaving. */
  drainStagger: 0.28,
  /** Load has to stay up (or down) this long before a resize. */
  resizeReact: 0.6,
  /** A machine grows (or shrinks) into its new size over this long, taking traffic throughout. */
  grow: 1,
  /** How fast a queue fills (of its height per second) for each 1x more than is taken. */
  backlogFill: 0.18,
} as const;

/** How far a copy appears in, of its boot time. */
const APPEAR = 0.3;

export interface CopyView {
  readonly id: number;
  /** Its place in the grid: slides left as copies before it leave. */
  readonly slot: number;
  /** 0–1: scales and fades in as it starts. */
  readonly appear: number;
  /** 0–1 start-up progress; 1 once it takes traffic. */
  readonly boot: number;
  /** Seconds since it started taking traffic, or null before. */
  readonly readyFor: number | null;
  /** 0–1: how far it has left (0 while serving). */
  readonly leave: number;
  /** Taking traffic now. */
  readonly serving: boolean;
  /** Its load (1 = 100%); 0 unless serving. */
  readonly load: number;
}

export interface FleetView {
  readonly copies: readonly CopyView[];
  readonly serving: number;
  readonly inflow: number;
  /** Load on each serving copy. */
  readonly load: number;
  /** Copies planned (what it's heading for). */
  readonly target: number;
}

export interface MachineView {
  /** The size shown, and the one it's growing into (indexes into `scale.sizes`). */
  readonly from: number;
  readonly to: number;
  /** 0–1 from `from` to `to`. */
  readonly grow: number;
  readonly inflow: number;
  /** Load at the size it runs at now (in between while it grows). */
  readonly load: number;
}

interface Copy {
  readonly id: number;
  readonly bootAt: number;
  readonly readyAt: number;
  drainAt: number | null;
  goneAt: number | null;
}

interface Resize {
  readonly from: number;
  to: number;
  /** When it starts growing (or shrinking) into `to`. */
  readonly startAt: number;
}

interface Track {
  kind: "out" | "up" | "plain";
  capacityEach: number;
  /** Capacity of each size (scale up). */
  sizes: readonly number[];
  copies: Copy[];
  nextId: number;
  targetCopies: number;
  baseSize: number;
  resizes: Resize[];
  inflow: Ease;
  backlog: { level: number; at: number; speed: number };
}

interface Ease {
  readonly from: number;
  readonly to: number;
  readonly at: number;
}

const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const easeInOut = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c ** 3 : 1 - (-2 * c + 2) ** 3 / 2;
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeAt = (e: Ease, t: number) =>
  e.from + (e.to - e.from) * easeOut((t - e.at) / CAPACITY_TIMING.traffic);

export class CapacityTimeline {
  private readonly tracks = new Map<string, Track>();
  private readonly traffic = new Map<string, Ease>();
  private settles = -Infinity;
  private active = false;
  /** Patterns (D-84): the plan over time, and how far it has been followed. */
  private over: CapacityOverTime | null = null;
  private diagram: Diagram | null = null;
  private cursor = -Infinity;

  constructor(plan: CapacityPlan, diagram: Diagram, at = 0, over: CapacityOverTime | null = null) {
    this.update(plan, diagram, at, true, over);
  }

  /** Whether the diagram models capacity at all. */
  get isActive(): boolean {
    return this.active;
  }

  /** Traffic follows a pattern, so things keep scaling: it never settles. */
  get isPatterned(): boolean {
    return this.over !== null;
  }

  /** When everything has settled (nothing moves after this but traffic); never, with patterns. */
  get settledAt(): number {
    return this.over === null ? this.settles : Infinity;
  }

  /** How long until a pattern repeats (seconds), or null when traffic is steady. */
  get cycle(): number | null {
    return this.over?.cycle ?? null;
  }

  /**
   * Heads for a new plan from time `at`. `instant` jumps straight there (the first plan, or
   * reduced motion). With patterns (`over`), the plan is the pattern's at each moment, followed
   * as time is asked about.
   */
  update(
    plan: CapacityPlan,
    diagram: Diagram,
    at: number,
    instant = false,
    over: CapacityOverTime | null = null,
  ): void {
    this.advance(at);
    this.over = over;
    this.diagram = diagram;
    this.cursor = at;
    this.apply(over === null ? plan : over.planAt(at), diagram, at, instant);
  }

  /**
   * Follows the patterns up to time `t`, heading for each new plan exactly when it changes, so
   * the picture depends only on the time asked about. Far behind (a tab in the background), it
   * starts again a cycle back instead of replaying every change.
   */
  private advance(t: number): void {
    const over = this.over;
    const diagram = this.diagram;
    if (over === null || diagram === null || t <= this.cursor) return;
    if (t - this.cursor > 3 * over.cycle) {
      const from = t - over.cycle;
      this.apply(over.planAt(from), diagram, from, true);
      this.cursor = from;
    }
    for (let next = over.nextChange(this.cursor), n = 0; next <= t && n < 1000; n++) {
      this.apply(over.planAt(next), diagram, next, false);
      this.cursor = next;
      next = over.nextChange(next);
    }
    this.cursor = Math.max(this.cursor, t);
  }

  private apply(plan: CapacityPlan, diagram: Diagram, at: number, instant: boolean): void {
    const T = CAPACITY_TIMING;
    this.active = plan.active;
    const seen = new Set<string>();
    for (const [name, planned] of plan.elements) {
      seen.add(name);
      const component = diagram.components.get(name);
      const scale = component?.scale ?? null;
      const kind = scale === null ? "plain" : scale.kind;
      const each = component?.capacity ?? 1;
      const sizes = scale?.kind === "up" ? scale.sizes.map((s) => s.capacity * each) : [];
      let track = this.tracks.get(name);
      const reset =
        track === undefined ||
        instant ||
        track.kind !== kind ||
        track.sizes.length !== sizes.length;
      if (reset || track === undefined) {
        track = {
          kind,
          capacityEach: each,
          sizes,
          copies: Array.from({ length: kind === "out" ? planned.copies : 1 }, (_, i) => ({
            id: i,
            bootAt: -Infinity,
            readyAt: -Infinity,
            drainAt: null,
            goneAt: null,
          })),
          nextId: kind === "out" ? planned.copies : 1,
          targetCopies: planned.copies,
          baseSize: planned.size ?? 0,
          resizes: [],
          inflow: { from: planned.inflow, to: planned.inflow, at },
          backlog: { level: planned.backlogRate > 0 ? 0.5 : 0, at, speed: 0 },
        };
        this.tracks.set(name, track);
      } else {
        track.capacityEach = each;
        track.sizes = sizes;
        const now = easeAt(track.inflow, at);
        if (Math.abs(track.inflow.to - planned.inflow) > 1e-9)
          track.inflow = { from: now, to: planned.inflow, at };
      }
      // Queues fill while more arrives than is taken, and drain after.
      const level = this.backlogAt(track, at);
      track.backlog = { level, at, speed: planned.backlogRate * T.backlogFill };
      if (planned.backlogRate > 0)
        this.settles = Math.max(
          this.settles,
          at + (1 - level) / (planned.backlogRate * T.backlogFill),
        );
      else if (planned.backlogRate < 0 && level > 0)
        this.settles = Math.max(this.settles, at + level / (-planned.backlogRate * T.backlogFill));
      if (reset) continue;

      if (kind === "out" && planned.copies !== track.targetCopies) {
        this.retargetCopies(track, planned.copies, at);
      }
      if (kind === "up") {
        const current = this.targetSize(track);
        const size = planned.size ?? 0;
        if (size !== current) this.resize(track, current, size, at);
      }
      this.settles = Math.max(this.settles, at + T.traffic);
    }
    for (const name of [...this.tracks.keys()]) if (!seen.has(name)) this.tracks.delete(name);

    for (const [name, value] of plan.connections) {
      const previous = this.traffic.get(name);
      if (previous === undefined || instant) {
        this.traffic.set(name, { from: value, to: value, at });
      } else if (Math.abs(previous.to - value) > 1e-9) {
        this.traffic.set(name, { from: easeAt(previous, at), to: value, at });
        this.settles = Math.max(this.settles, at + T.traffic);
      }
    }
    for (const name of [...this.traffic.keys()])
      if (!plan.connections.has(name)) this.traffic.delete(name);
  }

  private retargetCopies(track: Track, target: number, at: number): void {
    const T = CAPACITY_TIMING;
    track.targetCopies = target;
    track.copies = track.copies.filter((c) => c.goneAt === null || c.goneAt > at);
    // Copies not on their way out (a scheduled exit that hasn't started can still be called off).
    const staying = () => track.copies.filter((c) => c.drainAt === null || c.drainAt > at);
    let alive = staying();
    if (target > alive.length) {
      for (const copy of track.copies)
        if (copy.drainAt !== null && copy.drainAt > at && alive.length < target) {
          copy.drainAt = null;
          copy.goneAt = null;
        }
      alive = track.copies.filter((c) => c.drainAt === null);
      const add = target - alive.length;
      const start = at + T.react;
      for (let k = 0; k < add; k++) {
        const bootAt = start + k * T.stagger;
        track.copies.push({
          id: track.nextId++,
          bootAt,
          readyAt: bootAt + T.boot,
          drainAt: null,
          goneAt: null,
        });
        this.settles = Math.max(this.settles, bootAt + T.boot + 0.8);
      }
    } else if (target < alive.length) {
      // The newest go first; one that hasn't started yet simply doesn't.
      const leaving = [...alive].sort((a, b) => b.id - a.id).slice(0, alive.length - target);
      let k = 0;
      for (const copy of leaving) {
        if (copy.bootAt > at) {
          track.copies = track.copies.filter((c) => c !== copy);
          continue;
        }
        copy.drainAt = at + T.cooldown + k * T.drainStagger;
        copy.goneAt = copy.drainAt + T.drain;
        this.settles = Math.max(this.settles, copy.goneAt);
        k++;
      }
    }
  }

  private targetSize(track: Track): number {
    return track.resizes.at(-1)?.to ?? track.baseSize;
  }

  private resize(track: Track, from: number, to: number, at: number): void {
    const T = CAPACITY_TIMING;
    // Only the latest resize that has begun matters from here on.
    while (track.resizes.length > 1 && (track.resizes[1]?.startAt ?? Infinity) <= at)
      track.resizes.shift();
    const last = track.resizes.at(-1);
    // A resize that hasn't started yet just changes where it's going.
    if (last !== undefined && last.startAt > at) {
      last.to = to;
      if (last.to === last.from) track.resizes.pop();
      return;
    }
    // After the one under way has finished growing.
    const startAt = Math.max(
      at + T.resizeReact,
      last === undefined ? -Infinity : last.startAt + T.grow,
    );
    track.resizes.push({ from, to, startAt });
    this.settles = Math.max(this.settles, startAt + T.grow);
  }

  private backlogAt(track: Track, t: number): number {
    const b = track.backlog;
    return clamp01(b.level + b.speed * (t - b.at));
  }

  /** Traffic arriving at an element. */
  inflow(name: string, t: number): number {
    this.advance(t);
    const track = this.tracks.get(name);
    return track === undefined ? 0 : easeAt(track.inflow, t);
  }

  /** Traffic a connection carries. */
  carried(name: string, t: number): number {
    this.advance(t);
    const ease = this.traffic.get(name);
    return ease === undefined ? 0 : easeAt(ease, t);
  }

  /** A scaled-out element's copies at time `t`, or null if it doesn't scale out. */
  fleet(name: string, t: number): FleetView | null {
    this.advance(t);
    const track = this.tracks.get(name);
    if (track?.kind !== "out") return null;
    const T = CAPACITY_TIMING;
    const visible = track.copies
      .filter((c) => c.bootAt <= t && (c.goneAt === null || c.goneAt > t))
      .sort((a, b) => a.id - b.id);
    const servingNow = (c: Copy) => c.readyAt <= t && (c.drainAt === null || c.drainAt > t);
    const serving = visible.filter(servingNow).length;
    const inflow = easeAt(track.inflow, t);
    const load =
      serving === 0 ? inflow / track.capacityEach : inflow / (serving * track.capacityEach);
    let slot = 0;
    const copies: CopyView[] = visible.map((c) => {
      const boot = c.readyAt === -Infinity ? 1 : clamp01((t - c.bootAt) / T.boot);
      const leave = c.drainAt === null || c.drainAt > t ? 0 : clamp01((t - c.drainAt) / T.drain);
      const view: CopyView = {
        id: c.id,
        slot,
        appear: c.bootAt === -Infinity ? 1 : easeOut((t - c.bootAt) / (T.boot * APPEAR)),
        boot,
        readyFor: c.readyAt <= t ? t - c.readyAt : null,
        leave,
        serving: servingNow(c),
        load: servingNow(c) ? load : 0,
      };
      // Copies after this one slide over as it leaves.
      slot += 1 - easeOut((leave - 0.4) / 0.6);
      return view;
    });
    return { copies, serving, inflow, load, target: track.targetCopies };
  }

  /** A scaled-up element's size at time `t`, or null if it doesn't scale up. */
  machine(name: string, t: number): MachineView | null {
    this.advance(t);
    const track = this.tracks.get(name);
    if (track?.kind !== "up") return null;
    const T = CAPACITY_TIMING;
    const inflow = easeAt(track.inflow, t);
    const current = [...track.resizes].reverse().find((r) => r.startAt <= t);
    const capacity = (size: number) => track.sizes[size] ?? track.capacityEach;
    if (current === undefined) {
      const size = track.resizes[0]?.from ?? track.baseSize;
      return { from: size, to: size, grow: 1, inflow, load: inflow / capacity(size) };
    }
    // It keeps taking traffic as it grows: what it can take moves from one size to the next.
    const grow = easeInOut((t - current.startAt) / T.grow);
    const from = capacity(current.from);
    const can = from + (capacity(current.to) - from) * grow;
    return { from: current.from, to: current.to, grow, inflow, load: inflow / can };
  }

  /** Load on one copy (or the machine) of an element at time `t`; 0 for unmeasured ones. */
  load(name: string, t: number): number {
    this.advance(t);
    const fleet = this.fleet(name, t);
    if (fleet !== null) return fleet.load;
    const machine = this.machine(name, t);
    if (machine !== null) return machine.load;
    const track = this.tracks.get(name);
    return track === undefined ? 0 : easeAt(track.inflow, t) / track.capacityEach;
  }

  /** How full a queue is (0–1). */
  backlog(name: string, t: number): number {
    this.advance(t);
    const track = this.tracks.get(name);
    return track === undefined ? 0 : this.backlogAt(track, t);
  }
}
