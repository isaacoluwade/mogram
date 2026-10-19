"use client";

import { useRef } from "react";
import { ImageUp, Plus, Scan, Trash2 } from "lucide-react";
import type { Component, Part, Tone } from "@mogram/core/model";
import { uniqueName } from "@mogram/core/model";
import { CODE_LANGUAGES, lineRange, type CodeLanguage } from "@mogram/core/code";
import { MARKS, TONE_NAMES, type Mark, type Presence } from "@mogram/core/presets";
import { removePart, renamePart, setPart, type PartPatch } from "@mogram/core/edit";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { replaceImageFile } from "../actions";
import { useEditorStore } from "../editor-context";
import { CommitInput, FieldRow, FieldStack, InspectorSection } from "./fields";
import { useEdit } from "./shared";

/** How each language is named in the inspector. */
const LANGUAGE_LABELS: Readonly<Record<CodeLanguage, string>> = {
  hcl: "HCL (Terraform)",
  console: "Console",
  plan: "Terraform plan",
  yaml: "YAML",
  json: "JSON",
  shell: "Shell",
  diff: "Diff",
  plain: "Plain text",
};

const rangeText = (first: number, last: number): string =>
  first === last ? String(first) : `${first}-${last}`;

const validRange = (value: string): string | null =>
  lineRange(value) === null ? "Use a line or a range, like 12 or 12-31." : null;

// -------------------------------------------------------------------------------------------------
// Image (D-102)

/** An image's picture and how it fits its element. */
export function ImageSection({ component }: { component: Component }) {
  const { set, store } = useEdit();
  const chooser = useRef<HTMLInputElement | null>(null);
  const image = component.image;
  if (image === null) return null;
  return (
    <InspectorSection id="image" title="Picture">
      <FieldStack>
        <CommitInput
          label="Picture file"
          mono
          live={false}
          value={image.src}
          placeholder="images/portal.png"
          onCommit={(src) => set(component.name, { src: src.trim() }, "Change picture")}
        />
        <FieldRow label="Fit">
          <SegmentedControl
            label="Fit"
            size="sm"
            value={image.fit}
            options={[
              { value: "contain", label: "Whole picture" },
              { value: "cover", label: "Fill" },
            ]}
            onChange={(fit) =>
              set(component.name, { fit: fit === "contain" ? null : fit }, "Fit picture")
            }
          />
        </FieldRow>
        <FieldRow label="Replace">
          <IconButton
            label="Choose another picture"
            size="sm"
            onClick={() => chooser.current?.click()}
          >
            <ImageUp />
          </IconButton>
          <input
            ref={chooser}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file !== undefined)
                void replaceImageFile(store, component.name, file).catch((error: unknown) =>
                  store
                    .getState()
                    .notify(
                      error instanceof Error ? error.message : "That picture couldn't be used.",
                    ),
                );
            }}
          />
        </FieldRow>
      </FieldStack>
    </InspectorSection>
  );
}

// -------------------------------------------------------------------------------------------------
// Code (D-103)

/** A listing's text or file, its slice, language, header and line numbers. */
export function CodeSection({ component }: { component: Component }) {
  const { set } = useEdit();
  const code = component.code;
  if (code === null) return null;
  const fromFile = code.file !== null;
  return (
    <InspectorSection id="code" title="Code">
      <FieldStack>
        <SegmentedControl
          label="Where the lines come from"
          size="sm"
          value={fromFile ? "file" : "here"}
          options={[
            { value: "here", label: "Written here" },
            { value: "file", label: "A file" },
          ]}
          onChange={(where) => {
            if (where === "here")
              // The file's lines come in, so nothing on screen changes.
              set(
                component.name,
                { file: null, text: code.listing.lines.join("\n") },
                "Write code here",
              );
            else set(component.name, { text: null, file: "code/main.tf" }, "Show a code file");
          }}
        />
        {fromFile ? (
          <CommitInput
            label="Code file"
            mono
            live={false}
            value={code.file ?? ""}
            placeholder="code/main.tf"
            onCommit={(file) => set(component.name, { file: file.trim() }, "Change code file")}
          />
        ) : (
          <CommitInput
            label="Code text"
            mono
            multiline
            live={false}
            value={code.text ?? ""}
            onCommit={(text) => set(component.name, { text }, "Edit code")}
          />
        )}
        <FieldRow label="Language">
          <Select
            label="Language"
            value={code.language}
            options={CODE_LANGUAGES.map((value) => ({ value, label: LANGUAGE_LABELS[value] }))}
            onChange={(language) => set(component.name, { language }, "Change language")}
          />
        </FieldRow>
        <FieldRow label="Lines">
          <CommitInput
            label="Lines shown"
            mono
            live={false}
            placeholder="All of them"
            value={code.slice === null ? "" : rangeText(code.slice[0], code.slice[1])}
            validate={(value) => (value.trim() === "" ? null : validRange(value))}
            onCommit={(lines) =>
              set(
                component.name,
                { lines: lines.trim() === "" ? null : lines.trim() },
                "Show lines",
              )
            }
          />
        </FieldRow>
        <FieldRow label="Header">
          <CommitInput
            label="Header"
            live={false}
            placeholder={code.file === null ? "None" : "The file's name"}
            value={code.title ?? ""}
            onCommit={(title) =>
              set(
                component.name,
                // Empty goes back to the default: the file's name, or no header for written code.
                { title: title.trim() === "" ? null : title.trim() },
                "Change header",
              )
            }
          />
        </FieldRow>
        <FieldRow label="Line numbers">
          <Switch
            aria-label="Line numbers"
            checked={code.numbers}
            onCheckedChange={(numbers) => set(component.name, { numbers }, "Line numbers")}
          />
        </FieldRow>
      </FieldStack>
    </InspectorSection>
  );
}

