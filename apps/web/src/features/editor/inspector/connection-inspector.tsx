"use client";

import { RotateCcw } from "lucide-react";
import {
  setConnectionGeometry,
  setConnectionLook,
  updateElement,
  type ConnectionLook,
} from "@mogram/core/edit";
import type { Connection, Diagram } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import type { InspectorTab } from "./tabs";
import { NamedStyleSection } from "./named-style";
import { AllProperties } from "./all-properties";
import {
  ArrowSizeSelect,
  ArrowheadPicker,
  LinePatternSelect,
  LineWidthSelect,
  ResetPathButton,
  ReverseButton,
  RouteControl,
  common,
} from "../connection-controls";
import { CardEditor } from "./card-editor";
import { PresenceSection } from "./presence-section";
import { ConnectionTrafficSection } from "./capacity-section";
import {
  Advanced,
  ColorField,
  CommitInput,
  FieldRow,
  FieldStack,
  InspectorSection,
} from "./fields";
import { NameAndFile, StyleClipboard, useEdit } from "./shared";

/**
 * How one or more connections look (ED-29): route, pattern, width, colour, corners and jumps, and
 * the arrowheads at each end. Values that differ across the selection show as mixed.
 */
export function ConnectionStyle({ connections }: { connections: readonly Connection[] }) {
  const { store } = useEdit();
  const names = connections.map((c) => c.name);
  const look = (label: string, change: ConnectionLook) =>
    store.getState().edit(label, (f, d) => setConnectionLook(f, d, { names, look: change }));
  const color = common(connections, (c) => c.color);
  const route = common(connections, (c) => c.route);
  return (
    <>
      <InspectorSection id="line" title="Line">
        <FieldStack>
          <FieldRow label="Route">
            <RouteControl names={names} value={route} />
          </FieldRow>
          <FieldRow label="Pattern">
            <LinePatternSelect
              names={names}
              value={common(connections, (c) => (c.dash === null ? c.line : null))}
            />
          </FieldRow>
          <FieldRow label="Width">
            <LineWidthSelect names={names} value={common(connections, (c) => c.width)} />
          </FieldRow>
          <FieldRow label="Colour">
            <ColorField
              label="Line colour"
              value={color}
              mixed={color === null && connections.some((c) => c.color !== null)}
              onChange={(next, live) =>
                store.getState().edit(
                  "Change colour",
                  (f, d) => {
                    let result = { files: f } as { files: Record<string, string> };
                    for (const name of names) result = setColor(result.files, d, name, next);
                    return result;
                  },
                  { coalesce: live },
                )
              }
            />
          </FieldRow>
          {route !== "curved" ? (
            <FieldRow label="Corners">
              <SegmentedControl
                label="Corners"
                size="sm"
                value={common(connections, (c) => c.corners)}
                onChange={(corners) => look("Change corners", { corners })}
                options={[
                  { value: "rounded", label: "Rounded" },
                  { value: "sharp", label: "Sharp" },
                ]}
              />
            </FieldRow>
          ) : null}
          <FieldRow label="Crossings">
            <SegmentedControl
              label="Line jumps"
              size="sm"
              value={common(connections, (c) => c.jumps)}
              onChange={(jumps) => look("Change line jumps", { jumps })}
              options={[
                { value: "none", label: "Cross" },
                { value: "arc", label: "Arc" },
                { value: "gap", label: "Gap" },
              ]}
            />
          </FieldRow>
        </FieldStack>
      </InspectorSection>
      <InspectorSection id="arrowheads" title="Arrowheads">
        <FieldStack>
          <FieldRow label="Start">
            <div className="flex w-full items-center gap-2">
              <ArrowheadPicker
                names={names}
                end="start"
                value={common(connections, (c) => c.arrows.start)}
              />
              <div className="w-20 shrink-0">
                <ArrowSizeSelect
                  names={names}
                  end="start"
                  value={common(connections, (c) => c.arrowSize.start)}
                />
              </div>
            </div>
          </FieldRow>
          <FieldRow label="End">
            <div className="flex w-full items-center gap-2">
              <ArrowheadPicker
                names={names}
                end="end"
                value={common(connections, (c) => c.arrows.end)}
              />
              <div className="w-20 shrink-0">
                <ArrowSizeSelect
                  names={names}
                  end="end"
                  value={common(connections, (c) => c.arrowSize.end)}
                />
              </div>
            </div>
          </FieldRow>
        </FieldStack>
        <div className="mt-2 flex flex-wrap gap-1">
          <ReverseButton names={names} />
        </div>
      </InspectorSection>
    </>
  );
}

