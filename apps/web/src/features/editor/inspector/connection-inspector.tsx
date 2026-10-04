"use client";

import { RotateCcw } from "lucide-react";
import { setConnectionPath } from "@mogram/core/edit";
import type { Connection, Diagram } from "@mogram/core/model";
import { FLOW_INFO, FLOW_PRESETS, TONES } from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { setFlow } from "../actions";
import { CardEditor } from "./card-editor";
import {
  Advanced,
  ColorField,
  CommitInput,
  FieldRow,
  FieldStack,
  InspectorSection,
  PresetGrid,
} from "./fields";
import { NameAndFile, sceneLabel, sceneValue, useEdit, useSceneView } from "./shared";

/** A connection: label, ends, flow in the current scene, direction and speed, path, card. */
export function ConnectionInspector({
  diagram,
  connection,
}: {
  diagram: Diagram;
  connection: Connection;
}) {
  const { set, store } = useEdit();
  const hasVia = (diagram.layout.get(connection.name)?.via?.length ?? 0) > 0;
  const view = useSceneView();
  const flow = sceneValue(view, connection.name)?.flow ?? connection.flow;
  const placeables = [...diagram.components.values(), ...diagram.containers.values()].map((e) => ({
    value: e.name,
    label: e.label,
  }));
  const others = [...diagram.connections.values()].filter((c) => c.name !== connection.name);
  return (
    <>
      <InspectorSection title={`Flow · ${sceneLabel(view)}`}>
        <PresetGrid
          options={FLOW_PRESETS}
          value={flow}
          onChange={(next) => setFlow(store, [connection.name], next)}
          label="Flow"
          describe={(f) => FLOW_INFO[f]}
          dot={(f) =>
            FLOW_INFO[f].tone === "neutral"
              ? TONES.neutral.dark.solid
              : TONES[FLOW_INFO[f].tone].dark.solid
          }
        />
      </InspectorSection>
      <InspectorSection title="Label">
        <CommitInput
          label="Connection label"
          placeholder="e.g. HTTPS"
          value={connection.text ?? ""}
          onCommit={(label) => set(connection.name, { label }, "Label connection")}
        />
      </InspectorSection>
      <InspectorSection title="Ends">
        <FieldStack>
          <FieldRow label="From">
            <Select
              label="From"
              value={connection.from.element}
              onChange={(from) => set(connection.name, { from }, "Change connection")}
              options={placeables}
            />
          </FieldRow>
          <FieldRow label="To">
            <Select
              label="To"
              value={connection.to.element}
              onChange={(to) => set(connection.name, { to }, "Change connection")}
              options={placeables}
            />
          </FieldRow>
        </FieldStack>
      </InspectorSection>
      <InspectorSection title="Path">
        <FieldRow label="Style">
          <SegmentedControl
            label="Route style"
            size="sm"
            value={connection.route}
            onChange={(route) => set(connection.name, { route })}
            options={[
              { value: "orthogonal", label: "Auto" },
              { value: "curved", label: "Curved" },
              { value: "straight", label: "Straight" },
            ]}
          />
        </FieldRow>
        {connection.route === "orthogonal" ? (
          hasVia ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() =>
                store
                  .getState()
                  .edit("Reset path", (f, d) =>
                    setConnectionPath(f, d, { name: connection.name, via: null }),
                  )
              }
            >
              <RotateCcw /> Reset to automatic path
            </Button>
          ) : (
            <p className="mt-1 text-caption text-fg-muted">Drag a handle on the line to bend it.</p>
          )
        ) : (
          // Curved and straight lines go directly between the ends: bends don't apply.
          <p className="mt-1 text-caption text-fg-muted">
            {connection.route === "curved" ? "Curved" : "Straight"} lines go directly from end to
            end.
            {hasVia ? " The bends saved for Auto come back if you switch to it." : ""}
          </p>
        )}
      </InspectorSection>
      <InspectorSection title="Card">
        <CardEditor
          name={connection.name}
          card={connection.card}
          label={connection.text ?? connection.label}
        />
      </InspectorSection>
      <InspectorSection title="Details">
        <NameAndFile diagram={diagram} name={connection.name} file={connection.source.file} />
      </InspectorSection>
      <Advanced>
        <FieldRow label="Direction">
          <SegmentedControl
            label="Direction"
            size="sm"
            value={connection.direction}
            onChange={(direction) => set(connection.name, { direction })}
            options={[
              { value: "forward", label: "→", ariaLabel: "Forward" },
              { value: "reverse", label: "←", ariaLabel: "Reverse" },
              { value: "both", label: "↔", ariaLabel: "Both ways" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Speed">
          <SegmentedControl
            label="Speed"
            size="sm"
            value={connection.speed}
            onChange={(speed) => set(connection.name, { speed })}
            options={[
              { value: "slow", label: "Slow" },
              { value: "normal", label: "Normal" },
              { value: "fast", label: "Fast" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Density">
          <SegmentedControl
            label="Density"
            size="sm"
            value={connection.density}
            onChange={(density) => set(connection.name, { density })}
            options={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Backup for">
          <Select
            label="Backup for"
            value={connection.backupFor ?? "__none"}
            onChange={(value) =>
              set(connection.name, { backup_for: value === "__none" ? null : value })
            }
            options={[
              { value: "__none", label: "Not a backup" },
              ...others.map((c) => ({ value: c.name, label: c.text ?? c.label })),
            ]}
          />
        </FieldRow>
        <FieldRow label="Colour">
          <ColorField
            label="Line colour"
            value={connection.color}
            onChange={(color, live) =>
              set(connection.name, { color }, "Change colour", { coalesce: live })
            }
          />
        </FieldRow>
      </Advanced>
    </>
  );
}
