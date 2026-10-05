"use client";

import { ArrowLeft } from "lucide-react";
import { setSetting } from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import type { Diagram } from "@mogram/core/model";
import {
  CANVAS_THEME_INFO,
  FEATURED_THEMES,
  THEME_FAMILIES,
  paintCss,
  type CanvasThemeInfo,
  type CanvasThemeName,
} from "@mogram/core/presets";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { useEditorStore } from "../editor-context";

/** Picks a theme, clearing any custom background with it, as one undo step. */
function usePickTheme(): (name: CanvasThemeName) => void {
  const store = useEditorStore();
  return (name) =>
    store.getState().edit("Canvas theme", (files, d) => {
      const cleared =
        d.settings.background === null
          ? { files }
          : setSetting(files, d, { key: "background", value: null });
      return setSetting(cleared.files, parseDiagram(cleared.files, d.folder).diagram, {
        key: "theme",
        value: name,
      });
    });
}

/** The theme in use, or null while a custom background replaces it. */
function currentTheme(diagram: Diagram): CanvasThemeName | null {
  return diagram.settings.background === null ? diagram.settings.theme : null;
}

/**
 * A theme at a glance: its background with two nodes and a line in its own tile, border, line
 * and label colours, so the choice shows how a diagram will look, not just a colour.
 */
function ThemePreview({ info }: { info: CanvasThemeInfo }) {
  return (
    <svg viewBox="0 0 64 48" className="size-full" aria-hidden>
      <line x1="22" y1="21" x2="42" y2="21" stroke={info.line} strokeWidth="1.5" />
      {[8, 42].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y="14"
            width="14"
            height="14"
            rx="3.5"
            fill={info.tile}
            stroke={info.tileBorder}
          />
          <rect x={x + 1} y="32" width="12" height="2.5" rx="1.25" fill={info.textMuted} />
        </g>
      ))}
    </svg>
  );
}

/** The tile inside a theme's button: the button takes the click and focus. */
function ThemeTile({
  name,
  selected,
  className,
}: {
  name: CanvasThemeName;
  selected: boolean;
  className?: string;
}) {
  const info = CANVAS_THEME_INFO[name];
  return (
    <span
      className={cn(
        "block overflow-hidden rounded-md inset-ring inset-ring-border-strong transition-[transform,box-shadow] group-hover:scale-[1.04]",
        selected && "ring-2 ring-fg ring-offset-2 ring-offset-card",
        "group-focus-visible:ring-2 group-focus-visible:ring-border-emphasis group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card",
        className,
      )}
      style={{ background: `${paintCss(info.background)} no-repeat border-box` }}
    >
      <ThemePreview info={info} />
    </span>
  );
}

/**
 * The first view of the canvas themes (ED-8): ten with real variety — one or two from each
 * family — and the theme in use always among them.
 */
export function FeaturedThemes({ diagram }: { diagram: Diagram }) {
  const pick = usePickTheme();
  const current = currentTheme(diagram);
  const shown =
    current === null || FEATURED_THEMES.includes(current)
      ? FEATURED_THEMES
      : [current, ...FEATURED_THEMES.slice(0, -1)];
  return (
    <div role="radiogroup" aria-label="Canvas theme" className="grid grid-cols-5 gap-2.5">
      {shown.map((name) => {
        const info = CANVAS_THEME_INFO[name];
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={current === name}
            aria-label={info.label}
            title={`${info.label} (${info.mode})`}
            onClick={() => pick(name)}
            className="group rounded-md outline-none"
          >
            <ThemeTile name={name} selected={current === name} className="aspect-square" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Every canvas theme by family, with names (the inspector's "See all", like the colour picker's):
 * picking one applies it and stays here, so several can be tried in a row.
 */
export function ThemeGallery({ diagram, onBack }: { diagram: Diagram; onBack: () => void }) {
  const pick = usePickTheme();
  const current = currentTheme(diagram);
  return (
    <section aria-label="All canvas themes" className="flex flex-col">
      <div className="flex h-11 items-center gap-1.5 border-b border-border-subtle px-2">
        <IconButton label="Back" size="sm" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <h3 className="text-label font-medium text-fg">Canvas themes</h3>
      </div>
      <div
        role="radiogroup"
        aria-label="Canvas theme"
        className="flex flex-col gap-5 px-3.5 pb-4 pt-3.5"
      >
        {THEME_FAMILIES.map((family) => (
          <div key={family.name} role="group" aria-label={family.name}>
            <h4 className="mb-2.5 text-caption font-medium text-fg-soft">{family.name}</h4>
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-3">
              {family.themes.map((name) => {
                const info = CANVAS_THEME_INFO[name];
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={current === name}
                    aria-label={info.label}
                    title={`${info.label} (${info.mode})`}
                    onClick={() => pick(name)}
                    className="group flex flex-col gap-1.5 rounded-md text-left outline-none"
                  >
                    <ThemeTile
                      name={name}
                      selected={current === name}

                      className="aspect-[4/3] w-full"
                    />
                    <span
                      className={cn(
                        "truncate text-micro transition-colors",
                        current === name ? "text-fg" : "text-fg-muted group-hover:text-fg-soft",
                      )}
                    >
                      {info.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
