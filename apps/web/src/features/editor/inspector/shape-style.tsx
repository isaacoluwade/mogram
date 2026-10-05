"use client";

import { useMemo } from "react";
import { Bold, Italic } from "lucide-react";
import { computeLayout } from "@mogram/core/layout";
import type { Component, Tone } from "@mogram/core/model";
import {
  FONT_LABELS,
  FONT_NAMES,
  LINE_PATTERNS,
  LINE_PATTERN_LABELS,
  SHAPES,
  SHAPE_ADJUST,
  SHAPE_INFO,
  TONES,
  TONE_NAMES,
  formatPaint,
  shapeParam,
  type FontName,
  type LinePattern,
  type ShapeId,
  type TextAlign,
} from "@mogram/core/presets";
import { ColorPicker } from "@/components/ui/color/color-picker";
import { SwatchFace } from "@/components/ui/color/swatch";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useEditor } from "../editor-context";
import { ShapeThumb } from "../library/shapes-section";
import { documentColors } from "./document-colors";
import { ColorField, FieldRow, FieldStack, InspectorSection, NumberField } from "./fields";
import { useEdit } from "./shared";

const TONE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "Neutral",
  blue: "Blue",
  green: "Green",
  amber: "Amber",
  orange: "Orange",
  rose: "Rose",
  violet: "Violet",
};

/** Which outline a shape is drawn with; the label, state and connections stay. */
export function ShapePicker({ component }: { component: Component }) {
  const { set } = useEdit();
  const value = component.shape;
  if (value === null) return null;
  return (
    <div role="radiogroup" aria-label="Shape" className="grid grid-cols-4 gap-1.5">
      {SHAPES.map((shape) => (
        <button
          key={shape}
          type="button"
          role="radio"
          aria-checked={value === shape}
          aria-label={SHAPE_INFO[shape].label}
          title={`${SHAPE_INFO[shape].label} — ${SHAPE_INFO[shape].description}`}
          onClick={() => set(component.name, { shape }, "Change shape")}
          className={cn(
            "flex h-10 items-center justify-center rounded-md border text-fg-soft transition-colors",
            value === shape
              ? "border-fill-strong bg-fill-active text-fg"
              : "border-border-muted bg-fill-faint hover:bg-fill-hover",
          )}
        >
          <ShapeThumb shape={shape as ShapeId} className="h-5 w-8" />
        </button>
      ))}
    </div>
  );
}

/**
 * How a shape looks (03-shapes-styles-library §5 P0-2): its tone, fill, outline, corners,
 * shadow and opacity, and how its label is set. Each control writes one key, and only when it
 * differs from the default.
 */
