"use client";

import { Fragment, useCallback, useState, type ReactNode } from "react";
import { Ellipsis, Activity, Layers, PanelRight, Waves } from "lucide-react";
import type { Box, LayoutResult } from "@mogram/core/layout";
import type { Connection, Diagram } from "@mogram/core/model";
import {
  FLOW_INFO,
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
import { setFlow, setMotion, setState } from "../actions";
import { openNested } from "../levels";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { documentColors } from "../inspector/document-colors";
import {
  effectiveState,
  flowChoices,
  sceneValue,
  shownFlow,
  useEdit,
  useSceneView,
} from "../inspector/shared";
import { useCommandContext } from "../commands/context";
import { CommandMenuItems } from "../commands/menu-items";
import { menuFor, resolveMenu } from "../commands/menus";
import { selectionInfo } from "../commands/selection";
import type { CommandContext } from "../commands/types";
import {
  barHome,
  quickBarFor,
  revealInInspector,
  type InspectorHome,
  type ResolvedControl,
} from "./quick-bar-schema";
import { ArrowheadPicker, LineStyleMenu, RouteControl, common } from "../connection-controls";
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
      s.pathEdit !== null,
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
  const bounds = selectionBounds(view.selection, layout, routes, diagram);
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

/**
 * The selection's world bounds: element boxes, tiles, group outlines and connection paths with
 * the tiles at their ends, so the bar never covers what a connection joins.
 */
function selectionBounds(
  names: readonly string[],
  layout: LayoutResult,
  routes: ReadonlyMap<string, RoutedPath>,
  diagram: Diagram,
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
    if (route === undefined) continue;
    for (const point of route.points) add({ x: point.x, y: point.y, w: 0, h: 0 });
    const connection = diagram.connections.get(name);
    for (const end of connection === undefined ? [] : [connection.from, connection.to]) {
      const tile = layout.tiles.get(end.element) ?? layout.elements.get(end.element)?.box;
      // A container end is too big to clear; its edge is where the line meets it anyway.
      if (tile !== undefined && layout.elements.get(end.element)?.kind !== "container") add(tile);
    }
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
  const sel = selectionInfo(diagram, names);
  const { items } = quickBarFor(sel, diagram);
  return (
    <>
      {items.map((item, index) =>
        item === "|" ? (
          <ToolbarDivider key={`divider-${index}`} />
        ) : (
          <Fragment key={item.id}>
            <QuickControlView control={item} diagram={diagram} theme={theme} />
          </Fragment>
        ),
      )}
      {items.length > 0 ? <ToolbarDivider /> : null}
      <MoreMenu home={barHome(items)} />
    </>
  );
}

/** One declared control (quick-bar-schema), drawn with the same pieces as the inspector's. */
function QuickControlView({
  control,
  diagram,
  theme,
}: {
  control: ResolvedControl;
  diagram: Diagram;
  theme: CanvasTheme;
}) {
  const names = control.names;
  const name = names[0] ?? "";
  const lines = names
    .map((n) => diagram.connections.get(n))
    .filter((c): c is Connection => c !== undefined);
  const text = diagram.decorations.get(name);
  const decoration = isRich(text) ? text : null;
  switch (control.id) {
    case "state":
      return <StateMenu names={names} diagram={diagram} />;
    case "motion":
      return <MotionMenu names={names} diagram={diagram} />;
    case "flow":
      return <FlowMenu names={names} diagram={diagram} />;
    case "tone":
      return <ShapeToneMenu name={name} diagram={diagram} />;
    case "color":
      return <ElementColor name={name} diagram={diagram} />;
    case "open-nested":
      return <OpenNestedButton name={name} />;
    case "route":
      return (
        <div className="px-0.5">
          <RouteControl names={names} value={common(lines, (c) => c.route)} />
        </div>
      );
    case "line":
      return (
        <LineStyleMenu
          names={names}
          pattern={common(lines, (c) => (c.dash === null ? c.line : null))}
          width={common(lines, (c) => c.width)}
          jumps={common(lines, (c) => c.jumps)}
        />
      );
    case "arrow-start":
    case "arrow-end": {
      const end = control.id === "arrow-start" ? "start" : "end";
      return (
        <ArrowheadPicker
          names={names}
          end={end}
          value={common(lines, (c) => c.arrows[end])}
          compact
        />
      );
    }
    case "text-style":
      return decoration?.variant !== "text" ? null : <TextStyleMenu decoration={decoration} />;
    case "note-fill":
      return decoration?.variant !== "note" ? null : (
        <NoteFillPicker decoration={decoration}>
          <BarButton label="Note colour">
            <NoteFillFace fill={decoration.fill} />
          </BarButton>
        </NoteFillPicker>
      );
    case "font":
      return decoration === null ? null : <FontMenu decoration={decoration} />;
    case "font-size":
      return decoration === null ? null : <FontSizeMenu decoration={decoration} />;
    case "emphasis":
      return decoration === null ? null : <EmphasisButtons decoration={decoration} />;
    case "align":
      return decoration === null ? null : <AlignMenu decoration={decoration} />;
    case "list":
      return decoration === null ? null : <ListButton decoration={decoration} />;
    case "text-color":
      return decoration === null ? null : (
        <TextColorPicker decoration={decoration}>
          <BarButton label="Text colour">
            <TextColorFace color={textInk(decoration, theme.text)} />
          </BarButton>
        </TextColorPicker>
      );
    case "decoration-tone":
      return <DecorationTone name={name} tone={text?.tone ?? "neutral"} />;
  }
}

function TextStyleMenu({
  decoration,
}: {
  decoration: Extract<RichDecoration, { variant: "text" }>;
}) {
  const { set } = useEdit();
  return (
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

function DecorationTone({ name, tone }: { name: string; tone: string }) {
  const { set } = useEdit();
  return (
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
  const flows = new Set(names.map((name) => shownFlow(view, diagram, name)));
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
          {flowChoices(diagram).map((preset) => (
            <MenuRadioItem key={preset} value={preset} description={FLOW_INFO[preset].description}>
              {FLOW_INFO[preset].label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** A shape's tone (03 §5 P0-2): fill, outline and words change colour together. */
function ShapeToneMenu({ name, diagram }: { name: string; diagram: Diagram }) {
  const { set } = useEdit();
  const tone = diagram.components.get(name)?.look?.tone ?? "neutral";
  return (
    <Menu>
      <MenuTrigger asChild>
        <BarButton label="Tone">
          <span
            aria-hidden
            className="size-4 rounded-full ring-1 ring-border"
            style={{ background: TONES[tone].dark.solid }}
          />
        </BarButton>
      </MenuTrigger>
      <MenuContent align="start" className="w-44">
        <MenuRadioGroup
          value={tone}
          onValueChange={(value) => set(name, { tone: value }, "Change tone")}
        >
          {TONE_NAMES.map((option) => (
            <MenuRadioItem
              key={option}
              value={option}
              icon={
                <span
                  aria-hidden
                  className="size-3 rounded-full"
                  style={{ background: TONES[option].dark.solid }}
                />
              }
            >
              {option[0]?.toUpperCase()}
              {option.slice(1)}
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

/**
 * Everything the right-click menu offers, so nothing is out of reach from the bar, then "More in
 * inspector": the inspector opened at the section holding the rest of the bar's first control.
 */
function MoreMenu({ home }: { home: InspectorHome }) {
  const store = useEditorStore();
  const contextNow = useCommandContext();
  const [context, setContext] = useState<CommandContext | null>(null);
  return (
    <Menu onOpenChange={(open) => setContext(open ? contextNow() : null)}>
      <MenuTrigger asChild>
        <IconButton label="More">
          <Ellipsis />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end" className="w-60">
        {context === null ? null : (
          <>
            <CommandMenuItems
              entries={resolveMenu(menuFor(context.sel), context, true)}
              context={context}
              variant="dropdown"
            />
            <MenuSeparator />
            <MenuItem
              icon={<PanelRight />}
              onSelect={() => revealInInspector(store, context.diagram, context.sel, home)}
            >
              More in inspector
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
