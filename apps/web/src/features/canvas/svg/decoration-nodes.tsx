"use client";

import { Fragment, memo } from "react";
import type { Box } from "@mogram/core/layout";
import { NOTE_FILL, noteInk, solid, TONES, type TextAlign } from "@mogram/core/presets";
import { BOLD_WEIGHT, lineOffset, type RichLayout } from "../rich-text";
import { NOTE_PADDING, type SceneDecoration, type SceneGroup } from "../scene";
import { measure } from "../text";
import type { CanvasTheme } from "../theme";
import { PaintGradient, paintFill } from "./paint-gradient";
import { focusOpacity, useRender } from "./render-context";

/** Dashed boundary around members that span containers (ED-15). */
export const GroupNode = memo(function GroupNode({ group }: { group: SceneGroup }) {
  const settings = useRender();
  const { theme, fontFamily } = settings;
  const width = measure(group.label, 11, 500) + 16;
  return (
    <g data-element={group.name} data-kind="group" opacity={focusOpacity(settings, group.name)}>
      <rect
        x={group.box.x}
        y={group.box.y}
        width={group.box.w}
        height={group.box.h}
        rx={18}
        fill="none"
        stroke={theme.textMuted}
        strokeOpacity={0.6}
        strokeWidth={1.2}
        strokeDasharray="6 5"
      />
      <g transform={`translate(${group.box.x + 16} ${group.box.y})`}>
        <rect
          x={0}
          y={-10}
          width={width}
          height={20}
          rx={10}
          fill={theme.base}
          stroke={theme.tileBorder}
        />
        <text
          x={width / 2}
          y={4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={500}
          fill={theme.textMuted}
          style={{ fontFamily }}
        >
          {group.label}
        </text>
      </g>
    </g>
  );
});

/** Highlight zone (ED-22): a tinted area with an optional label, behind the architecture. */
export const ZoneNode = memo(function ZoneNode({ zone }: { zone: SceneDecoration }) {
  const settings = useRender();
  const { theme, fontFamily } = settings;
  const colors = TONES[zone.tone][theme.mode];
  return (
    <g data-element={zone.name} data-kind="decoration" opacity={focusOpacity(settings, zone.name)}>
      <rect
        x={zone.box.x}
        y={zone.box.y}
        width={zone.box.w}
        height={zone.box.h}
        rx={12}
        fill={colors.fill}
        stroke={colors.border}
        strokeDasharray="5 4"
      />
      {zone.text.length > 0 ? (
        <text
          x={zone.box.x + 12}
          y={zone.box.y + 20}
          fontSize={11.5}
          fontWeight={500}
          fill={colors.text}
          style={{ fontFamily }}
        >
          {zone.text}
        </text>
      ) : null}
    </g>
  );
});

/** Free text and labels (ED-22). */
export const TextNode = memo(function TextNode({ item }: { item: SceneDecoration }) {
  const settings = useRender();
  const { theme, fontFamily } = settings;
  const colors = TONES[item.tone][theme.mode];
  if (item.variant === "label") {
    const width = measure(item.text, 12, 500) + 22;
    return (
      <g
        data-element={item.name}
        data-kind="decoration"
        opacity={focusOpacity(settings, item.name)}
      >
        <rect
          x={item.box.x}
          y={item.box.y}
          width={width}
          height={24}
          rx={12}
          fill={colors.fill}
          stroke={colors.border}
        />
        <text
          x={item.box.x + width / 2}
          y={item.box.y + 16}
          textAnchor="middle"
          fontSize={12}
          fontWeight={500}
          fill={colors.text}
          style={{ fontFamily }}
        >
          {item.text}
        </text>
      </g>
    );
  }
  const color = decorationInk(item, theme);
  return (
    <g data-element={item.name} data-kind="decoration" opacity={focusOpacity(settings, item.name)}>
      {item.rich === null || settings.editingText === item.name ? null : (
        <RichText
          rich={item.rich}
          box={item.box}
          align={item.look?.align ?? "left"}
          color={color}
          family={item.family ?? fontFamily}
        />
      )}
    </g>
  );
});

/** A sticky note (ED-25): a coloured square of rich text, above the architecture. */
export const NoteNode = memo(function NoteNode({ note }: { note: SceneDecoration }) {
  const settings = useRender();
  const { box } = note;
  const fill = note.fill ?? solid(NOTE_FILL);
  const gradientId = `${settings.ids.background}-note-${note.name}`;
  const ink = decorationInk(note, settings.theme);
  const inner = {
    x: box.x + NOTE_PADDING,
    y: box.y + NOTE_PADDING,
    w: box.w - NOTE_PADDING * 2,
    h: box.h - NOTE_PADDING * 2,
  };
  const clipId = `${gradientId}-clip`;
  return (
    <g data-element={note.name} data-kind="decoration" opacity={focusOpacity(settings, note.name)}>
      <defs>
        <PaintGradient paint={fill} box={box} id={gradientId} />
        <clipPath id={clipId}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} />
        </clipPath>
      </defs>
      {/* A soft lift off the canvas: two offset shadows, cheaper than a blur filter. */}
      <rect
        x={box.x + 1}
        y={box.y + 4}
        width={box.w - 2}
        height={box.h}
        rx={4}
        fill="black"
        fillOpacity={0.06}
      />
      <rect
        x={box.x}
        y={box.y + 1.5}
        width={box.w}
        height={box.h}
        rx={4}
        fill="black"
        fillOpacity={0.1}
      />
      <rect
        data-part="fill"
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        fill={paintFill(fill, gradientId)}
      />
      {note.rich === null || settings.editingText === note.name ? null : (
        <g clipPath={`url(#${clipId})`}>
          <RichText
            rich={note.rich}
            box={inner}
            align={note.look?.align ?? "left"}
            color={ink}
            family={note.family ?? settings.fontFamily}
          />
        </g>
      )}
    </g>
  );
});

/** The colour of a text's or note's words: its own, else from its tone or against its fill. */
export function decorationInk(item: SceneDecoration, theme: CanvasTheme): string {
  if (item.look?.color != null) return item.look.color;
  if (item.variant === "note") return noteInk(item.fill ?? solid(NOTE_FILL));
  if (item.tone !== "neutral") return TONES[item.tone][theme.mode].text;
  return item.style === "caption" ? theme.textMuted : theme.text;
}

/** Laid-out rich text: one <text> with a positioned <tspan> per line piece. */
function RichText({
  rich,
  box,
  align,
  color,
  family,
}: {
  rich: RichLayout;
  box: Box;
  align: TextAlign;
  color: string;
  family: string;
}) {
  const width = Number.isFinite(box.w) ? box.w : rich.width;
  return (
    <text
      fontSize={rich.fontSize}
      fontWeight={rich.weight}
      letterSpacing={rich.tracking === 0 ? undefined : rich.tracking}
      fill={color}
      style={{ fontFamily: family }}
    >
      {rich.lines.map((line, index) => {
        const left = box.x + lineOffset(line, align, width);
        const y = box.y + index * rich.lineHeight + rich.lineHeight / 2;
        return (
          <Fragment key={index}>
            {line.marker === null ? null : (
              <tspan x={left} y={y} dy="0.35em">
                {line.marker}
              </tspan>
            )}
            {line.segments.map((segment, part) => (
              <tspan
                key={part}
                x={left + line.indent + segment.x}
                y={y}
                dy="0.35em"
                fontWeight={segment.bold ? BOLD_WEIGHT : undefined}
                fontStyle={segment.italic ? "italic" : undefined}
              >
                {segment.text}
              </tspan>
            ))}
          </Fragment>
        );
      })}
    </text>
  );
}
