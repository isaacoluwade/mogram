"use client";

import { useMemo } from "react";
import { FileCode2 } from "lucide-react";
import { setSetting } from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import { computeLayout } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import {
  CANVAS_THEMES,
  CANVAS_THEME_INFO,
  formatHex,
  formatPaint,
  paintColors,
  parseColor,
} from "@mogram/core/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropertyRow } from "@/components/ui/property-row";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { ColorStrip } from "@/components/ui/color/color-area";
import { ColorPicker } from "@/components/ui/color/color-picker";
import { SwatchFace } from "@/components/ui/color/swatch";
import { backgroundCss, resolveTheme } from "@/features/canvas/theme";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { CommitInput, FieldRow, FieldStack, InspectorSection } from "./fields";
import { documentColors } from "./document-colors";

/** Nothing selected: the diagram itself (ED-8, ED-24, FI-16). */
export function DiagramSettings({ diagram }: { diagram: Diagram }) {
  const store = useEditorStore();
  const { showGrid } = useEditorShallow((s) => ({ showGrid: s.showGrid }));
  const diagnostics = useEditor((s) => s.parsed().diagnostics);
  const errors = diagnostics.filter((d) => d.severity === "error");
  const stats = useMemo(() => {
    const layout = computeLayout(diagram);
    const unpinned = [...layout.elements.values()].filter(
      (e) => !e.pinned && e.kind !== "decoration",
    ).length;
    return { unpinned };
  }, [diagram]);
  const setting = (
    key: "name" | "description" | "theme" | "background" | "grid",
    value: string | null,
    options?: { coalesce?: boolean },
  ) =>
    store
      .getState()
      .edit(
        options?.coalesce === true ? "Canvas colour" : "Diagram setting",
        (files, d) => setSetting(files, d, { key, value }),
        options,
      );
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  const colors = useMemo(() => documentColors(diagram), [diagram]);
  const gridRgba = parseColor(theme.grid);
  const gridHex = formatHex(gridRgba);
  /** Changing the grid shows it, so the change can be seen. */
  const setGrid = (color: string | null, live: boolean) => {
    if (!store.getState().showGrid) store.getState().toggleGrid();
    setting("grid", color, { coalesce: live });
  };

  return (
    <>
      <InspectorSection title="Name">
        <div className="flex flex-col gap-2">
          <CommitInput
            label="Diagram name"
            value={diagram.settings.name}
            onCommit={(value) => setting("name", value)}
          />
          <CommitInput
            label="Description"
            placeholder="What this diagram shows"
            value={diagram.settings.description ?? ""}
            onCommit={(value) => setting("description", value)}
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Canvas">
        <div role="radiogroup" aria-label="Canvas theme" className="grid grid-cols-5 gap-2">
          {CANVAS_THEMES.map((name) => {
            const info = CANVAS_THEME_INFO[name];
            const selected =
              diagram.settings.theme === name && diagram.settings.background === null;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={info.label}
                title={`${info.label} (${info.mode})`}
                onClick={() =>
                  // One undo step: clear any custom colour and pick the theme together.
                  store.getState().edit("Canvas theme", (files, d) => {
                    const cleared =
                      d.settings.background === null
                        ? { files }
                        : setSetting(files, d, { key: "background", value: null });
                    return setSetting(
                      cleared.files,
                      parseDiagram(cleared.files, d.folder).diagram,
                      {
                        key: "theme",
                        value: name,
                      },
                    );
                  })
                }
                className={cn(
                  "aspect-square rounded-md border transition-transform hover:scale-105",
                  selected ? "border-fg ring-2 ring-border-emphasis" : "border-border-strong",
                )}
                style={{ background: backgroundCss(info) }}
              />
            );
          })}
        </div>
        <div className="mt-3">
          <FieldRow label="Background">
            <ColorPicker
              label="Background"
              value={diagram.settings.background}
              gradients
              alpha={false}
              none="Theme background"
              documentColors={colors}
              onChange={(paint, live) =>
                setting("background", paint === null ? null : formatPaint(paint), {
                  coalesce: live,
                })
              }
            >
              <button
                type="button"
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-fill-field px-1.5 text-left text-caption text-fg-soft transition-colors hover:bg-fill-hover"
              >
                <SwatchFace paint={theme.background} />
                <span className="truncate">
                  {diagram.settings.background === null
                    ? `${CANVAS_THEME_INFO[diagram.settings.theme].label} theme`
                    : diagram.settings.background.kind === "solid"
                      ? diagram.settings.background.color
                      : "Custom gradient"}
                </span>
              </button>
            </ColorPicker>
            {diagram.settings.background !== null ? (
              <button
                type="button"
                onClick={() => setting("background", null)}
                className="shrink-0 text-caption text-fg-muted hover:text-fg"
              >
                Reset
              </button>
            ) : null}
          </FieldRow>
        </div>
      </InspectorSection>
      <InspectorSection title="Grid">
        <FieldStack>
          <FieldRow label="Show grid">
            <Switch
              checked={showGrid}
              onCheckedChange={() => store.getState().toggleGrid()}
              aria-label="Show grid"
            />
          </FieldRow>
          <FieldRow label="Colour">
            <ColorPicker
              label="Grid colour"
              alpha={false}
              value={{ kind: "solid", color: formatHex({ ...gridRgba, a: 1 }) }}
              none="Automatic"
              documentColors={colors}
              onChange={(paint, live) => {
                const color = paint === null ? null : (paintColors(paint)[0] ?? null);
                // Opacity has its own slider below, so a new colour keeps the current opacity.
                setGrid(
                  color === null ? null : formatHex({ ...parseColor(color), a: gridRgba.a }),
                  live,
                );
              }}
            >
              <button
                type="button"
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-fill-field px-1.5 text-left text-caption text-fg-soft transition-colors hover:bg-fill-hover"
              >
                <SwatchFace paint={{ kind: "solid", color: gridHex }} />
                <span className="truncate">
                  {diagram.settings.grid === null ? "Automatic" : gridHex.slice(0, 7)}
                </span>
              </button>
            </ColorPicker>
            {diagram.settings.grid !== null ? (
              <button
                type="button"
                onClick={() => setGrid(null, false)}
                className="shrink-0 text-caption text-fg-muted hover:text-fg"
              >
                Reset
              </button>
            ) : null}
          </FieldRow>
          <FieldRow label="Opacity">
            <ColorStrip
              label="Grid opacity"
              value={gridRgba.a}
              valueText={`${Math.round(gridRgba.a * 100)}%`}
              track={`linear-gradient(to right, transparent, ${formatHex({ ...gridRgba, a: 1 })})`}
              thumb={gridHex}
              className="flex-1"
              onChange={(alpha, live) => setGrid(formatHex({ ...gridRgba, a: alpha }), live)}
            />
            <span className="w-9 shrink-0 text-right text-caption tabular-nums text-fg-muted">
              {Math.round(gridRgba.a * 100)}%
            </span>
          </FieldRow>
        </FieldStack>
        <p className="mt-2 text-caption text-fg-muted">
          Everything snaps to an 8px grid whether or not it’s shown.
        </p>
      </InspectorSection>
      <InspectorSection title="Files">
        <PropertyRow label="Mode">
          <span className="text-caption">
            {diagram.mode === "single" ? "Single file" : "Folder"}
          </span>
        </PropertyRow>
        <PropertyRow label="Layout">
          <span className="truncate font-mono text-caption">{diagram.layoutFile}</span>
        </PropertyRow>
        <PropertyRow label="Auto-placed">
          <span className="text-caption tabular-nums">{stats.unpinned}</span>
        </PropertyRow>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => store.getState().togglePanel("code", true)}
        >
          <FileCode2 /> View YAML
        </Button>
      </InspectorSection>
      <InspectorSection
        title="Problems"
        aside={
          <Badge tone={errors.length > 0 ? "rose" : "green"} size="sm">
            {errors.length}
          </Badge>
        }
      >
        {diagnostics.length === 0 ? (
          <p className="text-caption text-fg-muted">The files are valid.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {diagnostics.slice(0, 20).map((diagnostic, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => {
                    store.getState().setCodeFile(diagnostic.file);
                    store.getState().togglePanel("code", true);
                  }}
                  className="w-full rounded-md border border-border-subtle bg-fill-faint px-2.5 py-2 text-left text-caption leading-snug text-fg-soft hover:bg-fill-hover"
                >
                  <span className={diagnostic.severity === "error" ? "text-rose" : "text-amber"}>
                    {diagnostic.file}:{diagnostic.line}
                  </span>{" "}
                  {diagnostic.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>
    </>
  );
}
