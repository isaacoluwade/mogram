"use client";

import { useState } from "react";
import { Plus, RotateCcw, Upload } from "lucide-react";
import {
  createNamedStyle,
  resetToNamedStyle,
  setNamedStyle,
  styleOverrides,
  updateNamedStyle,
} from "@mogram/core/edit";
import { isValidName, type Diagram } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useEditor, useEditorStore } from "../editor-context";
import { InspectorSection } from "./fields";

const NONE = "__none";
const MIXED = "__mixed";

/** The named style each of `names` takes (null: none); only components, shapes, containers, lines. */
function styleOf(diagram: Diagram, name: string): string | null {
  return (
    diagram.components.get(name)?.style ??
    diagram.containers.get(name)?.style ??
    diagram.connections.get(name)?.style ??
    null
  );
}

/**
 * Named styles (03-shapes-styles-library §4): pick the style the selection takes, make one from
 * how an element looks now, push an element's own changes into its style (so every element with
 * it follows), or drop them so it looks exactly like its style.
 */
export function NamedStyleSection({
  diagram,
  names,
}: {
  diagram: Diagram;
  names: readonly string[];
}) {
  const store = useEditorStore();
  const files = useEditor((s) => s.files);
  const [creating, setCreating] = useState(false);
  const styles = [...diagram.styles.keys()];
  const taken = [...new Set(names.map((name) => styleOf(diagram, name)))];
  const current = taken.length === 1 ? (taken[0] ?? null) : undefined;
  const single = names.length === 1 ? names[0] : undefined;
  const overrides =
    single !== undefined && current != null ? styleOverrides(files, diagram, single) : [];
  const anyStyled = taken.some((style) => style !== null);

  const options = [
    ...(current === undefined ? [{ value: MIXED, label: "Mixed" }] : []),
    { value: NONE, label: "None" },
    ...styles.map((style) => ({ value: style, label: style })),
  ];

  return (
    <InspectorSection
      id="named-style"
      title="Named style"
      defaultOpen={styles.length > 0 || anyStyled}
    >
      <div className="flex flex-col gap-2">
        {styles.length > 0 ? (
          <Select
            label="Named style"
            value={current === undefined ? MIXED : (current ?? NONE)}
            options={options}
            onChange={(value) => {
              if (value === MIXED) return;
              const style = value === NONE ? null : value;
              store
                .getState()
                .edit(style === null ? "Remove style" : "Apply style", (f, d) =>
                  setNamedStyle(f, d, { names, style }),
                );
            }}
          />
        ) : (
          <p className="text-micro text-fg-muted">
            Save how this looks as a style, then give it to other elements in one step.
          </p>
        )}

        {single !== undefined && current != null && overrides.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-md bg-fill-faint px-2.5 py-2">
            <p className="text-micro text-fg-soft">
              Changed here: <span className="font-mono">{overrides.join(", ")}</span>
            </p>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                title={`Every element with “${current}” takes these changes`}
                onClick={() =>
                  store
                    .getState()
                    .edit("Update style", (f, d) => updateNamedStyle(f, d, { from: single }))
                }
              >
                <Upload /> Update style
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title={`Look exactly like “${current}”`}
                onClick={() =>
                  store
                    .getState()
                    .edit("Reset to style", (f, d) => resetToNamedStyle(f, d, { names }))
                }
              >
                <RotateCcw /> Reset
              </Button>
            </div>
          </div>
        ) : null}

        {single === undefined ? null : creating ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              const style = String(new FormData(event.currentTarget).get("style") ?? "").trim();
              if (!isValidName(style) || diagram.styles.has(style)) return;
              setCreating(false);
              store
                .getState()
                .edit("New style", (f, d) => createNamedStyle(f, d, { from: single, style }));
            }}
          >
            <input
              name="style"
              autoFocus
              aria-label="New style name"
              placeholder="critical"
              onKeyDown={(event) => {
                if (event.key === "Escape") setCreating(false);
              }}
              className="h-7 min-w-0 flex-1 rounded-md bg-fill-field px-2 font-mono text-micro text-fg outline-none placeholder:text-fg-ghost focus-visible:ring-1 focus-visible:ring-border-emphasis"
            />
            <Button type="submit" size="sm" variant="secondary">
              Save
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setCreating(true)}
          >
            <Plus /> New style from this
          </Button>
        )}
      </div>
    </InspectorSection>
  );
}
