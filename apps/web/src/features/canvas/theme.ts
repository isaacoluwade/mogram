import type { DiagramSettings, Tone } from "@mogram/core/model";
import type { TokenKind } from "@mogram/core/code";
import {
  CANVAS_THEME_INFO,
  CONTAINER_STYLE_INFO,
  TONES,
  paintCss,
  themeOnBackground,
  type CanvasThemeInfo,
  type ContainerStyleName,
  type ThemeMode,
  type ToneColors,
} from "@mogram/core/presets";

/** The resolved look of the canvas: a preset plus an optional custom background (ED-8, ED-24). */
export interface CanvasTheme extends CanvasThemeInfo {
  readonly name: string;
  /** CSS background for the live canvas element. */
  readonly css: string;
}

export function resolveTheme(
  settings: Pick<DiagramSettings, "theme" | "background" | "grid">,
): CanvasTheme {
  const preset = CANVAS_THEME_INFO[settings.theme];
  // Text, lines and the grid follow a custom background's lightness, not the preset's.
  const theme =
    settings.background === null ? preset : themeOnBackground(preset, settings.background);
  return {
    ...theme,
    ...(settings.grid === null ? {} : { grid: settings.grid }),
    name: settings.theme,
    css: paintCss(theme.background),
  };
}

export function backgroundCss(theme: CanvasThemeInfo): string {
  return paintCss(theme.background);
}

export function tone(name: Tone, mode: ThemeMode): ToneColors {
  return TONES[name][mode];
}

export function codeTokenColors(theme: CanvasTheme): Readonly<Record<TokenKind, string>> {
  const colors = (name: Tone) => tone(name, theme.mode).solid;
  return {
    keyword: colors("violet"),
    name: colors("blue"),
    string: colors("green"),
    number: colors("amber"),
    comment: theme.textMuted,
    punctuation: theme.textMuted,
    command: colors("blue"),
    output: theme.text,
    added: colors("green"),
    removed: colors("rose"),
    changed: colors("amber"),
    replaced: colors("orange"),
    read: colors("blue"),
    summary: colors("violet"),
    plain: theme.text,
  };
}

export interface ContainerColors {
  readonly border: string;
  readonly fill: string;
  readonly label: string;
  readonly dash: string | undefined;
  readonly icon: string;
}

export function containerColors(
  type: ContainerStyleName,
  theme: CanvasTheme,
  override: string | null,
): ContainerColors {
  const style = CONTAINER_STYLE_INFO[type];
  const colors = tone(style.tone, theme.mode);
  const dash = style.border === "dashed" ? "7 5" : style.border === "dotted" ? "1.5 4" : undefined;
  return {
    border: override ?? colors.border,
    fill: style.fill === 0 ? "transparent" : colors.fill,
    label: theme.text,
    dash,
    icon: override ?? (style.tone === "neutral" ? theme.textMuted : colors.solid),
  };
}
