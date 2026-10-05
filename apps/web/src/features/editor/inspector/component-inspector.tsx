"use client";

import { Layers } from "lucide-react";
import type { Component, Diagram } from "@mogram/core/model";
import { MOTION_INFO, MOTION_PRESETS } from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { PropertyRow } from "@/components/ui/property-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { setMotion, setState } from "../actions";
import { openNested } from "../levels";
import { NamedStyleSection } from "./named-style";
import { AllProperties } from "./all-properties";
import { CardEditor } from "./card-editor";
import { ComponentTrafficSection, ScalingSection, StateNote } from "./capacity-section";
import { ShapePicker, ShapeStyle } from "./shape-style";
import {
  ColorField,
  CommitInput,
  FieldRow,
  FieldStack,
  InspectorSection,
  PresetGrid,
  StatePicker,
} from "./fields";
import {
  NameAndFile,
  StyleClipboard,
  effectiveState,
  opensRelative,
  sceneLabel,
  sceneValue,
  useEdit,
  useSceneView,
} from "./shared";
import type { InspectorTab } from "./tabs";

/**
 * A component. Element: label, state in the current scene, motion, card, nesting, details.
 * Style: colour, motion settings, all properties. Arrange is shared (arrange.tsx).
 */
export function ComponentInspector({
  diagram,
  component,
  tab,
}: {
  diagram: Diagram;
  component: Component;
  tab: InspectorTab;
}) {
  const { set, store } = useEdit();
  const view = useSceneView();
  const motion = sceneValue(view, component.name)?.motion ?? component.motion;
  if (tab === "style" && component.shape !== null) {
    return (
      <>
        <NamedStyleSection diagram={diagram} names={[component.name]} />
        <ShapeStyle component={component} />
        <InspectorSection id="state-colour" title="State colour" defaultOpen={false}>
          <ColorField
            label="State colour"
            value={component.color}
            onChange={(color, live) =>
              set(component.name, { color }, "Change colour", { coalesce: live })
            }
          />
        </InspectorSection>
        <StyleClipboard />
        <AllProperties diagram={diagram} name={component.name} source={component.source} />
      </>
    );
  }
  if (tab === "style") {
    return (
      <>
        <NamedStyleSection diagram={diagram} names={[component.name]} />
        <InspectorSection id="colour" title="Colour">
          <ColorField
            label="State colour"
            value={component.color}
            onChange={(color, live) =>
              set(component.name, { color }, "Change colour", { coalesce: live })
            }
          />
          <p className="mt-2 text-caption text-fg-muted">
            Replaces the colour the state gives the tile. Reset goes back to the state’s.
          </p>
        </InspectorSection>
        <InspectorSection id="motion-settings" title="Motion settings">
          <FieldStack>
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
          </FieldStack>
        </InspectorSection>
        <StyleClipboard />
        <AllProperties diagram={diagram} name={component.name} source={component.source} />
      </>
    );
  }
  if (tab !== "element") return null;
  return (
    <>
      <InspectorSection title="Label">
        <CommitInput
          label="Label"
          value={component.label}
          onCommit={(label) => set(component.name, { label }, "Rename label")}
        />
      </InspectorSection>
      {component.shape !== null ? (
        <InspectorSection id="shape" title="Shape">
          <ShapePicker component={component} />
        </InspectorSection>
      ) : null}
      <InspectorSection id="state" title={`State · ${sceneLabel(view)}`}>
        <StatePicker
          label="State"
          value={effectiveState(view, component.name, component.state)}
          onChange={(state) => setState(store, [component.name], state)}
        />
        <StateNote component={component} />
      </InspectorSection>
      <InspectorSection id="motion" title="Motion">
        <PresetGrid
          options={MOTION_PRESETS}
          value={motion}
          onChange={(m) => setMotion(store, [component.name], m)}
          label="Motion"
          describe={(m) => MOTION_INFO[m]}
        />
      </InspectorSection>
      <ScalingSection component={component} />
      <ComponentTrafficSection component={component} />
      <InspectorSection id="card" title="Card">
        <CardEditor name={component.name} card={component.card} label={component.label} />
      </InspectorSection>
      <InspectorSection id="nested" title="Nested diagram">
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
      <InspectorSection id="details" title="Details" defaultOpen={false}>
        <PropertyRow label="Type">
          <span className="truncate font-mono text-caption">
            {component.shape !== null ? `shape: ${component.shape}` : component.type}
          </span>
        </PropertyRow>
        <NameAndFile diagram={diagram} name={component.name} file={component.source.file} />
      </InspectorSection>
    </>
  );
}
