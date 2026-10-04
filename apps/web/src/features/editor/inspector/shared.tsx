"use client";

import { useState } from "react";
import { FileCode2, Pin } from "lucide-react";
import { moveToFile, renameElement, updateElement, type PropertyValue } from "@mogram/core/edit";
import { elementNames, isValidName, type Diagram, type SceneEntry } from "@mogram/core/model";
import type { StatePreset } from "@mogram/core/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PropertyRow } from "@/components/ui/property-row";
import { sceneEntry } from "../actions";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { sceneTarget, storyDiagram } from "../store/editor-store";
import { CommitInput } from "./fields";

/** Writes element properties to the files as one undo step. */
export function useEdit() {
  const store = useEditorStore();
  return {
    set: (
      name: string,
      set: Readonly<Record<string, PropertyValue>>,
      label = "Edit",
      options?: { coalesce?: boolean },
    ) =>
      store
        .getState()
        .edit(label, (files, diagram) => updateElement(files, diagram, { name, set }), options),
    store,
  };
}

export function NameAndFile({
  diagram,
  name,
  file,
}: {
  diagram: Diagram;
  name: string;
  file: string;
}) {
  const store = useEditorStore();
  const [creating, setCreating] = useState(false);
  const otherFiles = diagram.files.filter(
    (path) => path !== file && !path.endsWith("layout.mogram.yaml"),
  );
  const prefix = diagram.folder.length > 0 ? `${diagram.folder}/` : "";
  return (
    <>
      <PropertyRow label="Name" align="start">
        <CommitInput
          label="Name"
          mono
          value={name}
          className="text-right"
          validate={(next) => nameProblem(diagram, name, next.trim())}
          onCommit={(next) =>
            store
              .getState()
              .edit("Rename", (files, d) =>
                renameElement(files, d, { from: name, to: next.trim() }),
              )
          }
        />
      </PropertyRow>
      <PropertyRow label="File">
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 font-mono text-caption text-fg-soft hover:bg-fill-hover"
              title="Move to another file"
            >
              <FileCode2 className="size-3.5 shrink-0 text-fg-muted" />
              <span className="truncate">{file.slice(prefix.length)}</span>
            </button>
          </MenuTrigger>
          <MenuContent align="end" className="w-64">
            {otherFiles.map((path) => (
              <MenuItem
                key={path}
                onSelect={() =>
                  store
                    .getState()
                    .edit("Move to file", (f, d) => moveToFile(f, d, { names: [name], file: path }))
                }
              >
                Move to {path.slice(prefix.length)}
              </MenuItem>
            ))}
            <MenuItem
              description="Creates the file (and splits layout out, FI-10)"
              onSelect={() => setCreating(true)}
            >
              Move to a new file…
            </MenuItem>
          </MenuContent>
        </Menu>
      </PropertyRow>
      {creating ? (
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const input = new FormData(event.currentTarget).get("file");
            const base =
              typeof input === "string" ? input.trim().replace(/\.mogram(\.yaml)?$/i, "") : "";
            setCreating(false);
            if (base.length === 0) return;
            const path = `${prefix}${base}.mogram.yaml`;
            store
              .getState()
              .edit("Move to new file", (f, d) => moveToFile(f, d, { names: [name], file: path }));
          }}
        >
          <input
            name="file"
            autoFocus
            aria-label="New file name"
            placeholder="compute"
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") setCreating(false);
            }}
            className="h-8 min-w-0 flex-1 rounded-md bg-fill-field px-2.5 font-mono text-caption text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis placeholder:text-fg-ghost"
          />
          <span className="text-caption text-fg-muted">.mogram.yaml</span>
          <Button type="submit" size="sm" variant="secondary">
            Move
          </Button>
        </form>
      ) : null}
    </>
  );
}

/** Why `next` can't be this element's name yet, or null if it can. */
export function nameProblem(diagram: Diagram, current: string, next: string): string | null {
  if (!isValidName(next)) return "Names start with a letter and use letters, numbers, _ or -.";
  if (next !== current && elementNames(diagram).has(next)) {
    return `"${next}" is already used by another element.`;
  }
  return null;
}

export function PositionRow({ name }: { name: string }) {
  const pinned = useEditor((s) => s.parsed().diagram.layout.get(name)?.at != null);
  return (
    <PropertyRow label="Position">
      {pinned ? (
        <span className="flex items-center gap-1.5 text-caption text-fg-soft">
          <Pin className="size-3.5" /> Pinned
        </span>
      ) : (
        <Badge tone="neutral" size="sm" title="Placed automatically. Drag it to pin it.">
          Auto
        </Badge>
      )}
    </PropertyRow>
  );
}

/**
 * The scene being edited as this level sees it: scenes belong to the top diagram (NE-14), and
 * name an element inside a nested diagram by its path (`aks.checkout`).
 */
export interface SceneView {
  readonly scene: string | null;
  readonly story: Diagram;
  readonly levelPath: readonly string[];
}

export function useSceneView(): SceneView {
  const { scene, files, levelPath } = useEditorShallow((s) => ({
    scene: s.scene,
    files: s.files,
    levelPath: s.levelPath,
  }));
  const diagram = useEditor((s) => s.parsed().diagram);
  return { scene, story: levelPath.length === 0 ? diagram : storyDiagram(files), levelPath };
}

export function sceneLabel(view: SceneView): string {
  const { scene, story } = view;
  return scene === null ? "Normal" : (story.scenes.find((s) => s.name === scene)?.label ?? scene);
}

/** This element's line in the current scene, if it has one. */
export function sceneValue(view: SceneView, name: string): SceneEntry | undefined {
  if (view.scene === null) return undefined;
  return sceneEntry(view.story, view.scene, sceneTarget(view.levelPath, name));
}

export function effectiveState(view: SceneView, name: string, base: StatePreset): StatePreset {
  return sceneValue(view, name)?.state ?? base;
}

export function opensRelative(folder: string, opens: string): string {
  if (folder.length === 0) return `./${opens}`;
  return opens.startsWith(`${folder}/`) ? `./${opens.slice(folder.length + 1)}` : opens;
}
