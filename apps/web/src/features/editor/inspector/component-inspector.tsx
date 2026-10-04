"use client";

import { Layers } from "lucide-react";
import type { Component, Diagram } from "@mogram/core/model";
import { MOTION_INFO, MOTION_PRESETS } from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { PropertyRow } from "@/components/ui/property-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { setMotion, setState } from "../actions";
import { openNested } from "../levels";
import { ArrangeRow } from "./arrange";
import { CardEditor } from "./card-editor";
import {
  Advanced,
  ColorField,
  CommitInput,
  FieldRow,
  InspectorSection,
  PresetGrid,
  StatePicker,
} from "./fields";
import {
  NameAndFile,
  PositionRow,
  effectiveState,
  opensRelative,
  sceneLabel,
  sceneValue,
  useEdit,
  useSceneView,
} from "./shared";

/** A component: label, state in the current scene, motion, card, nesting, look and placement. */
export function ComponentInspector({
  diagram,
  component,
}: {
  diagram: Diagram;
  component: Component;
}) {
  const { set, store } = useEdit();
  const view = useSceneView();
  const motion = sceneValue(view, component.name)?.motion ?? component.motion;
  return (
    <>
      <InspectorSection title="Label">
        <CommitInput
          label="Label"
          value={component.label}
          onCommit={(label) => set(component.name, { label }, "Rename label")}
        />
      </InspectorSection>
      <InspectorSection title={`State · ${sceneLabel(view)}`}>
        <StatePicker
          label="State"
          value={effectiveState(view, component.name, component.state)}
          onChange={(state) => setState(store, [component.name], state)}
        />
      </InspectorSection>
      <InspectorSection title="Motion">
        <PresetGrid
          options={MOTION_PRESETS}
          value={motion}
          onChange={(m) => setMotion(store, [component.name], m)}
          label="Motion"
          describe={(m) => MOTION_INFO[m]}
        />
      </InspectorSection>
      <InspectorSection title="Card">
        <CardEditor name={component.name} card={component.card} label={component.label} />
      </InspectorSection>
      <InspectorSection title="Nested diagram">
        <div className="flex flex-col gap-2">
          <CommitInput
            label="Opens folder"
            mono
            live={false}
            placeholder="./folder, e.g. ./aks"
            value={component.opens === null ? "" : opensRelative(diagram.folder, component.opens)}
            onCommit={(opens) =>
              set(
                component.name,
                { opens: opens.trim() === "" ? null : opens.trim() },
                "Set nested diagram",
              )
            }
          />
          {component.opens !== null ? (
            <Button variant="secondary" size="sm" onClick={() => openNested(store, component.name)}>
              <Layers />
              Open nested diagram
            </Button>
          ) : (
            <p className="text-caption text-fg-muted">
              Point at a folder to zoom into this component’s own diagram.
            </p>
          )}
        </div>
      </InspectorSection>
      <InspectorSection title="Details">
        <PropertyRow label="Type">
          <span className="truncate font-mono text-caption">{component.type}</span>
        </PropertyRow>
        <PropertyRow label="Inside">
          <span className="truncate text-caption">
            {component.parent === null
              ? "Canvas"
              : (diagram.containers.get(component.parent)?.label ?? component.parent)}
          </span>
        </PropertyRow>
        <PositionRow name={component.name} />
        <ArrangeRow />
        <NameAndFile diagram={diagram} name={component.name} file={component.source.file} />
      </InspectorSection>
      <Advanced>
        <FieldRow label="Colour">
          <ColorField
            label="State colour"
            value={component.color}
            onChange={(color, live) =>
              set(component.name, { color }, "Change colour", { coalesce: live })
            }
          />
        </FieldRow>
        <FieldRow label="Intensity">
          <SegmentedControl
            label="Motion intensity"
            size="sm"
            value={component.intensity}
            onChange={(intensity) => set(component.name, { intensity })}
            options={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Speed">
          <SegmentedControl
            label="Motion speed"
            size="sm"
            value={component.speed}
            onChange={(speed) => set(component.name, { speed })}
            options={[
              { value: "slow", label: "Slow" },
              { value: "normal", label: "Normal" },
              { value: "fast", label: "Fast" },
            ]}
          />
        </FieldRow>
      </Advanced>
    </>
  );
}
