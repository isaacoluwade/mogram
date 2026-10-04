"use client";

import { useEffect, useState } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import { ApiError } from "@/lib/api/client";
import type { EditorStore } from "../store/editor-store";

export interface Autosave {
  /** Saves now (if anything changed); true once the files on screen are stored. */
  flush(): Promise<boolean>;
  /** Marks `files` as already stored (after loading a newer version from the server). */
  markSaved(files: ProjectFiles): void;
}

const MAX_BACKOFF_MS = 30_000;

/** A save that retrying can't fix (the draft is gone, the request is refused). */
export class PermanentSaveError extends Error {
  override readonly name = "PermanentSaveError";
}

/** 4xx means the request itself is wrong, except timeouts and rate limits, which pass. */
function isPermanent(error: unknown): boolean {
  if (error instanceof PermanentSaveError) return true;
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 401)
    return "Your session has ended. Sign in again to keep saving.";
  return error instanceof Error ? error.message : "Couldn't save.";
}

/**
 * Debounced autosave. Every change is stored after `delay` ms of quiet; failures retry with
 * backoff; a conflict (409) stops saving until the person chooses what to keep. Leaving the page
 * with unstored changes asks for confirmation.
 */
export class AutosaveController implements Autosave {
  private persist: ((files: ProjectFiles) => Promise<void>) | null = null;
  private saved: ProjectFiles;
  private timer: number | null = null;
  private running: Promise<boolean> | null = null;
  private failures = 0;

  constructor(
    private readonly store: EditorStore,
    private readonly delay: number,
  ) {
    this.saved = store.getState().files;
  }

  hasUnsaved(): boolean {
    return this.store.getState().files !== this.saved;
  }

  markSaved(files: ProjectFiles): void {
    this.saved = files;
  }

  schedule(ms = this.delay): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.run();
    }, ms);
  }

  async flush(): Promise<boolean> {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    return this.run();
  }

  private async run(): Promise<boolean> {
    if (this.running !== null) {
      // Wait for the save in flight, then store whatever changed meanwhile.
      await this.running;
      return this.run();
    }
    const state = this.store.getState();
    const files = state.files;
    if (files === this.saved) return true;
    if (this.persist === null || state.save.kind === "conflict") return false;
    state.setSave({ kind: "saving" });
    this.running = this.attempt(files);
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  private async attempt(files: ProjectFiles): Promise<boolean> {
    try {
      await this.persist?.(files);
      this.saved = files;
      this.failures = 0;
      if (this.store.getState().files === files)
        this.store.getState().setSave({ kind: "saved", at: Date.now() });
      else this.schedule();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === "conflict") {
        this.store
          .getState()
          .setSave({ kind: "conflict", currentVersion: error.currentVersion ?? 0 });
        return false;
      }
      this.store.getState().setSave({ kind: "error", message: messageFor(error) });
      // Network trouble and server errors retry with backoff; a refused request won't fix itself.
      if (!isPermanent(error)) {
        this.failures++;
        this.schedule(Math.min(MAX_BACKOFF_MS, this.delay * 2 ** this.failures));
      }
      return false;
    }
  }

  /** Starts saving with `persist`, watching the store and the page lifecycle; returns the cleanup. */
  attach(persist: (files: ProjectFiles) => Promise<void>): () => void {
    this.persist = persist;
    const unsubscribe = this.store.subscribe((state, previous) => {
      if (
        state.files !== previous.files &&
        state.files !== this.saved &&
        state.save.kind !== "conflict"
      )
        this.schedule();
    });
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.hasUnsaved()) event.preventDefault();
    };
    // Hidden tabs may be discarded by the browser: store changes right away.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void this.flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      // Leaving the editor inside the app (e.g. to the preview) stores the last change first.
      if (this.hasUnsaved()) void this.run();
    };
  }
}

export function useAutosave(
  store: EditorStore,
  persist: (files: ProjectFiles) => Promise<void>,
  delay: number,
): AutosaveController {
  const [controller] = useState(() => new AutosaveController(store, delay));
  useEffect(() => controller.attach(persist), [controller, persist]);
  return controller;
}
