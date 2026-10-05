"use client";

import type { ComponentType } from "react";
import { preference, setPreference, usePreference } from "@/lib/preferences";
import {
  Box,
  Group,
  Lock,
  PanelRightClose,
  Spline,
  SquareDashed,
  StickyNote,
  Tag,
  Type,
  Square,
  Shapes,
} from "lucide-react";
import { isLocked } from "@mogram/core/edit";
import type { Diagram } from "@mogram/core/model";
import { containerName, diagramCloud } from "@mogram/core/presets";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectionInfo, type SelectionInfo } from "../commands/selection";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { ArrangeTab } from "./arrange";
import { ComponentInspector } from "./component-inspector";
import { ConnectionInspector } from "./connection-inspector";
import { ContainerInspector } from "./container-inspector";
import { DecorationInspector } from "./decoration-inspector";
import { DiagramSettings } from "./diagram-settings";
import { SectionScope } from "./fields";
import { GroupInspector } from "./group-inspector";
import { DataSection, LinkSection } from "./link-data";
import { MultiInspector } from "./multi-inspector";
import { scopeOf, type DiagramTab, type InspectorTab } from "./tabs";

/** The tab last used for elements, or for the diagram, in this browser (04 §16.2). */
function useRememberedTab<T extends string>(
  mode: string,
  options: readonly T[],
  fallback: T,
): [T, (tab: T) => void] {
  const tabs = usePreference("inspectorTabs");
  const tab = options.find((option) => option === tabs[mode]) ?? fallback;
  return [
    tab,
    (next: T) => setPreference("inspectorTabs", { ...preference("inspectorTabs"), [mode]: next }),
  ];
}

const ELEMENT_TABS = ["element", "style", "arrange"] as const;
const DIAGRAM_TABS = ["diagram", "canvas"] as const;

const KIND_ICONS: Readonly<Record<string, ComponentType<{ className?: string }>>> = {
  component: Box,
  shape: Shapes,
  container: Square,
  connection: Spline,
  group: Group,
  text: Type,
  label: Tag,
  zone: SquareDashed,
  note: StickyNote,
};

const KIND_NAMES: Readonly<Record<string, [string, string]>> = {
  components: ["component", "components"],
  containers: ["container", "containers"],
  connections: ["connection", "connections"],
  decorations: ["decoration", "decorations"],
  groups: ["group", "groups"],
};

/**
 * The inspector (ED-20, 04-format-panel §16): a header saying what is selected, then tabs by
 * concern — Element, Style and Arrange for a selection; Diagram and Canvas with nothing
 * selected. Each remembers its last tab, and each kind remembers which sections are open.
 */
