import { FLOW_INFO, STATE_INFO, type StateBadge, type ThemeMode } from "@mogram/core/presets";
import {
  flowAt,
  mixColor,
  mixLook,
  motionAt,
  overloadGlow,
  transitionProgress,
  withAlpha,
  type MotionFrame,
} from "@mogram/core/timeline";
import type { SceneComponent, SceneConnection, SceneContainer } from "./scene";
import { tone, type CanvasTheme } from "./theme";

/**
 * Visual attributes of each element at time `t` — pure functions shared by the live canvas
 * (called every frame) and static rendering (thumbnails, export), so both always match.
 */

export function progressAt(t: number, transitionStart: number | null, seconds?: number): number {
  return transitionStart === null ? 1 : transitionProgress(t, transitionStart, seconds);
}

export interface ComponentFrame {
  readonly motion: MotionFrame;
  readonly ringColor: string;
  readonly ringOpacity: number;
  readonly glowColor: string;
  readonly glowOpacity: number;
  readonly colorOpacity: number;
  readonly greyOpacity: number;
  readonly contentOpacity: number;
  readonly ghostOpacity: number;
  readonly ghostColor: string;
  readonly badgeFrom: {
    readonly badge: StateBadge;
    readonly color: string;
    readonly opacity: number;
  };
  readonly badgeTo: {
    readonly badge: StateBadge;
    readonly color: string;
    readonly opacity: number;
  };
}

export function componentFrame(
  component: SceneComponent,
  theme: CanvasTheme,
  t: number,
  progress: number,
): ComponentFrame {
  const mode: ThemeMode = theme.mode;
  const fromLook = STATE_INFO[component.state.from].look;
  const toLook = STATE_INFO[component.state.to].look;
  const look = mixLook(fromLook, toLook, progress);
  const fromTone = component.color ?? tone(fromLook.tone, mode).solid;
  const toTone = component.color ?? tone(toLook.tone, mode).solid;
  const ringColor = mixColor(fromTone, toTone, progress);

  const motion = motionAt(component.motion, t, {
    intensity: component.intensity,
    speed: component.speed,
  });
  const overloaded =
    component.state.to === "overloaded"
      ? progress
      : component.state.from === "overloaded"
        ? 1 - progress
        : 0;
  // Overload breathes (1s) on top of any motion glow; "active" keeps a calm steady halo.
  const glow = Math.max(look.glow * (overloaded > 0 ? overloadGlow(t) : 1), motion.glow * 0.9);

  return {
    motion,
    ringColor,
    ringOpacity: look.ring,
    glowColor:
      motion.glow > look.glow ? (component.color ?? tone("neutral", mode).solid) : ringColor,
    glowOpacity: glow,
    colorOpacity: 1 - look.desaturate,
    greyOpacity: look.desaturate,
    contentOpacity: 1 - look.dim,
    ghostOpacity: look.ghost,
    ghostColor: ringColor,
    badgeFrom: {
      badge: fromLook.badge,
      color: fromTone,
      opacity: fromLook.badge === toLook.badge ? 0 : 1 - progress,
    },
    badgeTo: {
      badge: toLook.badge,
      color: toTone,
      opacity: toLook.badge === "none" ? 0 : fromLook.badge === toLook.badge ? 1 : progress,
    },
  };
}

/** Whether a component needs per-frame updates at all. */
export function componentAnimates(component: SceneComponent, transitioning: boolean): boolean {
  return transitioning || component.motion !== "none" || component.state.to === "overloaded";
}

export interface ContainerFrame {
  readonly borderColor: string;
  readonly fillColor: string;
  readonly badge: { readonly badge: StateBadge; readonly color: string; readonly opacity: number };
  readonly dim: number;
}

