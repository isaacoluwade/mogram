"use client";

import { memo, useMemo } from "react";
import { diffDiagrams, type Change, type ChangeKind } from "@mogram/core/diff";
import { computeLayout, type Box, type LayoutResult } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import { TONES } from "@mogram/core/presets";
import { routeConnections, type RoutedPath } from "@mogram/core/routing";
import type { CanvasTheme } from "@/features/canvas/theme";
import { useEditorShallow } from "../editor-context";
import { parseCached } from "../store/editor-store";

/** Things on the canvas (elements and connections), as opposed to scenes, settings and files. */
const DRAWN = new Set<Change["thing"]>([
  "component",
  "shape",
  "container",
  "group",
  "connection",
  "note",
]);

export const CHANGE_TONES = { added: "green", changed: "amber", removed: "rose" } as const;

/**
 * What changed, drawn over an earlier version (version history, Show changes): added in green,
 * changed in amber, removed in red. Whatever isn't in the version on the canvas (removed since
 * the version before, or added since, when compared with now) is drawn as a dashed ghost where it
 * was.
 */
export function VersionChangesOverlay({
  diagram,
  layout,
  routes,
  theme,
  zoom,
}: {
  diagram: Diagram;
  layout: LayoutResult;
  routes: ReadonlyMap<string, RoutedPath>;
  theme: CanvasTheme;
  zoom: number;
}) {
  const { compare, current, folder } = useEditorShallow((s) => ({
    compare: s.viewing?.compare ?? null,
    current: s.files,
    folder: s.folder,
  }));
  const other = useMemo(() => {
    if (compare === null) return null;
    const files = compare.mode === "current" ? current : compare.files;
    return parseCached(files, folder).diagram;
  }, [compare, current, folder]);
  const drawn = useMemo(() => {
    if (compare === null || other === null) return null;
    // Always from older to newer, so green is always "added" and red "removed".
    const [older, newer] = compare.mode === "previous" ? [other, diagram] : [diagram, other];
    const changes = diffDiagrams(older, newer).filter((change) => DRAWN.has(change.thing));
    // Ghosts: what the version on the canvas doesn't have.
    const missing: ChangeKind = compare.mode === "previous" ? "removed" : "added";
    const ghosts = changes.filter((change) => change.change === missing);
    const ghostLayout = ghosts.length > 0 ? computeLayout(other) : null;
    const ghostRoutes =
      ghostLayout !== null && ghosts.some((g) => g.thing === "connection")
        ? routeConnections(other, ghostLayout)
        : null;
    return { changes, missing, ghostLayout, ghostRoutes };
  }, [compare, other, diagram]);
  if (drawn === null || drawn.changes.length === 0) return null;
  return (
    <ChangeMarks
      changes={drawn.changes}
      missing={drawn.missing}
      layout={layout}
      routes={routes}
      ghostLayout={drawn.ghostLayout}
      ghostRoutes={drawn.ghostRoutes}
      theme={theme}
      zoom={zoom}
    />
  );
}

const ChangeMarks = memo(function ChangeMarks({
  changes,
  missing,
  layout,
  routes,
  ghostLayout,
  ghostRoutes,
  theme,
  zoom,
}: {
  changes: readonly Change[];
  missing: ChangeKind;
  layout: LayoutResult;
  routes: ReadonlyMap<string, RoutedPath>;
  ghostLayout: LayoutResult | null;
  ghostRoutes: ReadonlyMap<string, RoutedPath> | null;
  theme: CanvasTheme;
  zoom: number;
}) {
  const px = (value: number) => value / zoom;
  const colorOf = (kind: ChangeKind) => TONES[CHANGE_TONES[kind]][theme.mode].solid;
  const boxOf = (source: LayoutResult, name: string): Box | null =>
    source.elements.get(name)?.box ?? source.groups.get(name) ?? null;

  return (
    <g data-overlay="version-changes" pointerEvents="none">
      {changes.map((change) => {
        const color = colorOf(change.change);
        const ghost = change.change === missing;
        const key = `${change.change}:${change.name}`;
        if (change.thing === "connection") {
          const route = (ghost ? ghostRoutes : routes)?.get(change.name);
          if (route === undefined) return null;
          return (
            <path
              key={key}
              data-change={change.change}
              data-ghost={ghost || undefined}
              data-name={change.name}
              d={route.d}
              fill="none"
              stroke={color}
              strokeOpacity={ghost ? 0.9 : 0.55}
              strokeWidth={px(ghost ? 2 : 6)}
              strokeLinecap="round"
              strokeLinejoin="round"
              {...(ghost ? { strokeDasharray: `${px(6)} ${px(5)}` } : {})}
            />
          );
        }
        const box = ghost
          ? ghostLayout === null
            ? null
            : boxOf(ghostLayout, change.name)
          : boxOf(layout, change.name);
        if (box === null) return null;
        const pad = px(4);
        return (
          <g
            key={key}
            data-change={change.change}
            data-ghost={ghost || undefined}
            data-name={change.name}
          >
            <rect
              x={box.x - pad}
              y={box.y - pad}
              width={box.w + pad * 2}
              height={box.h + pad * 2}
              rx={12}
              fill={color}
              fillOpacity={ghost ? 0.08 : 0.06}
              stroke={color}
              strokeWidth={px(2)}
              {...(ghost ? { strokeDasharray: `${px(6)} ${px(5)}` } : {})}
            />
            {ghost ? (
              <text
                x={box.x + box.w / 2}
                y={box.y + box.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={Math.max(11, Math.min(14, box.w / 8))}
                fontWeight={500}
              >
                {change.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
});
