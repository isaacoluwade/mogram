"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Copy,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  addScene,
  deleteScene,
  renameScene,
  reorderScenes,
  type EditResult,
} from "@mogram/core/edit";
import type { LayoutResult } from "@mogram/core/layout";
import { isValidName, toName, type Diagram, type ProjectFiles } from "@mogram/core/model";
import type { Moment } from "@mogram/core/picture";
import type { RoutedPath } from "@mogram/core/routing";
import { SCENE_HOLD, stepScene } from "@mogram/core/timeline";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { useScrollFade } from "@/lib/use-scroll-fade";
import { buildScene } from "@/features/canvas/scene";
import { useFontsVersion } from "@/features/canvas/text";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import type { CanvasTheme } from "@/features/canvas/theme";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "../editor-context";
import { dockOf, scenesOffered, shownFiles, topDiagram } from "../store/editor-store";
import { resolveLevel } from "../use-editor-scene";
import { StoryStrip } from "./story-strip";

const THUMB = { width: 112, height: 64 } as const;

interface ThumbProps {
  readonly files: ProjectFiles;
  readonly folder: string;
  readonly diagram: Diagram;
  readonly layout: LayoutResult;
  readonly routes: ReadonlyMap<string, RoutedPath>;
  readonly theme: CanvasTheme;
  /** The scene, or the moment of a story, it shows. */
  readonly scene: Moment | string | null;
  readonly levelPath: readonly string[];
}

/** A still, miniature render of the level being edited in one scene, or at a moment of a story. */
export const SceneThumb = memo(function SceneThumb({
  files,
  folder,
  diagram,
  layout,
  routes,
  theme,
  scene,
  levelPath,
}: ThumbProps) {
  const fonts = useFontsVersion();
  const root = useEditor((s) => s.root);
  const model = useMemo(() => {
    const current = resolveLevel(files, levelPath, folder, diagram, scene, [], root);
    return buildScene({
      diagram,
      files,
      layout,
      routes,
      current,
      theme,
      fontFamily: "Inter",
      fontsVersion: fonts,
    });
  }, [files, folder, root, diagram, layout, routes, theme, scene, levelPath, fonts]);
  const pad = 24;
  const bounds = layout.bounds.w === 0 ? { x: 0, y: 0, w: 320, h: 180 } : layout.bounds;
  const ratio = THUMB.width / THUMB.height;
  let frame = {
    x: bounds.x - pad,
    y: bounds.y - pad,
    w: bounds.w + pad * 2,
    h: bounds.h + pad * 2,
  };
  if (frame.w / frame.h > ratio) {
    const h = frame.w / ratio;
    frame = { ...frame, y: frame.y - (h - frame.h) / 2, h };
  } else {
    const w = frame.h * ratio;
    frame = { ...frame, x: frame.x - (w - frame.w) / 2, w };
  }
  return (
    <div aria-hidden className="pointer-events-none size-full [&>svg]:size-full">
      <DiagramSvg
        scene={model}
        time={{ kind: "static", t: 0 }}
        mode="view"
        fontFamily="var(--font-sans)"
        frame={frame}
      />
    </div>
  );
});

/** Play runs through the scenes in order (SC-9), looping, each held for one full motion loop. */
function usePlayback(scenes: readonly string[]) {
  const store = useEditorStore();
  const clock = useEditorClock();
  const playing = useEditorShallow((s) => ({ playing: s.playing })).playing;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const state = store.getState();
      state.setScene(stepScene(scenes, state.scene, 1), clock.time());
    }, SCENE_HOLD * 1000);
    return () => window.clearInterval(timer);
  }, [playing, scenes, store, clock]);
}

export interface SceneStripProps {
  readonly layout: LayoutResult;
  readonly routes: ReadonlyMap<string, RoutedPath>;
  readonly theme: CanvasTheme;
}

/**
 * What the dock under the canvas lists (D-86): the scenes, each a state of the whole diagram to
 * switch to, or a story, which plays step by step with words.
 */
