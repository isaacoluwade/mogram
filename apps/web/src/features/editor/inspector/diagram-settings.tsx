"use client";

import { useMemo, useState } from "react";
import { FileCode2 } from "lucide-react";
import { setSetting } from "@mogram/core/edit";
import { computeLayout } from "@mogram/core/layout";
import { lintDiagram } from "@mogram/core/lint";
import type { Diagram } from "@mogram/core/model";
import {
  CANVAS_THEME_INFO,
  PAGES,
  formatHex,
  formatPaint,
  paintName,
  paintColors,
  parseColor,
} from "@mogram/core/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropertyRow } from "@/components/ui/property-row";
import { Switch } from "@/components/ui/switch";
import { ColorStrip } from "@/components/ui/color/color-area";
import { ColorPicker } from "@/components/ui/color/color-picker";
import { SwatchFace } from "@/components/ui/color/swatch";
import { resolveTheme } from "@/features/canvas/theme";
import { zoomToFit } from "../actions";
import { useEditor, useEditorStore } from "../editor-context";
import { CommitInput, FieldRow, FieldStack, InspectorSection } from "./fields";
import { documentColors } from "./document-colors";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { preference, setPreference, usePreference } from "@/lib/preferences";
import { DataSection } from "./link-data";
import { ConceptSection } from "./concept-section";
import { FeaturedThemes, ThemeGallery } from "./theme-picker";
import type { DiagramTab } from "./tabs";
import { DeckSettings } from "./slide-inspector";

/**
 * Nothing selected: the diagram itself (ED-8, ED-24, FI-16). Diagram: problems, name and files.
 * Canvas: theme, background and grid.
 */
export function DiagramSettings({ diagram, tab }: { diagram: Diagram; tab: DiagramTab }) {
  const store = useEditorStore();
  // "See all" on the Canvas tab: every theme by family, in place of the tab's sections.
  const [allThemes, setAllThemes] = useState(false);
  const showGrid = usePreference("showGrid");
  const gridStyle = usePreference("gridStyle");
  const diagnostics = useEditor((s) => s.parsed().diagnostics);
  const errors = diagnostics.filter((d) => d.severity === "error");
  const findings = useMemo(() => lintDiagram(diagram), [diagram]);
  const stats = useMemo(() => {
    const layout = computeLayout(diagram);
    const unpinned = [...layout.elements.values()].filter(
      (e) => !e.pinned && e.kind !== "decoration",
    ).length;
    return { unpinned };
  }, [diagram]);
  const setting = (
    key: "name" | "description" | "theme" | "page" | "background" | "grid",
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
    if (!preference("showGrid")) store.getState().toggleGrid();
    setting("grid", color, { coalesce: live });
  };

  const problemsSection = (
    <InspectorSection
      id="problems"
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
  );

  // Architecture review: what parses but probably isn't meant (a subnet outside any network).
  const reviewSection =
    findings.length === 0 ? null : (
      <InspectorSection
        id="review"
        title="Suggestions"
        aside={
          <Badge
            tone={findings.some((f) => f.severity === "warning") ? "amber" : "neutral"}
            size="sm"
          >
            {findings.length}
          </Badge>
        }
      >
        <ul className="flex flex-col gap-1.5" aria-label="Suggestions">
          {findings.slice(0, 20).map((finding) => (
            <li key={`${finding.rule}:${finding.elements.join(",")}`}>
              <button
                type="button"
                onClick={() => store.getState().select(finding.elements)}
                className="w-full rounded-md border border-border-subtle bg-fill-faint px-2.5 py-2 text-left text-caption leading-snug hover:bg-fill-hover"
              >
                <span className={finding.severity === "warning" ? "text-amber" : "text-fg-soft"}>
                  {finding.message}
                </span>
                <span className="mt-0.5 block text-fg-muted">{finding.fix}</span>
              </button>
            </li>
          ))}
        </ul>
      </InspectorSection>
    );

  return (
    <>
      {tab === "diagram" ? (
        <>
          {errors.length > 0 ? problemsSection : null}
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
          {diagram.settings.deck !== null ? <DeckSettings diagram={diagram} /> : null}
          <DataSection name={null} data={diagram.settings.data} />
          <ConceptSection diagram={diagram} />
          <InspectorSection id="files" title="Files" defaultOpen={false}>
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
          {errors.length === 0 ? problemsSection : null}
          {reviewSection}
        </>
      ) : allThemes ? (
        <ThemeGallery diagram={diagram} onBack={() => setAllThemes(false)} />
      ) : (
        <>
          <InspectorSection
            id="canvas"
            title="Canvas"
            aside={
              <button
                type="button"
                onClick={() => setAllThemes(true)}
                className="rounded-sm text-caption text-fg-muted transition-colors hover:text-fg"
              >
                See all
              </button>
            }
          >
            <FeaturedThemes diagram={diagram} />
            <div className="mt-4">
              {/* A page (D-98): a fixed frame for a slide, a video or a clean export. */}
              <FieldRow label="Page">
                <SegmentedControl
                  label="Page"
                  size="sm"
                  value={diagram.settings.page ?? "none"}
                  onChange={(page) => {
                    setting("page", page);
                    // The page is what's being composed now: bring it into view.
                    if (page !== "none") zoomToFit(store);
                  }}
                  options={[
                    { value: "none", label: "None" },
                    ...PAGES.map((page) => ({ value: page, label: page })),
                  ]}
                />
              </FieldRow>
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
                      {diagram.settings.background === null ? (
                        `${CANVAS_THEME_INFO[diagram.settings.theme].label} theme`
                      ) : (
                        <>
                          {paintName(diagram.settings.background) ??
                            (diagram.settings.background.kind === "solid"
                              ? diagram.settings.background.color
                              : "Gradient")}
                          <span className="text-fg-muted"> · custom</span>
                        </>
                      )}
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
          <InspectorSection id="grid" title="Grid">
            <FieldStack>
              <FieldRow label="Show grid">
                <Switch
                  checked={showGrid}
                  onCheckedChange={() => store.getState().toggleGrid()}
                  aria-label="Show grid"
                />
              </FieldRow>
              <FieldRow label="Style">
                <SegmentedControl
                  label="Grid style"
                  size="sm"
                  className="flex-1"
                  value={gridStyle}
                  onChange={(style) => {
                    setPreference("gridStyle", style);
                    // Choosing a style shows it.
                    if (!preference("showGrid")) store.getState().toggleGrid();
                  }}
                  options={[
                    { value: "dots", label: "Dots" },
                    { value: "lines", label: "Lines" },
                  ]}
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
              Everything snaps to an 8px grid whether or not it’s shown. Every mark is a snap point,
              with a stronger one every 10 cells: the numbers in the Arrange tab and the YAML count
              these cells.
            </p>
          </InspectorSection>
        </>
      )}
    </>
  );
}
