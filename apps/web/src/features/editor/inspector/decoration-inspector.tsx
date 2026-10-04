"use client";

import { useMemo } from "react";
import type { Decoration } from "@mogram/core/model";
import { TONES } from "@mogram/core/presets";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { resolveTheme } from "@/features/canvas/theme";
import { cn } from "@/lib/cn";
import { useEditor } from "../editor-context";
import {
  AlignButtons,
  EmphasisButtons,
  FontMenu,
  FontSizeMenu,
  ListButton,
  NoteFillFace,
  NoteFillPicker,
  TextColorFace,
  TextColorPicker,
  isRich,
  textInk,
  type RichDecoration,
} from "../text-look-controls";
import { ArrangeRow } from "./arrange";
import { CommitInput, FieldRow, InspectorSection } from "./fields";
import { useEdit } from "./shared";

/** Text, sticky notes, labels and highlight zones: words, look and order. */
export function DecorationInspector({ decoration }: { decoration: Decoration }) {
  const { set } = useEdit();
  const rich = isRich(decoration);
  return (
    <>
      <InspectorSection title="Text">
        <CommitInput
          label="Text"
          value={decoration.text}
          multiline={rich}
          onCommit={(label) => set(decoration.name, { label }, "Edit text")}
        />
        {rich ? (
          <p className="mt-1.5 text-micro text-fg-muted">
            **bold**, *italic*, and lines starting “- ” or “1. ” make lists.
          </p>
        ) : null}
        <div className="mt-2">
          <ArrangeRow />
        </div>
      </InspectorSection>
      {rich ? <TypographySection decoration={decoration} /> : null}
      {decoration.variant === "note" ? null : decoration.variant === "text" ? (
        <InspectorSection title="Style">
          <SegmentedControl
            label="Text style"
            size="sm"
            value={decoration.style}
            onChange={(style) => set(decoration.name, { style })}
            options={[
              { value: "title", label: "Title" },
              { value: "heading", label: "Heading" },
              { value: "body", label: "Body" },
              { value: "caption", label: "Caption" },
            ]}
          />
        </InspectorSection>
      ) : (
        <InspectorSection title="Tone">
          <div className="flex flex-wrap gap-1.5">
            {(["neutral", "green", "amber", "orange", "rose", "violet"] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={tone}
                aria-pressed={decoration.tone === tone}
                onClick={() => set(decoration.name, { tone })}
                className={cn(
                  "size-7 rounded-full border-2 transition-transform hover:scale-110",
                  decoration.tone === tone ? "border-fg" : "border-transparent",
                )}
                style={{ background: TONES[tone].dark.solid }}
              />
            ))}
          </div>
        </InspectorSection>
      )}
      <InspectorSection title="About">
        <p className="text-caption text-fg-muted">
          Decorations carry no architectural meaning, so they live with the layout, not the
          architecture.
        </p>
      </InspectorSection>
    </>
  );
}

/** Font, size, emphasis, alignment and colours of free text or a note (ED-25). */
function TypographySection({ decoration }: { decoration: RichDecoration }) {
  const settings = useEditor((s) => s.parsed().diagram.settings);
  const themeText = useMemo(() => resolveTheme(settings).text, [settings]);
  return (
    <InspectorSection title={decoration.variant === "note" ? "Note" : "Typography"}>
      <div className="flex flex-col gap-1.5">
        {decoration.variant === "note" ? (
          <FieldRow label="Colour">
            <NoteFillPicker decoration={decoration} side="left">
              <button
                type="button"
                aria-label="Note colour"
                className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md bg-fill-field px-2 text-label text-fg-soft hover:bg-fill-hover"
              >
                <NoteFillFace fill={decoration.fill} />
                <span className="truncate">
                  {decoration.fill.kind === "solid" ? decoration.fill.color : "Gradient"}
                </span>
              </button>
            </NoteFillPicker>
          </FieldRow>
        ) : null}
        <FieldRow label="Font">
          <div className="flex w-full items-center gap-1">
            <FontMenu decoration={decoration} />
            <FontSizeMenu decoration={decoration} />
          </div>
        </FieldRow>
        <FieldRow label="Format">
          <div className="flex w-full items-center gap-0.5">
            <EmphasisButtons decoration={decoration} />
            <ListButton decoration={decoration} />
            <span className="mx-1 h-5 w-px bg-border-muted" aria-hidden />
            <AlignButtons decoration={decoration} />
          </div>
        </FieldRow>
        <FieldRow label="Text colour">
          <TextColorPicker decoration={decoration} side="left">
            <button
              type="button"
              aria-label="Text colour"
              className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md bg-fill-field px-2 text-label text-fg-soft hover:bg-fill-hover"
            >
              <TextColorFace color={textInk(decoration, themeText)} />
              <span className="truncate">{decoration.look.color ?? "Automatic"}</span>
            </button>
          </TextColorPicker>
        </FieldRow>
      </div>
    </InspectorSection>
  );
}
