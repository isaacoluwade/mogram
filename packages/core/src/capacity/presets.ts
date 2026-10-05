import type { Component, Scale, ScaleOut, ScaleSize, ScaleUp } from "../model/types";

/**
 * Starting points for scaling (D-82), so making something scale is one choice rather than a form:
 * copies for scaling out, and lists of sizes for scaling up. Each size takes twice the traffic
 * of the one before, as the format assumes when a size doesn't say.
 */

export interface SizePreset {
  readonly id: "vm" | "database" | "tiers";
  readonly label: string;
  readonly description: string;
  readonly sizes: readonly ScaleSize[];
}

const size = (
  name: string,
  index: number,
  cpu: number | null = null,
  memory: number | null = null,
  disks: number | null = null,
): ScaleSize => ({ name, cpu, memory, disks, capacity: 2 ** index });

export const SIZE_PRESETS: readonly SizePreset[] = [
  {
    id: "vm",
    label: "Virtual machine",
    description: "2 to 16 vCPU, with memory and disks",
    sizes: [
      size("2 vCPU", 0, 2, 8, 1),
      size("4 vCPU", 1, 4, 16, 2),
      size("8 vCPU", 2, 8, 32, 4),
      size("16 vCPU", 3, 16, 64, 8),
    ],
  },
  {
    id: "database",
    label: "Database",
    description: "Basic, Standard and Premium tiers",
    sizes: [size("Basic", 0, 2, 8, 1), size("Standard", 1, 4, 16, 2), size("Premium", 2, 8, 32, 4)],
  },
  {
    id: "tiers",
    label: "Tiers",
    description: "Small, Medium and Large, by name only",
    sizes: [size("Small", 0), size("Medium", 1), size("Large", 2)],
  },
];

const DATABASE =
  /(sql|database|\/db|postgres|mysql|maria|cosmos|dynamo|mongo|redis|cache|spanner|bigtable|aurora|rds)/;
const MACHINE = /(virtual-machine|\/vm|ec2|compute-engine|instance|server|droplet)/;

/** The sizes that fit an element best: database tiers, machine sizes, or plain tiers. */
export function suggestedSizes(component: Pick<Component, "type">): SizePreset {
  const [vm, database, tiers] = SIZE_PRESETS as readonly [SizePreset, SizePreset, SizePreset];
  return DATABASE.test(component.type) ? database : MACHINE.test(component.type) ? vm : tiers;
}

export const DEFAULT_SCALE_OUT: ScaleOut = { kind: "out", min: 2, max: 8, target: 0.7 };

/** A sensible scale for an element that starts scaling out or up (keeping its target). */
export function defaultScale(
  component: Pick<Component, "type" | "scale">,
  kind: "out" | "up",
): Scale {
  const target = component.scale?.target ?? DEFAULT_SCALE_OUT.target;
  if (kind === "out") return { ...DEFAULT_SCALE_OUT, target };
  const up: ScaleUp = { kind: "up", sizes: suggestedSizes(component).sizes, target };
  return up;
}

/**
 * The next size after the last: twice its cores, memory and disks, named like the others when
 * they're named by cores ("8 vCPU" → "16 vCPU").
 */
export function nextSize(sizes: readonly ScaleSize[]): ScaleSize {
  const last = sizes.at(-1);
  const index = sizes.length;
  if (last === undefined) return size("Small", 0);
  const twice = (n: number | null) => (n === null ? null : n * 2);
  const cpu = twice(last.cpu);
  const byCores = /^\d+(\.\d+)? vCPU$/.test(last.name) && cpu !== null;
  let name = byCores ? `${cpu} vCPU` : `Size ${index + 1}`;
  for (let n = index + 2; sizes.some((s) => s.name === name); n++) name = `Size ${n}`;
  return {
    name,
    cpu,
    memory: twice(last.memory),
    disks: twice(last.disks),
    capacity: last.capacity * 2,
  };
}

/**
 * Sizes after one is added, removed or changed: each keeps what it was given, and a capacity left
 * at the default (doubling) follows its new place in the list.
 */
export function reindexSizes(
  sizes: readonly { readonly size: ScaleSize; readonly was: number | null }[],
): ScaleSize[] {
  return sizes.map(({ size: s, was }, index) => ({
    ...s,
    capacity: was === null || Math.abs(s.capacity - 2 ** was) < 1e-9 ? 2 ** index : s.capacity,
  }));
}
