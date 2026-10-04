import type { Density, Direction, Speed } from "../model/types";
import { FLOW_INFO, flowTiming } from "../presets/flow";
import type { FlowPreset } from "../presets/names";
import { phase } from "./motion";

/**
 * Traffic dots are a dashed stroke (`dasharray: 0 spacing`, round caps). Moving the dash
 * offset by exactly one spacing per period makes the pattern repeat seamlessly (PR-7, D-13).
 */
export interface FlowFrame {
  readonly animated: boolean;
  readonly spacing: number;
  /** stroke-dashoffset for the forward stream. */
  readonly offset: number;
  /** stroke-dashoffset for the reverse stream (only when direction is "both"). */
  readonly reverseOffset: number | null;
}

export function flowAt(
  preset: FlowPreset,
  t: number,
  options: { readonly speed: Speed; readonly density: Density; readonly direction: Direction },
): FlowFrame {
  const { spacing, period } = flowTiming(preset, options.speed, options.density);
  if (!FLOW_INFO[preset].animated)
    return { animated: false, spacing, offset: 0, reverseOffset: null };
  const travelled = phase(t, period) * spacing;
  const forward = -travelled;
  const backward = travelled;
  switch (options.direction) {
    case "forward":
      return { animated: true, spacing, offset: forward, reverseOffset: null };
    case "reverse":
      return { animated: true, spacing, offset: backward, reverseOffset: null };
    case "both":
      return { animated: true, spacing, offset: forward, reverseOffset: backward + spacing / 2 };
  }
}
