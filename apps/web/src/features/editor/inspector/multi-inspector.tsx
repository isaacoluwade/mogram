"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Group,
  Trash2,
} from "lucide-react";
import type { Diagram } from "@mogram/core/model";
import { FLOW_INFO, FLOW_PRESETS } from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { align, deleteSelection, distribute, groupSelection, setFlow, setState } from "../actions";
import { useEditorStore } from "../editor-context";
import { ArrangeRow } from "./arrange";
import { InspectorSection, PresetGrid, StatePicker } from "./fields";
import { sceneLabel, useSceneView } from "./shared";

/** Several things selected: align and distribute, order, and shared state, motion and flow. */
export function MultiInspector({
  diagram,
  selection,
}: {
  diagram: Diagram;
  selection: readonly string[];
}) {
  const store = useEditorStore();
  const view = useSceneView();
  const placeables = selection.filter(
    (n) => diagram.components.has(n) || diagram.containers.has(n),
  );
  const connections = selection.filter((n) => diagram.connections.has(n));
  return (
    <>
      <InspectorSection title="Align">
        <div className="grid grid-cols-8 gap-0.5">
          <IconButton label="Align left" onClick={() => align(store, "left")}>
            <AlignStartVertical />
          </IconButton>
          <IconButton label="Align centres" onClick={() => align(store, "center")}>
            <AlignCenterHorizontal />
          </IconButton>
          <IconButton label="Align right" onClick={() => align(store, "right")}>
            <AlignEndVertical />
          </IconButton>
          <IconButton label="Align top" onClick={() => align(store, "top")}>
            <AlignStartHorizontal />
          </IconButton>
          <IconButton label="Align middles" onClick={() => align(store, "middle")}>
            <AlignCenterVertical />
          </IconButton>
          <IconButton label="Align bottom" onClick={() => align(store, "bottom")}>
            <AlignEndHorizontal />
          </IconButton>
          <IconButton
            label="Distribute horizontally"
            disabled={selection.length < 3}
            onClick={() => distribute(store, "horizontal")}
          >
            <AlignHorizontalJustifyCenter />
          </IconButton>
          <IconButton
            label="Distribute vertically"
            disabled={selection.length < 3}
            onClick={() => distribute(store, "vertical")}
          >
            <AlignVerticalJustifyCenter />
          </IconButton>
        </div>
        {placeables.length > 0 ? (
          <div className="mt-2">
            <ArrangeRow />
          </div>
        ) : null}
      </InspectorSection>
      {placeables.length > 0 ? (
        <InspectorSection title={`State · ${sceneLabel(view)}`}>
          <StatePicker
            label="State for all selected"
            value="healthy"
            onChange={(state) => setState(store, placeables, state)}
          />
        </InspectorSection>
      ) : null}
      {connections.length > 0 ? (
        <InspectorSection title="Flow">
          <PresetGrid
            options={FLOW_PRESETS}
            value="idle"
            onChange={(flow) => setFlow(store, connections, flow)}
            label="Flow for all selected"
            describe={(f) => FLOW_INFO[f]}
          />
        </InspectorSection>
      ) : null}
      <InspectorSection title="Actions">
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => groupSelection(store)}
            disabled={placeables.length === 0}
          >
            <Group /> Group selection
          </Button>
          <Button variant="danger" size="sm" onClick={() => deleteSelection(store)}>
            <Trash2 /> Delete {selection.length} elements
          </Button>
        </div>
      </InspectorSection>
    </>
  );
}

// Nothing selected: the diagram itself (ED-8, ED-24, FI-16)
