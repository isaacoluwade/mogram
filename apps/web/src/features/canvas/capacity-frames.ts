import type { CapacityTimeline } from "@mogram/core/capacity";
import { FLEET, fleetColumns, fleetSlot, machinePanel, type Box } from "@mogram/core/layout";
import type { ScaleSize } from "@mogram/core/model";
import type { SceneComponent } from "./scene";
import { tone, type CanvasTheme } from "./theme";

/**
 * What a scale set or a growing machine looks like at time `t` (D-82): pure, so the live canvas
 * (every frame) and still pictures (thumbnails, exports) draw the same thing.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

/** Green while there's headroom, amber near the top, red past it. */
export function loadColor(load: number, theme: CanvasTheme): string {
  return tone(load >= 1 ? "rose" : load >= 0.8 ? "amber" : "green", theme.mode).solid;
}

export function percent(load: number): string {
  return `${Math.round(load * 100)}%`;
}

export interface CopyFrame {
  /** The tile's top-left. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly opacity: number;
  readonly serving: boolean;
  /** 0–1 around the start-up ring; hidden once it's running. */
  readonly boot: number;
  readonly ringOpacity: number;
  /** The green tick, just after it starts taking traffic. */
  readonly tickOpacity: number;
  readonly leaving: boolean;
  readonly load: number;
}

export interface FleetFrame {
  /** The scale set's frame, growing and shrinking inside its room. */
  readonly frame: Box;
  /** One per slot of the pool (up to the most copies); null where there's none. */
  readonly copies: readonly (CopyFrame | null)[];
  readonly serving: number;
  readonly starting: number;
  readonly stopping: number;
  readonly load: number;
  readonly limited: boolean;
}

/**
 * The frame around the copies there are, growing smoothly as one appears or leaves: a new row
 * opens as its first copy appears, so the name under the copies never sits on top of one.
 */
function frameAround(
  present: readonly { slot: number; presence: number }[],
  max: number,
): { w: number; h: number } {
  const columns = fleetColumns(max);
  let cols = 1;
  let rows = 1;
  for (const { slot, presence } of present) {
    const at = Math.round(slot);
    const row = Math.floor(at / columns);
    cols = Math.max(cols, row > 0 ? columns : (at % columns) + presence);
    rows = Math.max(rows, row + presence);
  }
  return {
    w: FLEET.padX * 2 + cols * FLEET.tile + (cols - 1) * FLEET.gapX,
    h: FLEET.padTop + rows * FLEET.tile + (rows - 1) * FLEET.gapY + FLEET.padBottom,
  };
}

/** A fractional slot, between two places in the grid. */
function slotAt(slot: number, max: number): { x: number; y: number } {
  const low = Math.floor(slot);
  const a = fleetSlot(low, max);
  const b = fleetSlot(low + 1, max);
  const f = slot - low;
  // Moving back along a row slides; wrapping to the row above fades through instead.
  if (b.y !== a.y) return f < 0.5 ? a : b;
  return { x: a.x + (b.x - a.x) * f, y: a.y };
}

export function fleetFrame(
  timeline: CapacityTimeline,
  name: string,
  room: Box,
  max: number,
  t: number,
): FleetFrame {
  const fleet = timeline.fleet(name, t);
  const copies: (CopyFrame | null)[] = Array.from({ length: max }, () => null);
  if (fleet === null)
    return {
      frame: { ...room },
      copies,
      serving: 0,
      starting: 0,
      stopping: 0,
      load: 0,
      limited: false,
    };
  const present: { slot: number; presence: number }[] = [];
  let starting = 0;
  let stopping = 0;
  fleet.copies.forEach((copy, index) => {
    if (index >= max) return;
    const fade = easeOut((copy.leave - 0.4) / 0.6);
    present.push({ slot: copy.slot, presence: copy.appear * (1 - fade) });
    if (!copy.serving && copy.leave === 0) starting++;
    if (copy.leave > 0) stopping++;
    const at = slotAt(copy.slot, max);
    copies[index] = {
      x: room.x + at.x,
      y: room.y + at.y,
      scale: (0.55 + 0.45 * copy.appear) * (1 - 0.25 * fade),
      opacity: copy.appear * (1 - fade),
      serving: copy.serving,
      boot: copy.boot,
      ringOpacity: copy.boot < 1 ? 1 : 0,
      tickOpacity:
        copy.readyFor === null || copy.boot < 1 || copy.appear < 1
          ? 0
          : copy.readyFor < 0.9
            ? 1 - easeOut((copy.readyFor - 0.5) / 0.4)
            : 0,
      leaving: copy.leave > 0,
      load: copy.load,
    };
  });
  const size = frameAround(present, max);
  return {
    frame: { x: room.x, y: room.y, w: size.w, h: size.h },
    copies,
    serving: fleet.serving,
    starting,
    stopping,
    load: fleet.load,
    limited: fleet.target >= max && fleet.load > 1,
  };
}