export function ShapeStyle({ component }: { component: Component }) {
  const { set } = useEdit();
  const diagram = useEditor((s) => s.parsed().diagram);
  const colors = useMemo(() => documentColors(diagram), [diagram]);
  const layout = useMemo(() => computeLayout(diagram), [diagram]);
  const look = component.look;
  const shape = component.shape;
  if (look === null || shape === null) return null;
  const name = component.name;
  const text = look.text;
  // Its one adjustable measure (corners, lid, slant or wave), which the canvas handle drags too.
  const box = layout.elements.get(name)?.box ?? { w: 120, h: 64 };
  const adjust = SHAPE_ADJUST[shape];
  const measure = shapeParam(shape, box.w, box.h, look);
  return (
    <>
      <InspectorSection id="tone" title="Tone">
        <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-1.5">
          {TONE_NAMES.map((tone) => (
            <button
              key={tone}
              type="button"
              role="radio"
              aria-checked={look.tone === tone}
              aria-label={TONE_LABELS[tone]}
              title={TONE_LABELS[tone]}
              onClick={() => set(name, { tone }, "Change tone")}
              className={cn(
                "size-7 rounded-full border-2 transition-transform hover:scale-110",
                look.tone === tone ? "border-fg" : "border-transparent",
              )}
              style={{ background: TONES[tone].dark.solid }}
            />
          ))}
        </div>
        <p className="mt-2 text-caption text-fg-muted">
          The tone colours the fill, outline and words together, in light and dark themes.
        </p>
      </InspectorSection>
      <InspectorSection id="fill" title="Fill and outline">
        <FieldStack>
          <FieldRow label="Fill">
            <ColorPicker
              label="Fill"
              value={look.fill}
              gradients
              none="From the tone"
              documentColors={colors}
              onChange={(paint, live) =>
                set(name, { fill: paint === null ? null : formatPaint(paint) }, "Change fill", {
                  coalesce: live,
                })
              }
            >
              <button
                type="button"
                aria-label="Fill colour"
                className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md bg-fill-field px-2 text-label text-fg-soft hover:bg-fill-hover"
              >
                {look.fill === null ? (
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-sm"
                    style={{ background: TONES[look.tone].dark.fill }}
                  />
                ) : (
                  <SwatchFace paint={look.fill} className="size-4 shrink-0 rounded-sm" />
                )}
                <span className="truncate">
                  {look.fill === null
                    ? "From the tone"
                    : look.fill.kind === "solid"
                      ? look.fill.color
                      : "Gradient"}
                </span>
              </button>
            </ColorPicker>
          </FieldRow>
          <FieldRow label="Outline">
            <Switch
              aria-label="Draw the outline"
              checked={look.stroke !== "none"}
              onCheckedChange={(on) =>
                set(name, { stroke: on ? null : "none" }, on ? "Show outline" : "Hide outline")
              }
            />
          </FieldRow>
          {look.stroke !== "none" ? (
            <>
              <FieldRow label="Colour">
                <ColorField
                  label="Outline colour"
                  value={look.stroke}
                  onChange={(stroke, live) =>
                    set(name, { stroke }, "Change outline", { coalesce: live })
                  }
                />
              </FieldRow>
              <FieldRow label="Width">
                <Select
                  label="Outline width"
                  value={String(look.strokeWidth)}
                  onChange={(width) => set(name, { stroke_width: Number(width) })}
                  options={["0.5", "1", "1.5", "2", "3", "4", "6", "8"].map((w) => ({
                    value: w,
                    label: `${w} px`,
                  }))}
                />
              </FieldRow>
              <FieldRow label="Pattern">
                <Select
                  label="Outline pattern"
                  value={look.dash}
                  onChange={(dash) => set(name, { dash: dash as LinePattern })}
                  options={LINE_PATTERNS.map((pattern) => ({
                    value: pattern,
                    label: LINE_PATTERN_LABELS[pattern],
                  }))}
                />
              </FieldRow>
            </>
          ) : null}
          {adjust !== undefined && measure !== null ? (
            <FieldRow label={adjust.label}>
              <NumberField
                label={adjust.key === "corner" ? "Radius" : adjust.label}
                suffix="px"
                min={0}
                max={Math.floor(adjust.max(box.w, box.h))}
                value={Math.round(measure.value)}
                onCommit={(value, step) =>
                  set(
                    name,
                    { [adjust.key]: value },
                    step ? `Step ${adjust.key}` : `Change ${adjust.label.toLowerCase()}`,
                    { coalesce: step },
                  )
                }
              />
            </FieldRow>
          ) : null}
          <FieldRow label="Shadow">
            <Switch
              aria-label="Shadow"
              checked={look.shadow}
              onCheckedChange={(shadow) => set(name, { shadow }, "Change shadow")}
            />
          </FieldRow>
          <FieldRow label="Opacity">
            <NumberField
              label="Opacity"
              suffix="%"
              min={0}
              max={100}
              value={look.opacity}
              onCommit={(opacity, step) =>
                set(name, { opacity }, step ? "Step opacity" : "Change opacity", {
                  coalesce: step,
                })
              }
            />
          </FieldRow>
        </FieldStack>
      </InspectorSection>
      <InspectorSection id="typography" title="Label">
        <FieldStack>
          <FieldRow label="Font">
            <Select
              label="Font"
              value={text.font ?? "inter"}
              onChange={(font) => set(name, { font: font === "inter" ? null : font })}
              options={FONT_NAMES.map((font) => ({
                value: font,
                label: FONT_LABELS[font as FontName],
              }))}
            />
          </FieldRow>
          <FieldRow label="Size">
            <NumberField
              label="Size"
              suffix="px"
              min={6}
              max={200}
              value={text.fontSize ?? 13}
              onCommit={(size, step) =>
                set(name, { font_size: size === 13 ? null : size }, "Change label size", {
                  coalesce: step,
                })
              }
            />
          </FieldRow>
          <FieldRow label="Format">
            <div className="flex w-full items-center gap-1">
              <IconButton
                label="Bold"
                size="sm"
                active={text.bold}
                onClick={() => set(name, { bold: !text.bold })}
              >
                <Bold />
              </IconButton>
              <IconButton
                label="Italic"
                size="sm"
                active={text.italic}
                onClick={() => set(name, { italic: !text.italic })}
              >
                <Italic />
              </IconButton>
              <span className="flex-1" />
              <SegmentedControl
                label="Label alignment"
                size="sm"
                value={text.align}
                onChange={(align: TextAlign) => set(name, { align })}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Centre" },
                  { value: "right", label: "Right" },
                ]}
              />
            </div>
          </FieldRow>
          <FieldRow label="Colour">
            <ColorField
              label="Label colour"
              value={text.color}
              onChange={(color, live) =>
                set(name, { text_color: color }, "Change label colour", { coalesce: live })
              }
            />
          </FieldRow>
        </FieldStack>
      </InspectorSection>
    </>
  );
}
