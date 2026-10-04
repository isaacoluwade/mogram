"use client";

import { useEffect, useRef } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import { renderThumbnail } from "@/features/export/export";
import type { EditorStore } from "../store/editor-store";

const QUIET_MS = 2500;

/**
 * Keeps the dashboard thumbnail current: a while after each successful save, the top level is
 * rendered to a small JPEG and stored. It never delays a save, and failures are ignored (a stale
 * thumbnail is harmless).
 */
export function useThumbnails(
  store: EditorStore,
  save: (thumbnail: string) => Promise<void>,
  hasThumbnail: boolean,
): void {
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    let timer: number | null = null;
    let rendered: ProjectFiles | null = null;
    let alive = true;
    const render = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        const files = store.getState().files;
        if (files === rendered) return;
        rendered = files;
        void renderThumbnail(files)
          .then((thumbnail) => (alive ? saveRef.current(thumbnail) : undefined))
          .catch(() => undefined);
      }, QUIET_MS);
    };
    if (!hasThumbnail) render();
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.save.kind === "saved" && previous.save.kind !== "saved") render();
    });
    return () => {
      alive = false;
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [store, hasThumbnail]);
}
