"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Clock } from "@/features/canvas/clock";
import {
  createEditorStore,
  type EditorActions,
  type EditorInit,
  type EditorState,
  type EditorStore,
} from "./store/editor-store";

interface EditorContextValue {
  readonly store: EditorStore;
  readonly clock: Clock;
}

const EditorContext = createContext<EditorContextValue | null>(null);

/** Creates the store and the shared animation clock for one editor instance. */
export function EditorProvider({ init, children }: { init: EditorInit; children: ReactNode }) {
  const [value] = useState<EditorContextValue>(() => ({
    store: createEditorStore(init),
    clock: new Clock(),
  }));
  useEffect(() => () => value.clock.dispose(), [value]);
  return <EditorContext value={value}>{children}</EditorContext>;
}

function useEditorContext(): EditorContextValue {
  const value = use(EditorContext);
  if (value === null) throw new Error("Editor components must be inside <EditorProvider>.");
  return value;
}

export function useEditorStore(): EditorStore {
  return useEditorContext().store;
}

export function useEditorClock(): Clock {
  return useEditorContext().clock;
}

type Full = EditorState & EditorActions;

/** Subscribes to one slice of editor state. */
export function useEditor<T>(selector: (state: Full) => T): T {
  return useStore(useEditorStore(), selector);
}

/** Subscribes to several values at once with shallow comparison. */
export function useEditorShallow<T extends object>(selector: (state: Full) => T): T {
  return useStore(useEditorStore(), useShallow(selector));
}
