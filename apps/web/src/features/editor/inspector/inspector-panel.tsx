"use client";

import { PanelRightClose } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useEditor, useEditorShallow } from "../editor-context";
import { ComponentInspector } from "./component-inspector";
import { ConnectionInspector } from "./connection-inspector";
import { ContainerInspector } from "./container-inspector";
import { DecorationInspector } from "./decoration-inspector";
import { DiagramSettings } from "./diagram-settings";
import { GroupInspector } from "./group-inspector";
import { MultiInspector } from "./multi-inspector";

/** The inspector (ED-20): type, name, state, presets, card and the file each element lives in. */
export function InspectorPanel({ onClose }: { onClose: () => void }) {
  const { selection } = useEditorShallow((s) => ({ selection: s.selection }));
  // parsed() is cached per files+folder, so this re-renders exactly when the document changes.
  const diagram = useEditor((s) => s.parsed().diagram);
  const single = selection.length === 1 ? selection[0] : undefined;

  let title = "Diagram";
  let body: React.ReactNode = <DiagramSettings diagram={diagram} />;
  if (selection.length > 1) {
    title = `${selection.length} selected`;
    body = <MultiInspector diagram={diagram} selection={selection} />;
  } else if (single !== undefined) {
    const component = diagram.components.get(single);
    const container = diagram.containers.get(single);
    const connection = diagram.connections.get(single);
    const group = diagram.groups.get(single);
    const decoration = diagram.decorations.get(single);
    if (component !== undefined) {
      title = component.label;
      body = <ComponentInspector diagram={diagram} component={component} />;
    } else if (container !== undefined) {
      title = container.label;
      body = <ContainerInspector diagram={diagram} container={container} />;
    } else if (connection !== undefined) {
      title = connection.text ?? connection.label;
      body = <ConnectionInspector diagram={diagram} connection={connection} />;
    } else if (group !== undefined) {
      title = group.label;
      body = <GroupInspector group={group} />;
    } else if (decoration !== undefined) {
      title =
        decoration.variant === "zone"
          ? "Highlight zone"
          : decoration.variant === "label"
            ? "Label"
            : decoration.variant === "note"
              ? "Sticky note"
              : "Text";
      body = <DecorationInspector decoration={decoration} />;
    }
  }

  return (
    <Panel
      role="region"
      className="flex h-full w-full flex-col overflow-hidden"
      aria-label="Inspector"
    >
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        <IconButton label="Hide inspector" size="sm" onClick={onClose}>
          <PanelRightClose />
        </IconButton>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </Panel>
  );
}
