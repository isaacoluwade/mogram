"use client";

import { createContext, use, useCallback, type ReactNode } from "react";
import type { Point } from "@mogram/core/layout";
import { useEditorStore } from "../editor-context";
import type { EditorStore } from "../store/editor-store";
import type { KeyInput } from "./keys";
import { selectionInfo } from "./selection";
import type { CommandContext, CommandHost } from "./types";

const HostContext = createContext<CommandHost | null>(null);

/** The shell supplies what only it can do (save, scenes, the viewer) to every command. */
export function CommandHostProvider({
  host,
  children,
}: {
  host: CommandHost;
  children: ReactNode;
}) {
  return <HostContext value={host}>{children}</HostContext>;
}

/** A host that does nothing, for surfaces rendered outside the shell (tests, stories). */
const NO_HOST: CommandHost = {
  save: () => undefined,
  nextScene: () => undefined,
  goToScene: () => undefined,
  togglePlay: () => undefined,
  preview: () => undefined,
  present: () => undefined,
  download: () => undefined,
};

export function useCommandHost(): CommandHost {
  return use(HostContext) ?? NO_HOST;
}

export function commandContext(
  store: EditorStore,
  host: CommandHost,
  pointer: Point | null = null,
  event?: KeyInput,
): CommandContext {
  const state = store.getState();
  const diagram = state.diagram();
  return {
    store,
    host,
    diagram,
    sel: selectionInfo(diagram, state.selection),
    pointer,
    ...(event === undefined ? {} : { event }),
  };
}

/** Builds a command context from the editor as it is now (call it when a menu opens). */
export function useCommandContext(): (pointer?: Point | null) => CommandContext {
  const store = useEditorStore();
  const host = useCommandHost();
  return useCallback(
    (pointer: Point | null = null) => commandContext(store, host, pointer),
    [store, host],
  );
}