/**
 * A connection. Element: flow in the current scene, label, ends, card, details and traffic
 * settings. Style: the line and its arrowheads. Arrange: its path, fixed ends and label place.
 */
export function ConnectionInspector({
  diagram,
  connection,
  tab,
}: {
  diagram: Diagram;
  connection: Connection;
  tab: InspectorTab;
}) {
  const { set, store } = useEdit();
  const names = [connection.name];
  const layout = diagram.layout.get(connection.name);
  const bends = layout?.via?.length ?? 0;
  const hasVia = bends > 0;
  const anchored = layout?.fromAnchor != null || layout?.toAnchor != null;
  const placed = layout?.label != null;
  const placeables = [...diagram.components.values(), ...diagram.containers.values()].map((e) => ({
    value: e.name,
    label: e.label,
  }));
  const others = [...diagram.connections.values()].filter((c) => c.name !== connection.name);
  if (tab === "style") {
    return (
      <>
        <NamedStyleSection diagram={diagram} names={[connection.name]} />
        <ConnectionStyle connections={[connection]} />
        <InspectorSection id="dots" title="Dots">
          <FieldStack>
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
          </FieldStack>
          <p className="mt-2 text-caption text-fg-muted">
            How the dots look. How much traffic it carries is under Traffic, on the Element tab, and
            the dots follow it.
          </p>
        </InspectorSection>
        <StyleClipboard />
        <AllProperties diagram={diagram} name={connection.name} source={connection.source} />
      </>
    );
  }
  if (tab === "arrange") {
    return (
      <InspectorSection id="path" title="Path">
        <p className="text-caption text-fg-muted">
          {hasVia
            ? `Bent by hand at ${bends} point${bends === 1 ? "" : "s"}.`
            : connection.route === "orthogonal"
              ? "Routed automatically around other elements. Drag a segment to move it."
              : "Drag the line, or its faded midpoint, to bend it."}
          {anchored ? " Its ends are fixed to points on their elements." : ""}
          {placed ? " Its label has been moved." : ""}
        </p>
        {hasVia || anchored || placed ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {hasVia ? <ResetPathButton names={names} /> : null}
            {anchored ? <ResetPathButton names={names} anchors /> : null}
            {placed ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  store
                    .getState()
                    .edit("Reset label place", (f, d) =>
                      setConnectionGeometry(f, d, { name: connection.name, label: null }),
                    )
                }
              >
                <RotateCcw /> Label back to the middle
              </Button>
            ) : null}
          </div>
        ) : null}
      </InspectorSection>
    );
  }
  return (
    <>
      <ConnectionTrafficSection diagram={diagram} connection={connection} />
      <InspectorSection title="Label">
        <CommitInput
          label="Connection label"
          placeholder="e.g. HTTPS"
          value={connection.text ?? ""}
          onCommit={(label) => set(connection.name, { label }, "Label connection")}
        />
      </InspectorSection>
      <PresenceSection diagram={diagram} name={connection.name} />
      <InspectorSection id="ends" title="Ends">
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
      <InspectorSection id="card" title="Card">
        <CardEditor
          name={connection.name}
          card={connection.card}
          label={connection.text ?? connection.label}
        />
      </InspectorSection>
      <InspectorSection id="details" title="Details" defaultOpen={false}>
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
      </Advanced>
    </>
  );
}

function setColor(
  files: Record<string, string>,
  diagram: Diagram,
  name: string,
  color: string | null,
): { files: Record<string, string> } {
  return updateElement(files, diagram, { name, set: { color } });
}
