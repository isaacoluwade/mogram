/**
 * Preset names. The file stores these names, never expanded styling (FI-2).
 * Arrays double as runtime validators and UI ordering.
 */

export const STATE_PRESETS = [
  "healthy",
  "active",
  "scaling",
  "degraded",
  "overloaded",
  "down",
] as const;
export type StatePreset = (typeof STATE_PRESETS)[number];

export const FLOW_PRESETS = ["traffic", "slow", "blocked", "rerouted", "idle"] as const;
export type FlowPreset = (typeof FLOW_PRESETS)[number];

export const MOTION_PRESETS = ["none", "pulse", "bounce", "rotate", "shake", "glow"] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export const CONTAINER_STYLES = [
  "region",
  "vnet",
  "subnet",
  "resource-group",
  "availability-zone",
  "cluster",
  "namespace",
  "vpc",
  "box",
] as const;
export type ContainerStyleName = (typeof CONTAINER_STYLES)[number];

export const CANVAS_THEMES = [
  "midnight",
  "graphite",
  "spotlight",
  "forest",
  "ember",
  "dusk",
  "paper",
  "snow",
  "sand",
  "mist",
] as const;
export type CanvasThemeName = (typeof CANVAS_THEMES)[number];

export function isStatePreset(value: unknown): value is StatePreset {
  return typeof value === "string" && (STATE_PRESETS as readonly string[]).includes(value);
}

export function isFlowPreset(value: unknown): value is FlowPreset {
  return typeof value === "string" && (FLOW_PRESETS as readonly string[]).includes(value);
}

export function isMotionPreset(value: unknown): value is MotionPreset {
  return typeof value === "string" && (MOTION_PRESETS as readonly string[]).includes(value);
}

export function isContainerStyle(value: unknown): value is ContainerStyleName {
  return typeof value === "string" && (CONTAINER_STYLES as readonly string[]).includes(value);
}

export function isCanvasTheme(value: unknown): value is CanvasThemeName {
  return typeof value === "string" && (CANVAS_THEMES as readonly string[]).includes(value);
}