export interface MachineFrame {
  /** The machine as it is now, growing (or shrinking) smoothly into its new size. */
  readonly panel: Box;
  readonly size: ScaleSize | null;
  /** CPU cores lit, of the most any size has. */
  readonly cores: number;
  readonly memory: number | null;
  /** 0–1 of the most memory any size has. */
  readonly memoryShare: number;
  readonly disks: number;
  /** 0–1 of the largest size's capacity (for sizes without cores or memory). */
  readonly capacityShare: number;
  readonly load: number;
  /** At its largest size and still busy: it can't grow further. */
  readonly ceiling: boolean;
}

export function machineFrame(
  timeline: CapacityTimeline,
  name: string,
  room: Box,
  sizes: readonly ScaleSize[],
  t: number,
): MachineFrame {
  const machine = timeline.machine(name, t);
  const from = machine?.from ?? 0;
  const to = machine?.to ?? 0;
  const grow = machine?.grow ?? 1;
  const a = machinePanel(from, sizes.length);
  const b = machinePanel(to, sizes.length);
  const w = a.w + (b.w - a.w) * grow;
  const h = a.h + (b.h - a.h) * grow;
  const lerp = (x: number | null, y: number | null) =>
    x === null && y === null ? null : (x ?? 0) + ((y ?? 0) - (x ?? 0)) * grow;
  const sizeFrom = sizes[from] ?? null;
  const sizeTo = sizes[to] ?? null;
  const shown = grow < 0.5 ? sizeFrom : sizeTo;
  const maxMemory = Math.max(0, ...sizes.map((s) => s.memory ?? 0));
  const maxCapacity = Math.max(1, ...sizes.map((s) => s.capacity));
  const memory = lerp(sizeFrom?.memory ?? null, sizeTo?.memory ?? null);
  return {
    panel: { x: room.x + (room.w - w) / 2, y: room.y, w, h },
    size: shown,
    cores: Math.round(lerp(sizeFrom?.cpu ?? null, sizeTo?.cpu ?? null) ?? 0),
    memory: shown?.memory ?? null,
    memoryShare: memory === null || maxMemory === 0 ? 0 : memory / maxMemory,
    disks: lerp(sizeFrom?.disks ?? null, sizeTo?.disks ?? null) ?? 0,
    capacityShare: (lerp(sizeFrom?.capacity ?? 1, sizeTo?.capacity ?? 1) ?? 1) / maxCapacity,
    load: machine?.load ?? 0,
    ceiling: to === sizes.length - 1 && (machine?.load ?? 0) >= 0.9,
  };
}

/**
 * Where a scaled component's name sits once its capacity settles (the baseline): under its scale
 * set's frame, or centred under its machine. For the label editor, which goes over it.
 */
export function capacityLabelAt(
  component: SceneComponent,
  timeline: CapacityTimeline | null,
): { x: number; y: number; align: "start" | "middle" } | null {
  const scaling = component.scaling;
  if (scaling === null) return null;
  // Settled (or, with a traffic pattern that never settles, at the start of its cycle).
  const settled = timeline?.settledAt ?? 0;
  const t = Number.isFinite(settled) ? Math.max(0, settled) : 0;
  if (scaling.kind === "out") {
    const h =
      timeline === null
        ? scaling.room.h
        : fleetFrame(timeline, component.name, scaling.room, scaling.max, t).frame.h;
    return { x: scaling.room.x + 4, y: scaling.room.y + h + 18, align: "start" };
  }
  const panel =
    timeline === null
      ? scaling.room
      : machineFrame(timeline, component.name, scaling.room, scaling.sizes, t).panel;
  return { x: panel.x + panel.w / 2, y: panel.y + panel.h + 18, align: "middle" };
}
