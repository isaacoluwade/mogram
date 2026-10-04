"use client";

import { RotateCcw } from "lucide-react";
import { autoSize } from "@mogram/core/edit";
import type { Container, Diagram } from "@mogram/core/model";
import { CONTAINER_STYLES, CONTAINER_STYLE_INFO } from "@mogram/core/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropertyRow } from "@/components/ui/property-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { setState } from "../actions";
import { ArrangeRow } from "./arrange";
import { CardEditor } from "./card-editor";
import {
  Advanced,
  ColorField,
  CommitInput,
  FieldRow,
  InspectorSection,
  StatePicker,
} from "./fields";
import {
  NameAndFile,
  PositionRow,
  effectiveState,
  sceneLabel,
  useEdit,
  useSceneView,
} from "./shared";

/** A container (region, VNet, subnet…): label, style, state and roll-up, card, size and placement. */
export function ContainerInspector({
  diagram,
  container,
}: {
  diagram: Diagram;
  container: Container;
}) {
  const { set, store } = useEdit();
  const view = useSceneView();
  const sized = diagram.layout.get(container.name)?.size != null;
  return (
    <>
      <InspectorSection title="Label">
        <CommitInput
          label="Label"
          value={container.label}
          onCommit={(label) => set(container.name, { label }, "Rename label")}
        />
      </InspectorSection>
      <InspectorSection title="Type">
        <Select
          label="Container type"
          value={container.type}
          onChange={(type) => set(container.name, { type }, "Change container type")}
          options={CONTAINER_STYLES.map((style) => ({
            value: style,
            label: CONTAINER_STYLE_INFO[style].label,
            description: CONTAINER_STYLE_INFO[style].description,
          }))}
        />
      </InspectorSection>
      <InspectorSection title={`State · ${sceneLabel(view)}`}>
        <StatePicker
          label="State"
          value={effectiveState(view, container.name, container.state)}
          onChange={(state) => setState(store, [container.name], state)}
        />
        <p className="mt-2 text-caption text-fg-muted">
          Down puts everything inside down. Otherwise the worst state inside shows here.
        </p>
      </InspectorSection>
      <InspectorSection title="Card">
        <CardEditor name={container.name} card={container.card} label={container.label} />
      </InspectorSection>
      <InspectorSection title="Details">
        <PropertyRow label="Size">
          {sized ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                store.getState().edit("Fit to contents", (f, d) => autoSize(f, d, container.name))
              }
            >
              <RotateCcw /> Fit to contents
            </Button>
          ) : (
            <Badge tone="neutral" size="sm">
              Fits contents
            </Badge>
          )}
        </PropertyRow>
        <PositionRow name={container.name} />
        <ArrangeRow />
        <NameAndFile diagram={diagram} name={container.name} file={container.source.file} />
      </InspectorSection>
      <Advanced>
        <FieldRow label="Roll-up">
          <SegmentedControl
            label="Roll-up rule"
            size="sm"
            value={container.rollup}
            onChange={(rollup) => set(container.name, { rollup })}
            options={[
              { value: "worst", label: "Worst" },
              { value: "best", label: "Best" },
              { value: "none", label: "None" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Colour">
          <ColorField
            label="Border colour"
            value={container.color}
            onChange={(color, live) =>
              set(container.name, { color }, "Change colour", { coalesce: live })
            }
          />
        </FieldRow>
      </Advanced>
    </>
  );
}
