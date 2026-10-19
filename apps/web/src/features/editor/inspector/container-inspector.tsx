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
import { PresenceSection } from "./presence-section";
import {
  ColorField,
  CommitInput,
  FieldRow,
  FieldStack,
  InspectorSection,
  NumberField,
  StatePicker,
} from "./fields";
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
  const arranged = container.layout !== null;
  return (
    <>
      <InspectorSection title="Label">
        <CommitInput
          label="Label"
          value={container.label}
          onCommit={(label) => set(container.name, { label }, "Rename label")}
        />
      </InspectorSection>
      <PresenceSection diagram={diagram} name={container.name} />
      <InspectorSection id="arranges" title="Arranges what's in it" defaultOpen={arranged}>
        <FieldStack>
          <SegmentedControl
            label="Layout"
            size="sm"
            className="w-full [&>button]:flex-1"
            value={container.layout?.kind ?? "free"}
            onChange={(layout) =>
              set(container.name, { layout: layout === "free" ? null : layout }, "Change layout")
            }
            options={[
              { value: "free", label: "Freely" },
              { value: "row", label: "Row" },
              { value: "column", label: "Column" },
              { value: "grid", label: "Grid" },
            ]}
          />
          {container.layout !== null ? (
            <FieldRow label="Gap">
              <NumberField
                label="Gap between them"
                value={container.layout.gap}
                min={0}
                max={20}
                onCommit={(gap) =>
                  set(
                    container.name,
                    { gap: gap === 2 ? null : gap === 0 ? "none" : gap },
                    "Change gap",
                  )
                }
              />
            </FieldRow>
          ) : null}
          {container.layout?.kind === "grid" ? (
            <FieldRow label="Columns">
              <NumberField
                label="Columns"
                value={container.layout.columns}
                placeholder="Auto"
                min={1}
                max={24}
                onCommit={(columns) => set(container.name, { columns }, "Change columns")}
                onClear={() => set(container.name, { columns: null }, "Change columns")}
              />
            </FieldRow>
          ) : null}
        </FieldStack>
        <p className="mt-2 text-caption text-fg-muted">
          {container.layout === null
            ? "What's inside is placed by hand. A row, column or grid places it for you, keeps room for the most it ever holds, and lets a story move things in and out."
            : "It places what's inside, in the order written, and keeps room for the most it ever holds. Drag something in or out, with a step showing, to move it at that step."}
        </p>
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
