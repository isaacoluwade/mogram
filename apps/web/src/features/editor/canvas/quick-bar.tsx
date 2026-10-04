"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Ellipsis,
  Activity,
  Layers,
  PanelRight,
  Pencil,
  Trash2,
  Waves,
} from "lucide-react";
import type { Box, LayoutResult } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import {
  FLOW_INFO,
  FLOW_PRESETS,
  MOTION_INFO,
  MOTION_PRESETS,
  STATE_INFO,
  STATE_PRESETS,
  TONE_NAMES,
  TONES,
  solid,
  type FlowPreset,
  type StatePreset,
} from "@mogram/core/presets";
import type { RoutedPath } from "@mogram/core/routing";
import { ColorPicker } from "@/components/ui/color/color-picker";
import { SwatchFace } from "@/components/ui/color/swatch";
import { IconButton } from "@/components/ui/icon-button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { toScreen } from "@/features/canvas/camera";
import type { CanvasTheme } from "@/features/canvas/theme";
import { cn } from "@/lib/cn";
import { NEUTRAL_SWATCH } from "@/styles/colors";
import {
  deleteSelection,
  duplicateSelection,
  setFlow,
  setMotion,
  setState,
  zOrder,
} from "../actions";
import { openNested } from "../levels";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { documentColors } from "../inspector/document-colors";
import { effectiveState, sceneValue, useEdit, useSceneView } from "../inspector/shared";
import { shortcutLabel } from "../shortcuts";
import {
  AlignMenu,
  EmphasisButtons,
  FontMenu,
  FontSizeMenu,
  ListButton,
  MenuButton,
  NoteFillFace,
  NoteFillPicker,
  TextColorFace,
  TextColorPicker,
  isRich,
  textInk,
  type RichDecoration,
} from "../text-look-controls";

/** Space between the bar and what it edits. */
const GAP = 12;
/** Space kept between the bar and the canvas edge. */
const EDGE = 8;

/**
 * The quick-edit bar (ED-26): floats over the selection with the edits that suit it — colour,
 * font and size for notes and text, state and motion for components, flow for connections —
 * so the common changes never need the inspector. It hides while something is being dragged.
 */