export function DockSwitch() {
  const store = useEditorStore();
  const clock = useEditorClock();
  const dock = useEditor(dockOf);
  const offered = useEditor(scenesOffered);
  // On a slide with no scenes there's only the story: nothing to switch between (D-109).
  if (!offered) return null;
  return (
    <SegmentedControl
      label="Scenes or story"
      size="sm"
      value={dock}
      onChange={(value) => {
        const state = store.getState();
        state.setPlaying(false);
        state.setDock(value);
        // Each has its own picture: leaving one for the other goes back to the diagram itself.
        if (value === "scenes") state.setStory(null, clock.time());
        else state.setScene(null, clock.time());
      }}
      options={[
        { value: "scenes", label: "Scenes" },
        { value: "story", label: "Story" },
      ]}
    />
  );
}

/** The dock: the scene strip or the story strip, whichever is picked. */
export function Dock(props: SceneStripProps) {
  const dock = useEditor(dockOf);
  return dock === "story" ? <StoryStrip {...props} /> : <SceneStrip {...props} />;
}

/** Scenes as a strip of thumbnails, like pages in Canva (SC-6). */
export function SceneStrip({ layout, routes, theme }: SceneStripProps) {
  const store = useEditorStore();
  const clock = useEditorClock();
  const { files, root, folder, scene, playing, levelPath } = useEditorShallow((s) => ({
    files: shownFiles(s),
    root: s.root,
    folder: s.folder,
    scene: s.scene,
    playing: s.playing,
    levelPath: s.levelPath,
  }));
  const diagram = useEditor((s) => s.parsed().diagram);
  // Scenes belong to the top diagram (NE-14): inside a nested level they are still its scenes,
  // shown as they reach this level, and changing them changes the top diagram's scenes.
  const nested = levelPath.length > 0;
  const story = nested ? topDiagram(files, root) : diagram;
  const storyOf = (f: ProjectFiles, d: Diagram): Diagram => (nested ? topDiagram(f, root) : d);
  // Stable between renders, so scene playback's timer isn't restarted by unrelated updates.
  const names = useMemo(() => story.scenes.map((s) => s.name), [story.scenes]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  usePlayback(names);
  const strip = useScrollFade<HTMLDivElement>();

  const select = (name: string | null) => store.getState().setScene(name, clock.time());
  const thumbProps = { files, folder, diagram, layout, routes, theme, levelPath };

  /** Runs a scene command and shows the scene it made, by the name it was given. */
  const create = (label: string, run: (f: ProjectFiles, d: Diagram) => EditResult) => {
    let created: string | undefined;
    const ok = store.getState().edit(label, (f, d) => {
      const result = run(f, storyOf(f, d));
      created = result.named;
      return result;
    });
    if (ok && created !== undefined) select(created);
  };
  const add = () => {
    let n = names.length + 1;
    while (names.includes(toName(`Scene ${n}`, "scene"))) n++;
    create("Add scene", (f, d) => addScene(f, d, { label: `Scene ${n}` }));
  };
  const move = (name: string, by: -1 | 1) => {
    const index = names.indexOf(name);
    const target = index + by;
    if (target < 0 || target >= names.length) return;
    const order = [...names];
    order.splice(index, 1);
    order.splice(target, 0, name);
    store.getState().edit("Reorder scenes", (f, d) => reorderScenes(f, storyOf(f, d), order));
  };

  return (
    <Panel
      className="flex min-w-0 max-w-full items-center gap-1 p-1.5 lg:max-w-[920px]"
      role="region"
      aria-label="Scenes"
      title={
        nested ? `Scenes of ${story.settings.name}: they reach inside nested diagrams` : undefined
      }
    >
      <DockSwitch />
      <IconButton
        label={playing ? "Pause scenes" : "Play scenes"}
        shortcut="P"
        shape="round"
        active={playing}
        onClick={() => store.getState().setPlaying(!playing)}
        disabled={names.length === 0}
      >
        {playing ? <Pause /> : <Play />}
      </IconButton>
      <ToolbarDivider />
      {nested ? (
        <span className="max-w-24 shrink-0 px-1 text-micro leading-tight text-fg-muted">
          Scenes of
          <br />
          <span className="font-medium text-fg-soft">{story.settings.name}</span>
        </span>
      ) : null}
      <div
        ref={strip}
        className="scroll-fade scrollbar-none flex min-w-0 items-end gap-1.5 overflow-x-auto px-0.5 py-0.5"
      >
        <SceneButton label="Normal" selected={scene === null} onSelect={() => select(null)}>
          <SceneThumb {...thumbProps} scene={null} />
        </SceneButton>
        {story.scenes.map((item) => (
          <div
            key={item.name}
            draggable
            onDragStart={(event) => {
              setDragging(item.name);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/x-mogram-scene", item.name);
            }}
            onDragEnd={() => setDragging(null)}
            onDragOver={(event) => {
              if (dragging !== null && dragging !== item.name) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging === null || dragging === item.name) return;
              const order = names.filter((n) => n !== dragging);
              order.splice(order.indexOf(item.name), 0, dragging);
              store
                .getState()
                .edit("Reorder scenes", (f, d) => reorderScenes(f, storyOf(f, d), order));
              setDragging(null);
            }}
            className={cn("group relative", dragging === item.name && "opacity-40")}
          >
            <SceneButton
              label={item.label}
              selected={scene === item.name}
              onSelect={() => select(item.name)}
              renaming={renaming === item.name}
              onRename={(label) => {
                setRenaming(null);
                const next = toName(label, "scene");
                if (next === item.name || !isValidName(next)) return;
                const ok = store
                  .getState()
                  .edit("Rename scene", (f, d) =>
                    renameScene(f, storyOf(f, d), { from: item.name, to: next }),
                  );
                if (ok && scene === item.name) select(next);
              }}
              onStartRename={() => setRenaming(item.name)}
            >
              <SceneThumb {...thumbProps} scene={item.name} />
            </SceneButton>
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${item.label} options`}
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-overlay text-fg-soft opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </MenuTrigger>
              <MenuContent side="top" align="start" className="w-48">
                <MenuItem icon={<Pencil />} onSelect={() => setRenaming(item.name)}>
                  Rename
                </MenuItem>
                <MenuItem
                  icon={<Copy />}
                  onSelect={() =>
                    create("Duplicate scene", (f, d) =>
                      addScene(f, d, { label: `${item.label} copy`, copyFrom: item.name }),
                    )
                  }
                >
                  Duplicate
                </MenuItem>
                <MenuItem
                  icon={<ArrowLeft />}
                  disabled={names.indexOf(item.name) === 0}
                  onSelect={() => move(item.name, -1)}
                >
                  Move left
                </MenuItem>
                <MenuItem
                  icon={<ArrowRight />}
                  disabled={names.indexOf(item.name) === names.length - 1}
                  onSelect={() => move(item.name, 1)}
                >
                  Move right
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 />}
                  tone="danger"
                  onSelect={() => {
                    if (scene === item.name) select(null);
                    store
                      .getState()
                      .edit("Delete scene", (f, d) => deleteScene(f, storyOf(f, d), item.name));
                  }}
                >
                  Delete scene
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          aria-label="Add scene"
          className="mb-[22px] flex h-16 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-fg-ghost transition-colors hover:border-border-emphasis hover:text-fg-soft"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </Panel>
  );
}

function SceneButton({
  label,
  selected,
  onSelect,
  renaming = false,
  onRename,
  onStartRename,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  renaming?: boolean;
  onRename?: (label: string) => void;
  onStartRename?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Scene: ${label}`}
        onClick={onSelect}
        onDoubleClick={onStartRename}
        className={cn(
          "h-16 w-28 overflow-hidden rounded-md border transition-colors",
          selected
            ? "border-border-emphasis ring-1 ring-border-emphasis"
            : "border-border hover:border-border-strong",
        )}
      >
        {children}
      </button>
      {renaming ? (
        <SceneNameInput label={label} onDone={(value) => onRename?.(value)} />
      ) : (
        <span
          className={cn(
            "h-[18px] max-w-28 truncate text-micro",
            selected ? "font-medium text-fg" : "text-fg-muted",
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function SceneNameInput({ label, onDone }: { label: string; onDone: (value: string) => void }) {
  const [value, setValue] = useState(label);
  return (
    <input
      autoFocus
      aria-label="Scene name"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") onDone(value);
        if (event.key === "Escape") onDone(label);
      }}
      className="h-[18px] w-28 rounded-sm bg-fill-field px-1 text-center text-micro text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
    />
  );
}
