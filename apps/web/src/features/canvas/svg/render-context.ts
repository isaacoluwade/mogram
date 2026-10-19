"use client";

import { createContext, use } from "react";
import type { CanvasTheme } from "../theme";
import type { CapacityRuntime } from "../capacity";

export type RenderMode = "edit" | "view" | "export";

export interface RenderSettings {
  readonly theme: CanvasTheme;
  /** CSS font-family for diagram text (a CSS variable live, "Inter" in exports). */
  readonly fontFamily: string;
  readonly transitionStart: number | null;
  /** How long the change of scene or step under way takes, in seconds. */
  readonly transitionSeconds: number;
  readonly mode: RenderMode;
  /** Elements in focus during a tour or card (TO-1); everything else fades. Null = no focus. */
  readonly focus: ReadonlySet<string> | null;
  /** This diagram's own <defs> ids: several diagrams share a page (thumbnails, previews). */
  readonly ids: SvgIds;
  /** The viewer: things that open a card (or more) can be reached with Tab and opened with Enter. */
  readonly interactive: boolean;
  /** Text or note being typed into on the canvas: its words are drawn by the text field instead. */
  readonly editingText: string | null;
  /** Capacity over time (D-82), when the diagram models it. */
  readonly capacity: CapacityRuntime | null;
  /** When the step showing began and how long its values take to run (D-88); null: settled. */
  readonly ramp: { readonly start: number; readonly seconds: number } | null;
}

/** Makes an element a keyboard stop in an interactive diagram; nothing anywhere else. */
export function actionProps(
  settings: RenderSettings,
  label: string,
  actionable = true,
): { tabIndex?: number; role?: "button"; "aria-label"?: string } {
  return settings.interactive && actionable
    ? { tabIndex: 0, role: "button", "aria-label": label }
    : {};
}

export interface SvgIds {
  readonly desaturate: string;
  readonly glow: string;
  readonly sheen: string;
  readonly background: string;
  readonly grid: string;
  /** Clips the diagram to its page (D-98). */
  readonly page: string;
}

export function svgIds(prefix: string): SvgIds {
  return {
    desaturate: `${prefix}-desaturate`,
    glow: `${prefix}-glow`,
    sheen: `${prefix}-sheen`,
    background: `${prefix}-background`,
    grid: `${prefix}-grid`,
    page: `${prefix}-page`,
  };
}

export const RenderContext = createContext<RenderSettings | null>(null);

export function useRender(): RenderSettings {
  const settings = use(RenderContext);
  if (settings === null) throw new Error("Diagram nodes must be rendered inside <DiagramSvg>.");
  return settings;
}

/** How strongly something out of focus is drawn while a step or tour focuses on others. */
export const FOCUS_DIM = 0.22;

/** Whether one of an element's parts (`element.part`, D-104) is in focus. */
export function focusWithin(focus: ReadonlySet<string> | null, name: string): boolean {
  if (focus === null) return false;
  for (const target of focus) if (target.startsWith(`${name}.`)) return true;
  return false;
}

/**
 * Opacity for an element given the current focus set (TO-1): full strength when it, or one of
 * its parts, is in focus. Within the element, what isn't in focus dims itself.
 */
export function focusOpacity(settings: RenderSettings, ...names: string[]): number {
  const { focus } = settings;
  if (focus === null) return 1;
  return names.some((name) => focus.has(name) || focusWithin(focus, name)) ? 1 : FOCUS_DIM;
}
