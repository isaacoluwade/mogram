"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  ClipboardPaste,
  Copy,
  Grid3x3,
  Group,
  Layers,
  Maximize,
  MousePointer2,
  Pencil,
  Scissors,
  Trash2,
  Activity,
  Waves,
} from "lucide-react";
import {
  FLOW_INFO,
  FLOW_PRESETS,
  MOTION_INFO,
  MOTION_PRESETS,
  STATE_INFO,
  STATE_PRESETS,
} from "@mogram/core/presets";
import { toWorld } from "@/features/canvas/camera";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/menu";
import {
  align,
  canZOrder,
  copySelection,
  cutSelection,
  deleteSelection,
  distribute,
  duplicateSelection,
  groupSelection,
  paste,
  setFlow,
  setMotion,
  setState,
  zOrder,
  zoomToFit,
} from "../actions";
import { openNested } from "../levels";
import { useEditorStore } from "../editor-context";
import { shortcutLabel } from "../shortcuts";
import { hitAt } from "./hit";

interface Aim {
  readonly name: string | null;
  readonly point: { x: number; y: number };
}

/** Right-click menu for the canvas; acts on what was clicked (selecting it first). */
export function CanvasContextMenu({ children }: { children: ReactNode }) {
  const store = useEditorStore();
  const point = useRef<{ x: number; y: number } | null>(null);
  /** Where a touch long-press began: Radix opens the menu from its own timer, not `contextmenu`. */
  const pressed = useRef<Aim | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const locate = (event: MouseEvent<HTMLElement>): Aim => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      name: hitAt(event.target, event.clientX, event.clientY)?.name ?? null,
      point: toWorld(store.getState().camera, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }),
    };
  };
  /** Points the menu at what was pressed, selecting it first. */
  const aim = ({ name, point: at }: Aim) => {
    point.current = at;
    const { selection, select } = store.getState();
    if (name !== null && !selection.includes(name)) select([name]);
    if (name === null) select([]);
    setTarget(name);
  };

  const state = store.getState();
  const diagram = state.diagram();
  const selection = state.selection;
  const components = selection.filter((n) => diagram.components.has(n));
  const placeables = selection.filter(
    (n) => diagram.components.has(n) || diagram.containers.has(n),
  );
  const connections = selection.filter((n) => diagram.connections.has(n));
  // Components, containers, zones and text stack; connections and groups don't.
  const stackable = selection.some(
    (n) => diagram.components.has(n) || diagram.containers.has(n) || diagram.decorations.has(n),
  );
  const opens = target !== null ? diagram.components.get(target)?.opens : null;

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open && pressed.current !== null) aim(pressed.current);
        pressed.current = null;
        if (!open) setTarget(null);
      }}
    >
      <ContextMenuTrigger
        asChild
        onPointerDown={(event) => {
          pressed.current = event.pointerType === "mouse" ? null : locate(event);
        }}
        onContextMenu={(event) => {
          pressed.current = null;
          aim(locate(event));
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        {target === null ? (
          <>
            <ContextMenuItem
              icon={<ClipboardPaste />}
              shortcut={shortcutLabel("mod+v")}
              onSelect={() => void paste(store, point.current)}
            >
              Paste
            </ContextMenuItem>
            <ContextMenuItem
              icon={<MousePointer2 />}
              shortcut={shortcutLabel("mod+a")}
              onSelect={() => {
                const d = store.getState().diagram();
                store
                  .getState()
                  .select([
                    ...d.containers.keys(),
                    ...d.components.keys(),
                    ...d.decorations.keys(),
                  ]);
              }}
            >
              Select all
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem icon={<Maximize />} shortcut="⇧1" onSelect={() => zoomToFit(store)}>
              Zoom to fit
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Grid3x3 />}
              shortcut={shortcutLabel("mod+'")}
              onSelect={() => store.getState().toggleGrid()}
            >
              {store.getState().showGrid ? "Hide grid" : "Show grid"}
            </ContextMenuItem>
          </>
        ) : (
          <>
            {opens != null ? (
              <>
                <ContextMenuItem
                  icon={<Layers />}
                  shortcut="↵"
                  onSelect={() => openNested(store, target)}
                >
                  Open nested diagram
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            ) : null}
            <ContextMenuItem
              icon={<Pencil />}
              onSelect={() => store.getState().setEditingLabel(target)}
            >
              Rename label
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Scissors />}
              shortcut={shortcutLabel("mod+x")}
              onSelect={() => void cutSelection(store)}
            >
              Cut
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Clipboard />}
              shortcut={shortcutLabel("mod+c")}
              onSelect={() => void copySelection(store)}
            >
              Copy
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Copy />}
              shortcut={shortcutLabel("mod+d")}
              onSelect={() => duplicateSelection(store)}
            >
              Duplicate
            </ContextMenuItem>
            <ContextMenuSeparator />
            {placeables.length > 0 ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger icon={<Activity />}>
                  State{state.scene === null ? "" : " in scene"}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                  {STATE_PRESETS.map((preset) => (
                    <ContextMenuItem
                      key={preset}
                      description={STATE_INFO[preset].description}
                      onSelect={() => setState(store, placeables, preset)}
                    >
                      {STATE_INFO[preset].label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            {components.length > 0 ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger icon={<Waves />}>Motion</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                  {MOTION_PRESETS.map((preset) => (
                    <ContextMenuItem
                      key={preset}
                      description={MOTION_INFO[preset].description}
                      onSelect={() => setMotion(store, components, preset)}
                    >
                      {MOTION_INFO[preset].label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            {connections.length > 0 ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger icon={<Waves />}>
                  Flow{state.scene === null ? "" : " in scene"}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                  {FLOW_PRESETS.map((preset) => (
                    <ContextMenuItem
                      key={preset}
                      description={FLOW_INFO[preset].description}
                      onSelect={() => setFlow(store, connections, preset)}
                    >
                      {FLOW_INFO[preset].label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            {stackable || selection.length > 1 ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger icon={<BringToFront />}>Arrange</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                  {stackable ? (
                    <>
                      <ContextMenuItem
                        icon={<ChevronsUp />}
                        shortcut={shortcutLabel("mod+alt+]")}
                        disabled={!canZOrder(store, "front")}
                        onSelect={() => zOrder(store, "front")}
                      >
                        Bring to front
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<ArrowUpToLine />}
                        shortcut={shortcutLabel("mod+]")}
                        disabled={!canZOrder(store, "forward")}
                        onSelect={() => zOrder(store, "forward")}
                      >
                        Bring forward
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<ArrowDownToLine />}
                        shortcut={shortcutLabel("mod+[")}
                        disabled={!canZOrder(store, "backward")}
                        onSelect={() => zOrder(store, "backward")}
                      >
                        Send backward
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<ChevronsDown />}
                        shortcut={shortcutLabel("mod+alt+[")}
                        disabled={!canZOrder(store, "back")}
                        onSelect={() => zOrder(store, "back")}
                      >
                        Send to back
                      </ContextMenuItem>
                    </>
                  ) : null}
                  {selection.length > 1 ? (
                    <>
                      {stackable ? <ContextMenuSeparator /> : null}
                      <ContextMenuItem
                        icon={<AlignStartVertical />}
                        onSelect={() => align(store, "left")}
                      >
                        Align left
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<AlignCenterHorizontal />}
                        onSelect={() => align(store, "center")}
                      >
                        Align centres
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<AlignCenterVertical />}
                        onSelect={() => align(store, "middle")}
                      >
                        Align middles
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<AlignEndVertical />}
                        onSelect={() => align(store, "right")}
                      >
                        Align right
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<AlignStartHorizontal />}
                        onSelect={() => align(store, "top")}
                      >
                        Align top
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<AlignEndHorizontal />}
                        onSelect={() => align(store, "bottom")}
                      >
                        Align bottom
                      </ContextMenuItem>
                      {selection.length > 2 ? (
                        <>
                          <ContextMenuItem
                            icon={<AlignHorizontalJustifyCenter />}
                            onSelect={() => distribute(store, "horizontal")}
                          >
                            Distribute horizontally
                          </ContextMenuItem>
                          <ContextMenuItem
                            icon={<AlignVerticalJustifyCenter />}
                            onSelect={() => distribute(store, "vertical")}
                          >
                            Distribute vertically
                          </ContextMenuItem>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            {placeables.length > 0 ? (
              <ContextMenuItem
                icon={<Group />}
                shortcut={shortcutLabel("mod+g")}
                onSelect={() => groupSelection(store)}
              >
                Group
              </ContextMenuItem>
            ) : null}
            <ContextMenuSeparator />
            <ContextMenuItem
              icon={<Trash2 />}
              tone="danger"
              shortcut="⌫"
              onSelect={() => deleteSelection(store)}
            >
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
