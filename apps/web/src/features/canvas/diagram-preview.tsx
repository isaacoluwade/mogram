"use client";

import { useCapacity } from "./capacity";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import { fitBox, type Camera } from "./camera";
import { Clock } from "./clock";
import { buildScene } from "./scene";
import { useFontsVersion } from "./text";
import { DiagramSvg } from "./svg/diagram-svg";
import { resolveTheme } from "./theme";
import { resolveFor, useLayout, useParsedDiagram, useRoutes } from "./use-diagram";

/**
 * A read-only, animated diagram that fits its box. Used on the landing page, in previews and
 * for scene thumbnails.
 */
export function DiagramPreview({
  files,
  folder = "",
  scene = null,
  className,
  padding = 32,
  minZoom,
  insets,
  animate = true,
}: {
  files: ProjectFiles;
  folder?: string;
  scene?: string | null;
  className?: string;
  padding?: number;
  /** Small boxes (phones) show the middle of the diagram at a readable size instead of all of it. */
  minZoom?: number;
  /** Room kept clear of the diagram, e.g. under a scene control laid over the preview. */
  insets?: { top: number; right: number; bottom: number; left: number };
  animate?: boolean;
}) {
  const { diagram } = useParsedDiagram(files, folder);
  const layout = useLayout(diagram);
  const routes = useRoutes(diagram, layout);
  const resolved = useMemo(
    () => resolveFor(files, folder, diagram, scene),
    [files, folder, diagram, scene],
  );
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  const [clock] = useState(() => new Clock());

  // Scene changes animate like the editor's (SC-7): remember where we came from for 600ms.
  const [transition, setTransition] = useState<{ from: string | null; start: number } | null>(null);
  const shownScene = useRef(scene);
  useLayoutEffect(() => {
    if (shownScene.current === scene) return;
    setTransition({ from: shownScene.current, start: clock.time() });
    shownScene.current = scene;
  }, [scene, clock]);
  useEffect(() => {
    if (transition === null) return;
    const timer = window.setTimeout(() => setTransition(null), 700);
    return () => window.clearTimeout(timer);
  }, [transition]);
  const previous = useMemo(
    () => (transition === null ? null : resolveFor(files, folder, diagram, transition.from)),
    [files, folder, diagram, transition],
  );

  // Text measured before the fonts loaded is measured again once they have.
  const fonts = useFontsVersion();
  const model = useMemo(
    () =>
      buildScene({
        diagram,
        files,
        layout,
        routes,
        current: resolved,
        previous,
        transitionStart: transition?.start ?? null,
        theme,
        fontFamily: "Inter",
        fontsVersion: fonts,
      }),
    [diagram, files, layout, routes, resolved, previous, transition, theme, fonts],
  );

  // Capacity over time (D-82): a preview that changes scene shows copies booting and draining.
  const capacity = useCapacity(diagram, resolved, () => clock.time(), !animate);

  const host = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined)
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => clock.dispose(), [clock]);
  // Previews can start and stop animating (e.g. on hover); reduced motion keeps them still.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) clock.pause();
    else clock.resume();
    clock.tick();
  }, [clock, animate]);

  const camera: Camera | null =
    size === null
      ? null
      : fitBox(model.bounds, size, {
          padding,
          maxZoom: 1,
          ...(minZoom !== undefined ? { minZoom } : {}),
          ...(insets !== undefined ? { insets } : {}),
        });

  return (
    <div ref={host} className={className} style={{ background: theme.css }}>
      {camera !== null && size !== null ? (
        <DiagramSvg
          scene={model}
          capacity={capacity}
          time={{ kind: "live", clock }}
          mode="view"
          fontFamily="var(--font-sans)"
          camera={camera}
          size={size}
        />
      ) : null}
    </div>
  );
}
