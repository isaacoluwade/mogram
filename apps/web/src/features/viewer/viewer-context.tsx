"use client";

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
  children,
}: {
  files: ProjectFiles;
  present: boolean;
  children: ReactNode;
}) {
  const [value] = useState<ViewerContextValue>(() => {
    const store = createViewerStore(files, present);
    const clock = new Clock();
    return { store, clock, controller: new ViewerController(store, clock) };
  });
  useEffect(
    () => () => {
      value.controller.animator.cancel();
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
