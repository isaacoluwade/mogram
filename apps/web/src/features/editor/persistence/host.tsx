"use client";

import { createContext, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Checkpoint } from "@/lib/history/rules";
import type { HistorySource } from "@/features/history/source";
import { NARROW_WIDTH } from "../store/editor-store";

/**
 * Where the diagram lives and what the chrome can do with it. Local drafts (no account, AC-1) and
 * cloud diagrams (AC-3) provide different implementations; the editor UI doesn't care which.
 */
export interface EditorHost {
  readonly kind: "local" | "cloud";
  readonly id: string;
  readonly signedIn: boolean;
  /** The read-only viewer for this diagram (present / preview). */
  readonly viewerHref: string;
  /** Stores what is on screen now; false when it could not be stored (the reason is shown). */
  saveNow(): Promise<boolean>;
  /** Stores what is on screen now as its own version (an assistant turn, a named version). */
  checkpoint(checkpoint: Checkpoint): Promise<boolean>;
  /** This diagram's versions. */
  readonly history: HistorySource;
  /** Cloud: resolve a save conflict by loading the newer version or overwriting it. */
  resolveConflict?(choice: "reload" | "overwrite"): Promise<void>;
  /** Cloud: load the latest saved version from the server (after restoring a revision). */
  reload?(): Promise<void>;
  /** Local: upload the draft to the cloud (requires sign-in). */
  saveToCloud?(): Promise<void>;
  /** Cloud: current share settings, for the share dialog. */
  readonly share?: {
    readonly visibility: "private" | "link";
    readonly shareId: string | null;
    readonly allowViewerState: boolean;
  };
  updateShare?(input: {
    visibility: "private" | "link";
    allowViewerState: boolean;
    regenerateLink?: boolean;
  }): Promise<void>;
}

export const EditorHostContext = createContext<EditorHost | null>(null);

export function useEditorHost(): EditorHost {
  const host = use(EditorHostContext);
  if (host === null) throw new Error("Editor chrome must be inside an EditorHostContext.");
  return host;
}

/**
 * Opens the viewer (present, play a tour) only after the latest edit is stored: the cloud
 * viewer reads the saved version, so navigating first would show a stale diagram.
 */
export function useOpenViewer(): (query: string) => Promise<void> {
  const host = useEditorHost();
  const router = useRouter();
  return useCallback(
    async (query: string) => {
      if (await host.saveNow())
        router.push(`${host.viewerHref}${query}` as Parameters<typeof router.push>[0]);
    },
    [host, router],
  );
}

/**
 * Phones start with the canvas clear (panels open as bottom sheets on demand); tablets and small
 * laptops start with the library only, so the canvas keeps most of the screen.
 */
export function initialPanels(): { library: boolean; inspector: boolean } {
  if (typeof window === "undefined") return { library: true, inspector: true };
  if (window.matchMedia("(max-width: 767px)").matches) return { library: false, inspector: false };
  if (window.innerWidth < NARROW_WIDTH) return { library: true, inspector: false };
  return { library: true, inspector: true };
}
