"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Box } from "@mogram/core/layout";
import { easeInOutCubic } from "@mogram/core/timeline";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import type { Camera, Viewport } from "./camera";
import type { TimeSource } from "./clock";
import {
  frameInside,
  innerCamera,
  levelOpacities,
  outerCamera,
  placeInside,
  zoomDuration,
  zoomPath,
} from "./level-zoom";
import type { SceneModel } from "./scene";
import { DiagramSvg } from "./svg/diagram-svg";
import type { CanvasTheme } from "./theme";

export interface LevelSide {
  readonly scene: SceneModel;
  readonly theme: CanvasTheme;
  /** Where this level's camera is: before going in (outer) or once inside (inner). */
  readonly camera: Camera;
  readonly underlay?: ReactNode;
}

/** One trip through a component's tile, into its nested diagram or back out (NE-6, NE-8). */
export interface LevelZoomPlan {
  readonly direction: "in" | "out";
  readonly outer: LevelSide;
  readonly inner: LevelSide;
  /** The component's tile, in the outer level's world. */
  readonly tile: Box;
  /** The inner level's area its camera frames (its diagram and the stubs either side). */
  readonly area: Box;
  /** The component being entered or left. */
  readonly component: string;
}

/**
 * Both levels drawn at once, in one camera move: going in, the camera pushes into the tile while
 * the inner diagram grows inside it as a frame, then the frame fills the screen and the parent
 * fades away; going out runs the same in reverse. The last frame is exactly what the level
 * looks like on its own, so handing back to the canvas is seamless.
 */
export function LevelTransition({
  plan,
  viewport,
  time,
  fontFamily,
  onDone,
}: {
  plan: LevelZoomPlan;
  viewport: Viewport;
  time: TimeSource;
  fontFamily: string;
  onDone: () => void;
}) {
  const placement = useMemo(() => placeInside(plan.tile, plan.area), [plan]);
  const path = useMemo(
    () => zoomPath(plan.outer.camera, outerCamera(plan.inner.camera, placement)),
    [plan, placement],
  );
  const [progress, setProgress] = useState(plan.direction === "in" ? 0 : 1);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (prefersReducedMotion()) {
      done.current();
      return;
    }
    const duration = zoomDuration(path(0), path(1), plan.direction);
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      setProgress(plan.direction === "in" ? eased : 1 - eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else done.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [plan, path]);

  const outer = path(progress);
  const inner = innerCamera(outer, placement);
  const opacity = levelOpacities(progress);
  // The tile's frame on screen, from the inner level's side: it opens up to (and past) the edges.
  const frame = frameInside(plan.tile, placement);
  const x = frame.x * inner.zoom + inner.x;
  const y = frame.y * inner.zoom + inner.y;
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.max(0, viewport.width - (x + frame.w * inner.zoom));
  const bottom = Math.max(0, viewport.height - (y + frame.h * inner.zoom));
  // Rounded like the tile while small, square once it fills the view.
  const radius = Math.max(0, Math.min(14 * outer.zoom, 28) * (1 - progress));

  return (
    <div
      aria-hidden
      data-testid="level-transition"
      data-direction={plan.direction}
      className="absolute inset-0 z-[5] overflow-hidden"
      style={{ background: plan.inner.theme.css }}
    >
      <div
        className="absolute inset-0"
        style={{ background: plan.outer.theme.css, opacity: opacity.outer }}
      >
        <DiagramSvg
          scene={plan.outer.scene}
          time={time}
          mode="view"
          fontFamily={fontFamily}
          camera={outer}
          size={viewport}
          underlay={plan.outer.underlay}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: plan.inner.theme.css,
          opacity: opacity.inner,
          clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`,
        }}
      >
        <DiagramSvg
          scene={plan.inner.scene}
          time={time}
          mode="view"
          fontFamily={fontFamily}
          camera={inner}
          size={viewport}
          underlay={plan.inner.underlay}
        />
      </div>
      {/* The tile's edge, so the frame reads as the component opening up; gone once inside. */}
      <div
        className="pointer-events-none absolute border"
        style={{
          left: x,
          top: y,
          width: frame.w * inner.zoom,
          height: frame.h * inner.zoom,
          borderRadius: radius,
          borderColor: plan.outer.theme.tileBorder,
          opacity: opacity.inner * (1 - progress),
        }}
      />
    </div>
  );
}
