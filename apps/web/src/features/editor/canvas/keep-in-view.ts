"use client";

import { useEffect } from "react";
import { computeLayout, type Box } from "@mogram/core/layout";
import { PHONE_WIDTH } from "@/features/canvas/camera";
import type { EditorStore } from "../store/editor-store";

/** Phones show panels as bottom sheets (editor-shell: `max-md:h-[62dvh]`), leaving the top 38%. */
const SHEET_SHARE = 0.62;
const TOP_BAR = 64;
const MARGIN = 12;

const PANELS = ["library", "inspector", "code", "tours"] as const;

/**
 * When a sheet opens on a phone, slide the canvas so the selection sits in the strip still
 * visible above it, instead of disappearing underneath (the inspector is about what's selected).
 */
export function useKeepSelectionInView(store: EditorStore): void {
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        const opened = PANELS.some((panel) => state.panels[panel] && !previous.panels[panel]);
        if (!opened || state.viewport.width >= PHONE_WIDTH || state.selection.length === 0) return;
        const layout = computeLayout(state.diagram());
        const boxes = state.selection
          .map((name) => layout.tiles.get(name) ?? layout.elements.get(name)?.box)
          .filter((box): box is Box => box !== undefined);
        if (boxes.length === 0) return;
        const { camera, viewport } = state;
        const left = Math.min(...boxes.map((b) => b.x)) * camera.zoom + camera.x;
        const right = Math.max(...boxes.map((b) => b.x + b.w)) * camera.zoom + camera.x;
        const top = Math.min(...boxes.map((b) => b.y)) * camera.zoom + camera.y;
        const bottom = Math.max(...boxes.map((b) => b.y + b.h)) * camera.zoom + camera.y;
        const visibleTop = TOP_BAR;
        const visibleBottom = viewport.height * (1 - SHEET_SHARE) - MARGIN;
        const inView =
          top >= visibleTop &&
          bottom <= visibleBottom &&
          left >= MARGIN &&
          right <= viewport.width - MARGIN;
        if (inView) return;
        state.setCamera({
          ...camera,
          x: camera.x + viewport.width / 2 - (left + right) / 2,
          y: camera.y + (visibleTop + visibleBottom) / 2 - (top + bottom) / 2,
        });
      }),
    [store],
  );
}