export function QuickBar({
  layout,
  routes,
  theme,
}: {
  layout: LayoutResult;
  routes: ReadonlyMap<string, RoutedPath>;
  theme: CanvasTheme;
}) {
  const view = useEditorShallow((s) => ({
    selection: s.selection,
    camera: s.camera,
    viewport: s.viewport,
    busy:
      s.drag !== null ||
      s.resize !== null ||
      s.marquee !== null ||
      s.connect !== null ||
      s.bend !== null,
    tool: s.tool,
    editingLabel: s.editingLabel,
    zooming: s.levelZoom !== null,
  }));
  const diagram = useEditor((s) => s.parsed().diagram);
  // The bar's own size, to keep it on screen; it changes with what the selection offers.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const bar = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    const measure = () => {
      setSize((last) =>
        last.w === node.offsetWidth && last.h === node.offsetHeight
          ? last
          : { w: node.offsetWidth, h: node.offsetHeight },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const editingPlain =
    view.editingLabel !== null && !isRich(diagram.decorations.get(view.editingLabel));
  const bounds = selectionBounds(view.selection, layout, routes);
  if (
    bounds === null ||
    view.busy ||
    view.zooming ||
    view.tool !== "select" ||
    editingPlain ||
    view.viewport.width === 0
  )
    return null;

  const top = toScreen(view.camera, { x: bounds.x + bounds.w / 2, y: bounds.y });
  const bottom = toScreen(view.camera, { x: 0, y: bounds.y + bounds.h }).y;
  const height = size.h || 44;
  const width = size.w || 320;
  // Above the selection when there's room, otherwise below it.
  const y = top.y - GAP - height >= EDGE ? top.y - GAP - height : bottom + GAP;
  const x = Math.min(
    Math.max(EDGE, top.x - width / 2),
    Math.max(EDGE, view.viewport.width - width - EDGE),
  );

  return (
    <Panel
      ref={bar}
      role="toolbar"
      aria-label="Quick edit"
      className="absolute z-20 flex items-center gap-0.5 p-1 shadow-popover animate-pop-in"
      style={{ left: x, top: Math.min(y, view.viewport.height - height - EDGE) }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <BarContent names={view.selection} diagram={diagram} theme={theme} />
    </Panel>
  );
}

/** The selection's world bounds: element boxes, tiles, group outlines and connection paths. */
function selectionBounds(
  names: readonly string[],
  layout: LayoutResult,
  routes: ReadonlyMap<string, RoutedPath>,
): Box | null {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  const add = (box: Box) => {
    x1 = Math.min(x1, box.x);
    y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.w);
    y2 = Math.max(y2, box.y + box.h);
  };
  for (const name of names) {
    const element = layout.elements.get(name);
    const box =
      element?.kind === "component"
        ? (layout.tiles.get(name) ?? element.box)
        : (element?.box ?? layout.groups.get(name));
    if (box !== undefined) {
      add(box);
      continue;
    }
    const route = routes.get(name);
    if (route !== undefined)
      for (const point of route.points) add({ x: point.x, y: point.y, w: 0, h: 0 });
  }
  return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function BarContent({
  names,
  diagram,
  theme,
}: {
  names: readonly string[];
  diagram: Diagram;
  theme: CanvasTheme;
}) {
  const single = names.length === 1 ? names[0] : undefined;
  if (single !== undefined) {
    const decoration = diagram.decorations.get(single);
    if (isRich(decoration)) return <TextBar decoration={decoration} theme={theme} />;
    if (decoration !== undefined) return <ToneBar name={single} tone={decoration.tone} />;
  }
  const components = names.filter((name) => diagram.components.has(name));
  const placeables = names.filter(
    (name) => diagram.components.has(name) || diagram.containers.has(name),
  );
  const connections = names.filter((name) => diagram.connections.has(name));
  const opens = single !== undefined ? diagram.components.get(single)?.opens : null;
  return (
    <>
      {placeables.length > 0 ? <StateMenu names={placeables} diagram={diagram} /> : null}
      {components.length > 0 ? <MotionMenu names={components} diagram={diagram} /> : null}
      {connections.length > 0 ? <FlowMenu names={connections} diagram={diagram} /> : null}
      {single !== undefined && (placeables.length > 0 || connections.length > 0) ? (
        <ElementColor name={single} diagram={diagram} />
      ) : null}
      {opens != null && single !== undefined ? <OpenNestedButton name={single} /> : null}
      {placeables.length + connections.length > 0 ? <ToolbarDivider /> : null}
      <MoreMenu single={single} />
    </>
  );
}

function TextBar({ decoration, theme }: { decoration: RichDecoration; theme: CanvasTheme }) {
  const { set } = useEdit();
  return (
    <>
      {decoration.variant === "note" ? (
        <NoteFillPicker decoration={decoration}>
          <BarButton label="Note colour">
            <NoteFillFace fill={decoration.fill} />
          </BarButton>
        </NoteFillPicker>
      ) : (
        <Menu>
          <MenuButton label="Text style">{STYLE_LABELS[decoration.style]}</MenuButton>
          <MenuContent align="start" className="w-40">
            <MenuRadioGroup
              value={decoration.style}
              onValueChange={(style) => set(decoration.name, { style }, "Change text style")}
            >
              {(["title", "heading", "body", "caption"] as const).map((style) => (
                <MenuRadioItem key={style} value={style}>
                  {STYLE_LABELS[style]}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
      )}
      <ToolbarDivider />
      <FontMenu decoration={decoration} />
      <FontSizeMenu decoration={decoration} />
      <ToolbarDivider />
      <EmphasisButtons decoration={decoration} />
      <AlignMenu decoration={decoration} />
      <ListButton decoration={decoration} />
      <TextColorPicker decoration={decoration}>
        <BarButton label="Text colour">
          <TextColorFace color={textInk(decoration, theme.text)} />
        </BarButton>
      </TextColorPicker>
      <ToolbarDivider />
      <MoreMenu single={decoration.name} />
    </>
  );
}

const STYLE_LABELS = {
  title: "Title",
  heading: "Heading",
  body: "Body",
  caption: "Caption",
} as const;

/** A plain bar button that can be a popover trigger (forwards its props). */
function BarButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-fill-hover focus-visible:ring-1 focus-visible:ring-border-emphasis data-[state=open]:bg-fill-active"
      {...props}
    >
      {children}
    </button>
  );
}

function ToneBar({ name, tone }: { name: string; tone: string }) {
  const { set } = useEdit();
  return (
    <>
      <div role="radiogroup" aria-label="Tone" className="flex items-center gap-1 px-1">
        {TONE_NAMES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={tone === option}
            aria-label={option}
            title={option}
            onClick={() => set(name, { tone: option }, "Change tone")}
            className={cn(
              "size-6 rounded-full border-2 transition-transform hover:scale-110",
              tone === option ? "border-fg" : "border-transparent",
            )}
            style={{ background: TONES[option].dark.solid }}
          />
        ))}
      </div>
      <ToolbarDivider />
      <MoreMenu single={name} />
    </>
  );
}

function StateMenu({ names, diagram }: { names: readonly string[]; diagram: Diagram }) {
  const store = useEditorStore();
  const view = useSceneView();
  const scene = view.scene;
  const states = new Set(
    names.map((name) => {
      const base =
        diagram.components.get(name)?.state ?? diagram.containers.get(name)?.state ?? "healthy";
      return effectiveState(view, name, base);
    }),
  );
  const current = states.size === 1 ? [...states][0] : undefined;
  return (
    <Menu>
      <MenuButton label={scene === null ? "State" : "State in this scene"} className="gap-1.5">
        <StateDot state={current ?? "healthy"} muted={current === undefined} />
        {current === undefined ? "Mixed states" : STATE_INFO[current].label}
      </MenuButton>
      <MenuContent align="start" className="w-56">
        <MenuRadioGroup
          value={current ?? ""}
          onValueChange={(value) => setState(store, names, value as StatePreset)}
        >
          {STATE_PRESETS.map((preset) => (
            <MenuRadioItem
              key={preset}
              value={preset}
              icon={<StateDot state={preset} />}
              description={STATE_INFO[preset].description}
            >
              {STATE_INFO[preset].label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function StateDot({ state, muted = false }: { state: StatePreset; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", muted && "opacity-40")}
      style={{ background: TONES[STATE_INFO[state].look.tone].dark.solid }}
    />
  );
}

function MotionMenu({ names, diagram }: { names: readonly string[]; diagram: Diagram }) {
  const store = useEditorStore();
  const view = useSceneView();
  const motions = new Set(
    names.map(
      (name) => sceneValue(view, name)?.motion ?? diagram.components.get(name)?.motion ?? "none",
    ),
  );
  const current = motions.size === 1 ? [...motions][0] : undefined;
  return (
    <Menu>
      <MenuButton label="Motion" className="gap-1.5">
        <Waves className="!text-fg-muted" />
        {current === undefined
          ? "Mixed"
          : current === "none"
            ? "No motion"
            : MOTION_INFO[current].label}
      </MenuButton>
      <MenuContent align="start" className="w-56">
        <MenuRadioGroup
          value={current ?? ""}
          onValueChange={(value) =>
            setMotion(store, names, value as (typeof MOTION_PRESETS)[number])
          }
        >
          {MOTION_PRESETS.map((preset) => (
            <MenuRadioItem
              key={preset}
              value={preset}
              description={MOTION_INFO[preset].description}
            >
              {MOTION_INFO[preset].label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function FlowMenu({ names, diagram }: { names: readonly string[]; diagram: Diagram }) {
  const store = useEditorStore();
  const view = useSceneView();
  const scene = view.scene;
  const flows = new Set(
    names.map(
      (name) => sceneValue(view, name)?.flow ?? diagram.connections.get(name)?.flow ?? "idle",
    ),
  );
  const current = flows.size === 1 ? [...flows][0] : undefined;
  return (
    <Menu>
      <MenuButton label={scene === null ? "Flow" : "Flow in this scene"} className="gap-1.5">
        <Activity className="!text-fg-muted" />
        {current === undefined ? "Mixed flows" : FLOW_INFO[current].label}
      </MenuButton>
      <MenuContent align="start" className="w-56">
        <MenuRadioGroup
          value={current ?? ""}
          onValueChange={(value) => setFlow(store, names, value as FlowPreset)}
        >
          {FLOW_PRESETS.map((preset) => (
            <MenuRadioItem key={preset} value={preset} description={FLOW_INFO[preset].description}>
              {FLOW_INFO[preset].label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function ElementColor({ name, diagram }: { name: string; diagram: Diagram }) {
  const { set } = useEdit();
  const color =
    diagram.components.get(name)?.color ??
    diagram.containers.get(name)?.color ??
    diagram.connections.get(name)?.color ??
    null;
  return (
    <ColorPicker
      label="Colour"
      value={color === null ? null : solid(color)}
      none="Preset colour"
      documentColors={documentColors(diagram)}
      side="bottom"
      align="center"
      onChange={(paint, live) =>
        set(
          name,
          { color: paint === null || paint.kind !== "solid" ? null : paint.color },
          "Change colour",
          { coalesce: live },
        )
      }
    >
      <BarButton label="Colour">
        <SwatchFace
          paint={solid(color ?? NEUTRAL_SWATCH)}
          className={cn("size-5 rounded-full", color === null && "opacity-50")}
        />
      </BarButton>
    </ColorPicker>
  );
}

function OpenNestedButton({ name }: { name: string }) {
  const store = useEditorStore();
  return (
    <IconButton label="Open nested diagram" shortcut="↵" onClick={() => openNested(store, name)}>
      <Layers />
    </IconButton>
  );
}

function MoreMenu({ single }: { single: string | undefined }) {
  const store = useEditorStore();
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="More">
          <Ellipsis />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        {single !== undefined ? (
          <MenuItem icon={<Pencil />} onSelect={() => store.getState().setEditingLabel(single)}>
            Edit text
          </MenuItem>
        ) : null}
        <MenuItem
          icon={<Copy />}
          shortcut={shortcutLabel("mod+d")}
          onSelect={() => duplicateSelection(store)}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          icon={<ArrowUpToLine />}
          shortcut={shortcutLabel("mod+alt+]")}
          onSelect={() => zOrder(store, "front")}
        >
          Bring to front
        </MenuItem>
        <MenuItem
          icon={<ArrowDownToLine />}
          shortcut={shortcutLabel("mod+alt+[")}
          onSelect={() => zOrder(store, "back")}
        >
          Send to back
        </MenuItem>
        <MenuItem
          icon={<PanelRight />}
          onSelect={() => store.getState().togglePanel("inspector", true)}
        >
          All properties
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<Trash2 />}
          tone="danger"
          shortcut={shortcutLabel("backspace")}
          onSelect={() => deleteSelection(store)}
        >
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