export function containerFrame(
  container: SceneContainer,
  base: { border: string; fill: string },
  theme: CanvasTheme,
  progress: number,
): ContainerFrame {
  const fromLook = STATE_INFO[container.state.from].look;
  const toLook = STATE_INFO[container.state.to].look;
  const stateBorder = (state: typeof container.state.from, rolledUp: boolean): string =>
    state === "healthy"
      ? base.border
      : withAlpha(tone(STATE_INFO[state].look.tone, theme.mode).solid, rolledUp ? 0.5 : 0.8);
  const stateFill = (state: typeof container.state.from, rolledUp: boolean): string =>
    state === "healthy" || rolledUp
      ? base.fill
      : tone(STATE_INFO[state].look.tone, theme.mode).fill;
  return {
    borderColor: mixColor(
      stateBorder(container.state.from, container.rolledUp.from),
      stateBorder(container.state.to, container.rolledUp.to),
      progress,
    ),
    fillColor: mixColor(
      stateFill(container.state.from, container.rolledUp.from),
      stateFill(container.state.to, container.rolledUp.to),
      progress,
    ),
    badge: {
      badge: progress < 0.5 ? fromLook.badge : toLook.badge,
      color: tone((progress < 0.5 ? fromLook : toLook).tone, theme.mode).solid,
      opacity: Math.abs(progress - 0.5) * 2,
    },
    dim: mixLook(fromLook, toLook, progress).dim * 0.6,
  };
}

export interface FlowLayer {
  readonly color: string;
  readonly opacity: number;
  readonly spacing: number;
  readonly offset: number;
  readonly reverseOffset: number | null;
}

export interface ConnectionFrame {
  readonly lineColor: string;
  readonly lineOpacity: number;
  readonly dashed: boolean;
  readonly crossOpacity: number;
  readonly crossColor: string;
  readonly from: FlowLayer;
  readonly to: FlowLayer;
}

export function connectionFrame(
  connection: SceneConnection,
  theme: CanvasTheme,
  t: number,
  progress: number,
): ConnectionFrame {
  const options = {
    speed: connection.speed,
    density: connection.density,
    direction: connection.direction,
  } as const;
  const fromInfo = FLOW_INFO[connection.flow.from];
  const toInfo = FLOW_INFO[connection.flow.to];
  const colorOf = (info: typeof fromInfo): string =>
    connection.color ?? (info.tone === "neutral" ? theme.line : tone(info.tone, theme.mode).solid);
  const layer = (
    preset: typeof connection.flow.from,
    info: typeof fromInfo,
    opacity: number,
  ): FlowLayer => {
    const frame = flowAt(preset, t, options);
    return {
      color:
        connection.color ?? tone(info.tone === "neutral" ? "green" : info.tone, theme.mode).solid,
      opacity: frame.animated ? opacity : 0,
      spacing: frame.spacing,
      offset: frame.offset,
      reverseOffset: frame.reverseOffset,
    };
  };
  const blockedFrom = connection.flow.from === "blocked" ? 1 : 0;
  const blockedTo = connection.flow.to === "blocked" ? 1 : 0;
  return {
    lineColor: mixColor(colorOf(fromInfo), colorOf(toInfo), progress),
    lineOpacity: fromInfo.lineOpacity + (toInfo.lineOpacity - fromInfo.lineOpacity) * progress,
    dashed: progress < 0.5 ? fromInfo.dashedLine : toInfo.dashedLine,
    crossOpacity: blockedFrom + (blockedTo - blockedFrom) * progress,
    crossColor: tone("rose", theme.mode).solid,
    from: layer(
      connection.flow.from,
      fromInfo,
      connection.flow.from === connection.flow.to ? 0 : 1 - progress,
    ),
    to: layer(
      connection.flow.to,
      toInfo,
      connection.flow.from === connection.flow.to ? 1 : progress,
    ),
  };
}

export function connectionAnimates(connection: SceneConnection, transitioning: boolean): boolean {
  return (
    transitioning ||
    FLOW_INFO[connection.flow.to].animated ||
    FLOW_INFO[connection.flow.from].animated
  );
}
