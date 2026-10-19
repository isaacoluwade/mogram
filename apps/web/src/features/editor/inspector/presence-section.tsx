"use client";

import { RotateCcw } from "lucide-react";
import type { Diagram, Tone } from "@mogram/core/model";
import { MARKS, MARK_INFO, TONE_NAMES, type Mark, type Presence } from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { setInSet } from "../actions";
import { CommitInput, FieldRow, FieldStack, InspectorSection } from "./fields";
import { sceneLabel, sceneValue, useEdit, useSceneView } from "./shared";

const PRESENCE_OPTIONS: readonly { value: Presence; label: string }[] = [
  { value: "shown", label: "Shown" },
  { value: "faded", label: "Faded" },
  { value: "hidden", label: "Hidden" },
];

const MARK_OPTIONS: readonly { value: Mark | "none"; label: string }[] = [
  { value: "none", label: "No mark" },
  ...MARKS.map((mark) => ({ value: mark, label: MARK_INFO[mark].label })),
];

const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
const TONE_OPTIONS = TONE_NAMES.map((tone) => ({ value: tone, label: capital(tone) }));

/**
 * Whether an element is there, and its mark (D-86). With nothing picked in the dock, this is
 * how the element starts. In a scene or at a step of a story it's what happens to it there:
 * shown, faded or hidden, what it says, its tone and its mark, each recorded in that scene or
 * step and nowhere else.
 */
export function PresenceSection({ diagram, name }: { diagram: Diagram; name: string }) {
  const { set, store } = useEdit();
  const view = useSceneView();
  const component = diagram.components.get(name);
  const container = diagram.containers.get(name);
  const connection = diagram.connections.get(name);
  const decoration = diagram.decorations.get(name);
  const element = component ?? container ?? connection ?? decoration;
  if (element === undefined) return null;

  const line = sceneValue(view, name);
  const inSet = view.scene !== null;
  const marked = component ?? container;
  const toned = component?.look ?? decoration ?? null;
  const ownLabel =
    component?.label ?? container?.label ?? connection?.text ?? decoration?.text ?? "";
  const show = line?.show ?? element.show;
  const mark: Mark | "none" = line?.mark ?? marked?.mark ?? "none";
  const tone: Tone = line?.tone ?? toned?.tone ?? "neutral";
  const changed =
    line?.show !== undefined ||
    line?.label !== undefined ||
    line?.tone !== undefined ||
    line?.mark !== undefined;
  const where = typeof view.scene === "string" ? `In ${sceneLabel(view)}` : "At this step";

  return (
    <InspectorSection
      id="presence"
      title={inSet ? where : "Presence"}
      aside={
        inSet && changed ? (
          <Button
            variant="ghost"
            size="sm"
            className="-my-1 h-6 px-2"
            title="Back to how it was before"
            onClick={() =>
              setInSet(store, [name], { show: null, label: null, tone: null, mark: null }, "Reset")
            }
          >
            <RotateCcw /> Reset
          </Button>
        ) : undefined
      }
    >
      <FieldStack>
        <SegmentedControl
          label={inSet ? "Presence here" : "Presence"}
          size="sm"
          className="w-full [&>button]:flex-1"
          value={show}
          onChange={(next) =>
            inSet
              ? setInSet(store, [name], { show: next }, "Change presence")
              : set(name, { show: next }, "Change presence")
          }
          options={PRESENCE_OPTIONS}
        />
        {marked !== undefined ? (
          <FieldRow label="Mark">
            <Select
              label="Mark"
              value={mark}
              onChange={(next) =>
                inSet
                  ? setInSet(store, [name], { mark: next }, "Change mark")
                  : set(name, { mark: next === "none" ? null : next }, "Change mark")
              }
              options={MARK_OPTIONS}
            />
          </FieldRow>
        ) : null}
        {inSet ? (
          <FieldRow label="Says">
            <CommitInput
              label="What it says here"
              value={line?.label ?? ownLabel}
              onCommit={(label) =>
                setInSet(
                  store,
                  [name],
                  { label: label.trim() === "" ? null : label },
                  "Change words",
                )
              }
            />
          </FieldRow>
        ) : null}
        {inSet && toned !== null ? (
          <FieldRow label="Tone">
            <Select
              label="Tone here"
              value={tone}
              onChange={(next) => setInSet(store, [name], { tone: next }, "Change tone")}
              options={TONE_OPTIONS}
            />
          </FieldRow>
        ) : null}
      </FieldStack>
      <p className="mt-2 text-caption text-fg-muted">
        {inSet
          ? typeof view.scene === "string"
            ? "What happens to it in this scene. Its shape, style and place are the same everywhere."
            : "What happens to it at this step, and stays until a later step changes it. Its shape, style and place are the same everywhere."
          : show === "hidden"
            ? "Not there to begin with: a step of a story or a scene shows it. It's drawn faintly here so you can still edit it."
            : "How it starts. A step of a story or a scene can show, fade or hide it."}
      </p>
    </InspectorSection>
  );
}