export function InspectorPanel({ onClose }: { onClose: () => void }) {
  const { selection } = useEditorShallow((s) => ({ selection: s.selection }));
  // parsed() is cached per files+folder, so this re-renders exactly when the document changes.
  const diagram = useEditor((s) => s.parsed().diagram);
  const sel = selectionInfo(diagram, selection);
  const [elementTab, setElementTab] = useRememberedTab<InspectorTab>(
    "element",
    ELEMENT_TABS,
    "element",
  );
  const [diagramTab, setDiagramTab] = useRememberedTab<DiagramTab>(
    "diagram",
    DIAGRAM_TABS,
    "diagram",
  );
  const nothing = sel.kind === "none";

  return (
    <Panel
      role="region"
      className="flex h-full w-full flex-col overflow-hidden"
      aria-label="Inspector"
      data-popover-edge
    >
      <div className="flex shrink-0 items-start gap-2 px-3.5 pb-1 pt-3">
        <Header diagram={diagram} sel={sel} />
        <IconButton label="Hide inspector" size="sm" onClick={onClose}>
          <PanelRightClose />
        </IconButton>
      </div>
      {nothing ? (
        <Tabs value={diagramTab} onValueChange={(v) => setDiagramTab(v as DiagramTab)}>
          <TabsList aria-label="Diagram settings" className="border-b border-border-subtle px-1">
            <TabsTrigger value="diagram">Diagram</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <Tabs value={elementTab} onValueChange={(v) => setElementTab(v as InspectorTab)}>
          <TabsList aria-label="Properties" className="border-b border-border-subtle px-1">
            <TabsTrigger value="element">
              {sel.names.length > 1 ? "Elements" : "Element"}
            </TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="arrange">Arrange</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div
        role="tabpanel"
        aria-label={nothing ? diagramTab : elementTab}
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        <SectionScope value={scopeOf(diagram, sel)}>
          {nothing ? (
            <DiagramSettings diagram={diagram} tab={diagramTab} />
          ) : (
            <Body diagram={diagram} sel={sel} tab={elementTab} />
          )}
        </SectionScope>
      </div>
    </Panel>
  );
}

function Body({ diagram, sel, tab }: { diagram: Diagram; sel: SelectionInfo; tab: InspectorTab }) {
  const single = sel.single;
  let own: React.ReactNode = null;
  if (single === null) {
    own = <MultiInspector diagram={diagram} sel={sel} tab={tab} />;
  } else {
    const component = diagram.components.get(single);
    const container = diagram.containers.get(single);
    const connection = diagram.connections.get(single);
    const group = diagram.groups.get(single);
    const decoration = diagram.decorations.get(single);
    if (component !== undefined)
      own = <ComponentInspector diagram={diagram} component={component} tab={tab} />;
    else if (container !== undefined)
      own = <ContainerInspector diagram={diagram} container={container} tab={tab} />;
    else if (connection !== undefined)
      own = <ConnectionInspector diagram={diagram} connection={connection} tab={tab} />;
    else if (group !== undefined) own = <GroupInspector group={group} tab={tab} />;
    else if (decoration !== undefined)
      own = <DecorationInspector decoration={decoration} tab={tab} />;
  }
  // Every kind can link somewhere and carry custom data (07-document-workflow §18).
  const extras =
    single === null
      ? undefined
      : (diagram.components.get(single) ??
        diagram.containers.get(single) ??
        diagram.connections.get(single) ??
        diagram.groups.get(single) ??
        diagram.decorations.get(single));
  return (
    <>
      {own}
      {tab === "element" && single !== null && extras !== undefined ? (
        <>
          <LinkSection name={single} link={extras.link} />
          <DataSection name={single} data={extras.data} />
        </>
      ) : null}
      {tab === "arrange" ? <ArrangeTab diagram={diagram} sel={sel} /> : null}
    </>
  );
}

/** What is selected: kind icon, name and type, or a count with chips that narrow it by kind. */
function Header({ diagram, sel }: { diagram: Diagram; sel: SelectionInfo }) {
  const store = useEditorStore();
  if (sel.kind === "none") {
    return (
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-label font-medium text-fg">Diagram</h2>
        <p className="truncate text-micro text-fg-muted">{diagram.settings.name}</p>
      </div>
    );
  }
  if (sel.single === null) {
    const kinds = (Object.keys(KIND_NAMES) as (keyof typeof KIND_NAMES)[])
      .map((key) => ({ key, names: sel[key as keyof SelectionInfo] as readonly string[] }))
      .filter((entry) => entry.names.length > 0);
    return (
      <div className="min-w-0 flex-1">
        <h2 className="text-label font-medium text-fg">{sel.names.length} selected</h2>
        {kinds.length > 1 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {kinds.map(({ key, names }) => {
              const [one, many] = KIND_NAMES[key] ?? [key, key];
              return (
                <button
                  key={key}
                  type="button"
                  title={`Select only the ${many}`}
                  onClick={() => store.getState().select(names)}
                  className="rounded-full bg-fill-subtle px-2 py-0.5 text-micro text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg"
                >
                  {names.length} {names.length === 1 ? one : many}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }
  const name = sel.single;
  const component = diagram.components.get(name);
  const container = diagram.containers.get(name);
  const connection = diagram.connections.get(name);
  const group = diagram.groups.get(name);
  const decoration = diagram.decorations.get(name);
  const kind = decoration?.variant ?? (component?.shape != null ? "shape" : sel.kind);
  const Icon = KIND_ICONS[kind] ?? Box;
  const title =
    component?.label ??
    container?.label ??
    (connection === undefined ? undefined : (connection.text ?? connection.label)) ??
    group?.label ??
    (decoration === undefined
      ? name
      : decoration.variant === "zone"
        ? "Highlight zone"
        : decoration.variant === "label"
          ? "Label"
          : decoration.variant === "note"
            ? "Sticky note"
            : "Text");
  const type =
    (component?.shape != null ? `${component.shape} shape` : component?.type) ??
    (container === undefined ? undefined : containerName(container.type, diagramCloud(diagram))) ??
    (connection === undefined
      ? undefined
      : `${diagram.components.get(connection.from.element)?.label ?? connection.from.element} → ${diagram.components.get(connection.to.element)?.label ?? connection.to.element}`) ??
    (group === undefined ? undefined : `${group.members.length} members`) ??
    name;
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-fill-subtle text-fg-secondary [&_svg]:size-4">
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1.5 text-label font-medium text-fg">
          <span className="truncate">{title}</span>
          {isLocked(diagram, name) ? (
            <Lock aria-label="Locked" className="size-3.5 shrink-0 text-fg-muted" />
          ) : null}
        </h2>
        <p className="truncate font-mono text-micro text-fg-muted" title={type}>
          {type}
        </p>
      </div>
    </div>
  );
}
