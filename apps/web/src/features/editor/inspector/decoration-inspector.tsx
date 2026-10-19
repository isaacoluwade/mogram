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
import { AllProperties } from "./all-properties";
import { PresenceSection } from "./presence-section";
import { CommitInput, FieldRow, InspectorSection } from "./fields";
import { StyleClipboard, useEdit } from "./shared";
import type { InspectorTab } from "./tabs";

/**
 * Text, sticky notes, labels and highlight zones. Element: the words. Style: typography, text
 * style or tone. Arrange is shared (arrange.tsx).
 */
export function DecorationInspector({
  decoration,
  tab,
}: {
  decoration: Decoration;
  tab: InspectorTab;
}) {
  const { set } = useEdit();
  const diagram = useEditor((s) => s.parsed().diagram);
  const rich = isRich(decoration);
  if (tab === "arrange") return null;
  if (tab === "element") {
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
        </InspectorSection>
        {decoration.variant === "text" ? (
          <InspectorSection title="Width">
            <CommitInput
              label="Width (cells)"
              value={decoration.width === null ? "" : String(decoration.width)}
              onCommit={(value) => {
                const width = value.trim() === "" ? null : Number(value);
                if (width === null || (Number.isInteger(width) && width >= 1 && width <= 10000))
                  set(decoration.name, { width }, "Wrap text");
              }}
            />
          </InspectorSection>
        ) : null}
        <PresenceSection diagram={diagram} name={decoration.name} />
        <InspectorSection id="about" title="About" defaultOpen={false}>
          <p className="text-caption text-fg-muted">
            Decorations carry no architectural meaning, so they live with the layout, not the
            architecture.
          </p>
        </InspectorSection>
      </>
    );
  }
  return (
    <>
      {rich ? <TypographySection decoration={decoration} /> : null}
      {decoration.variant === "note" ? null : decoration.variant === "text" ? (
        <InspectorSection id="text-style" title="Text style">
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
        <InspectorSection id="tone" title="Tone">
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
      <StyleClipboard />
      <AllProperties diagram={diagram} name={decoration.name} source={decoration.source} />
    </>
  );
}

/** Font, size, emphasis, alignment and colours of free text or a note (ED-25). */
function TypographySection({ decoration }: { decoration: RichDecoration }) {
  const settings = useEditor((s) => s.parsed().diagram.settings);
  const themeText = useMemo(() => resolveTheme(settings).text, [settings]);
  return (
    <InspectorSection id="typography" title={decoration.variant === "note" ? "Note" : "Typography"}>
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
