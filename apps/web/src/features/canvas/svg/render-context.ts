"use client";

import { createContext, use } from "react";
import type { CanvasTheme } from "../theme";

export type RenderMode = "edit" | "view" | "export";

export interface RenderSettings {
  readonly theme: CanvasTheme;
  /** CSS font-family for diagram text (a CSS variable live, "Inter" in exports). */
  readonly fontFamily: string;
  readonly transitionStart: number | null;
  readonly mode: RenderMode;
  /** Elements in focus during a tour or card (TO-1); everything else fades. Null = no focus. */
  readonly focus: ReadonlySet<string> | null;
  /** This diagram's own <defs> ids: several diagrams share a page (thumbnails, previews). */
  readonly ids: SvgIds;
  /** The viewer: things that open a card (or more) can be reached with Tab and opened with Enter. */
  readonly interactive: boolean;
  /** Text or note being typed into on the canvas: its words are drawn by the text field instead. */
  readonly editingText: string | null;
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
}

export function svgIds(prefix: string): SvgIds {
  return {
    desaturate: `${prefix}-desaturate`,
    glow: `${prefix}-glow`,
    sheen: `${prefix}-sheen`,
    background: `${prefix}-background`,
    grid: `${prefix}-grid`,
  };
}

export const RenderContext = createContext<RenderSettings | null>(null);

export function useRender(): RenderSettings {
  const settings = use(RenderContext);
  if (settings === null) throw new Error("Diagram nodes must be rendered inside <DiagramSvg>.");
  return settings;
}

/** Opacity for an element given the current focus set (TO-1: focused stays full strength). */
export function focusOpacity(settings: RenderSettings, ...names: string[]): number {
  if (settings.focus === null) return 1;
  return names.some((name) => settings.focus?.has(name) === true) ? 1 : 0.22;
}
