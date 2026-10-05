"use client";

import type { Container, Diagram } from "@mogram/core/model";
import {
  CLOUD_CONTAINERS,
  CLOUD_LABELS,
  CONTAINER_STYLE_INFO,
  containerName,
  diagramCloud,
} from "@mogram/core/presets";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { setState } from "../actions";
import { NamedStyleSection } from "./named-style";
import { AllProperties } from "./all-properties";
import { CardEditor } from "./card-editor";
import { ColorField, CommitInput, FieldRow, InspectorSection, StatePicker } from "./fields";
import {
  NameAndFile,
  StyleClipboard,
  effectiveState,
  sceneLabel,
  useEdit,
  useSceneView,
} from "./shared";
import type { InspectorTab } from "./tabs";

/**
 * A container (region, VNet, subnet…). Element: label, type, state and roll-up, card, details.
 * Style: border colour, all properties. Size and placement are on the shared Arrange tab.
 */
export function ContainerInspector({
  diagram,
  container,
  tab,
}: {
  diagram: Diagram;
  container: Container;
  tab: InspectorTab;
}) {
  const { set, store } = useEdit();
  const view = useSceneView();
  const cloud = diagramCloud(diagram);
  if (tab === "style") {
    return (
      <>
        <NamedStyleSection diagram={diagram} names={[container.name]} />
        <InspectorSection id="colour" title="Colour">
          <ColorField
            label="Border colour"
            value={container.color}
            onChange={(color, live) =>
              set(container.name, { color }, "Change colour", { coalesce: live })
            }
          />
        </InspectorSection>
        <StyleClipboard />
        <AllProperties diagram={diagram} name={container.name} source={container.source} />
      </>
    );
  }
  if (tab !== "element") return null;
  return (
    <>
      <InspectorSection title="Label">
        <CommitInput
          label="Label"
          value={container.label}
          onCommit={(label) => set(container.name, { label }, "Rename label")}
        />
      </InspectorSection>
      <InspectorSection id="type" title="Type">
        <Select
          label="Container type"
          value={container.type}
          onChange={(type) => set(container.name, { type }, "Change container type")}
          options={[
            ...CLOUD_CONTAINERS[cloud ?? "any"],
            ...(CLOUD_CONTAINERS[cloud ?? "any"].includes(container.type) ? [] : [container.type]),
          ].map((style) => ({
            value: style,
            label: containerName(style, cloud),
            description: CONTAINER_STYLE_INFO[style].description,
          }))}
        />
        {cloud !== null ? (
          <p className="mt-1.5 text-micro text-fg-muted">
            Named the {CLOUD_LABELS[cloud]} way, as this diagram is drawn for it.
          </p>
        ) : null}
      </InspectorSection>
      <InspectorSection id="state" title={`State · ${sceneLabel(view)}`}>
        <StatePicker
          label="State"
          value={effectiveState(view, container.name, container.state)}
          onChange={(state) => setState(store, [container.name], state)}
        />
        <div className="mt-2">
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
        </div>
        <p className="mt-2 text-caption text-fg-muted">
          Down puts everything inside down. Otherwise the roll-up picks the state shown here from
          what’s inside.
        </p>
      </InspectorSection>
      <InspectorSection id="card" title="Card">
        <CardEditor name={container.name} card={container.card} label={container.label} />
      </InspectorSection>
      <InspectorSection id="details" title="Details" defaultOpen={false}>
        <NameAndFile diagram={diagram} name={container.name} file={container.source.file} />
      </InspectorSection>
    </>
  );
}