// -------------------------------------------------------------------------------------------------
// Parts (D-104)

/** An image's regions or a listing's lines, each named, with how it starts. */
export function PartsSection({ component }: { component: Component }) {
  const store = useEditorStore();
  const isImage = component.image !== null;
  const full = component.parts.size >= 64 || component.opens !== null;
  const add = () => {
    if (isImage) {
      window.dispatchEvent(new CustomEvent("mogram:draw-part", { detail: component.name }));
      return;
    }
    const name = uniqueName("lines", new Set(component.parts.keys()));
    const first = component.code?.listing.first ?? 1;
    store
      .getState()
      .edit("Add part", (files, diagram) =>
        setPart(files, diagram, { element: component.name, name, set: { lines: [first, first] } }),
      );
  };
  return (
    <InspectorSection
      id="parts"
      title="Parts"
      aside={
        <IconButton
          label={isImage ? "Draw a region" : "Add lines as a part"}
          size="sm"
          disabled={full}
          onClick={add}
        >
          {isImage ? <Scan /> : <Plus />}
        </IconButton>
      }
    >
      {component.parts.size === 0 ? (
        <p className="text-caption text-fg-muted">
          {isImage
            ? "Draw a region on the picture to name it. A step can then light it, mark it or point to it."
            : "Name some lines. A step can then light them, mark them or point to them."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...component.parts.values()].map((part) => (
            <PartRow key={part.name} component={component} part={part} />
          ))}
        </ul>
      )}
    </InspectorSection>
  );
}

function PartRow({ component, part }: { component: Component; part: Part }) {
  const store = useEditorStore();
  const element = component.name;
  const change = (set: PartPatch, label = "Change part") =>
    store
      .getState()
      .edit(label, (files, diagram) => setPart(files, diagram, { element, name: part.name, set }));
  const share = (value: string): string | null => {
    const number = Number(value);
    return value.trim() === "" || !Number.isFinite(number) || number < 0 || number > 1
      ? "A share of the picture, from 0 to 1."
      : null;
  };
  return (
    <li className="flex flex-col gap-1.5 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">
          <CommitInput
            label={`Name of part ${part.name}`}
            mono
            live={false}
            value={part.name}
            onCommit={(to) =>
              store
                .getState()
                .edit("Rename part", (files, diagram) =>
                  renamePart(files, diagram, { element, from: part.name, to: to.trim() }),
                )
            }
          />
        </div>
        <IconButton
          label={`Delete part ${part.name}`}
          size="sm"
          onClick={() =>
            store
              .getState()
              .edit("Delete part", (files, diagram) =>
                removePart(files, diagram, { element, name: part.name }),
              )
          }
        >
          <Trash2 />
        </IconButton>
      </div>
      {part.kind === "lines" ? (
        <FieldRow label="Lines">
          <CommitInput
            label={`Lines of part ${part.name}`}
            mono
            live={false}
            value={rangeText(part.first, part.last)}
            validate={validRange}
            onCommit={(value) => {
              const lines = lineRange(value);
              if (lines !== null) change({ lines });
            }}
          />
        </FieldRow>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {(["x", "y", "w", "h"] as const).map((key) => (
            <CommitInput
              key={key}
              label={`${{ x: "Left", y: "Top", w: "Width", h: "Height" }[key]} of part ${part.name}`}
              mono
              live={false}
              value={String(Math.round(part[key] * 1000) / 1000)}
              validate={share}
              onCommit={(value) =>
                change({
                  area: { x: part.x, y: part.y, w: part.w, h: part.h, [key]: Number(value) },
                })
              }
            />
          ))}
        </div>
      )}
      <FieldRow label="Starts">
        <SegmentedControl
          label={`How part ${part.name} starts`}
          size="sm"
          value={part.show}
          options={[
            { value: "shown", label: "Shown" },
            { value: "faded", label: "Faded" },
            { value: "hidden", label: "Hidden" },
          ]}
          onChange={(show: Presence) => change({ show })}
        />
      </FieldRow>
      <FieldRow label="Tone">
        <Select
          label={`Tone of part ${part.name}`}
          value={part.tone ?? "none"}
          options={[
            { value: "none", label: "None" },
            ...TONE_NAMES.filter((tone) => tone !== "neutral").map((tone) => ({
              value: tone,
              label: tone[0]?.toUpperCase() + tone.slice(1),
            })),
          ]}
          onChange={(tone) => change({ tone: tone === "none" ? null : (tone as Tone) })}
        />
      </FieldRow>
      <FieldRow label="Mark">
        <Select
          label={`Mark of part ${part.name}`}
          value={part.mark ?? "none"}
          options={[
            { value: "none", label: "None" },
            ...MARKS.map((mark) => ({
              value: mark,
              label: mark[0]?.toUpperCase() + mark.slice(1),
            })),
          ]}
          onChange={(mark) => change({ mark: mark === "none" ? null : (mark as Mark) })}
        />
      </FieldRow>
    </li>
  );
}
