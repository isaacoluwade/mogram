"use client";

import type { ViewerDeck } from "@/features/deck/viewer-deck";
import { VoicePlayer } from "@/features/assets/voice-player";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { ProjectFiles } from "@mogram/core/model";
import { Clock } from "@/features/canvas/clock";
import { ViewerController } from "./controller";
import {
  createViewerStore,
  type ViewerActions,
  type ViewerState,
  type ViewerStore,
} from "./viewer-store";

interface ViewerContextValue {
  readonly store: ViewerStore;
  readonly controller: ViewerController;
  readonly clock: Clock;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({
  files,
  present,
  root = "",
  record = false,
  deck = null,
  children,
}: {
  files: ProjectFiles;
  present: boolean;
  root?: string;
  /** Starts in Record mode (D-99). */
  record?: boolean;
  /** The deck this diagram is a slide of, when it is one (D-99). */
  deck?: ViewerDeck | null;
  children: ReactNode;
}) {
  const [value] = useState<ViewerContextValue>(() => {
    const store = createViewerStore(files, present, root, record);
    const clock = new Clock();
    const controller = new ViewerController(store, clock, deck);
    // A deck or story playing by itself plays each beat's recording (D-105).
    if (typeof window !== "undefined") controller.sound = new VoicePlayer();
    return { store, clock, controller };
  });
  useEffect(
    () => () => {
      // Nothing this viewer started may outlive it: not a camera move, not a story's next beat.
      value.controller.dispose();
      value.clock.dispose();
    },
    [value],
  );
  return <ViewerContext value={value}>{children}</ViewerContext>;
}

function useViewerContext(): ViewerContextValue {
  const value = use(ViewerContext);
  if (value === null) throw new Error("Viewer components must be inside <ViewerProvider>.");
  return value;
}

export const useViewerStore = (): ViewerStore => useViewerContext().store;
export const useViewerController = (): ViewerController => useViewerContext().controller;
export const useViewerClock = (): Clock => useViewerContext().clock;

type Full = ViewerState & ViewerActions;

export function useViewer<T>(selector: (state: Full) => T): T {
  return useStore(useViewerStore(), selector);
}

export function useViewerShallow<T extends object>(selector: (state: Full) => T): T {
  return useStore(useViewerStore(), useShallow(selector));
}
