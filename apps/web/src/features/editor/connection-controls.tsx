"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronDown, RotateCcw } from "lucide-react";
import {
  resetConnectionPath,
  reverseConnection,
  setConnectionLook,
  setConnectionRoute,
  type ConnectionLook,
} from "@mogram/core/edit";
import type { Connection, RouteStyle } from "@mogram/core/model";
import {
  ARROWHEADS,
  ARROWHEAD_LABELS,
  DEFAULT_ARROW_SIZE,
  JUMP_STYLES,
  LINE_DASHES,
  LINE_PATTERNS,
  LINE_PATTERN_LABELS,
  type Arrowhead,
  type JumpStyle,
  type LinePattern,
} from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { markerShape } from "@/features/canvas/markers";
import { cn } from "@/lib/cn";
import { useEditorStore } from "./editor-context";
import { MenuButton } from "./text-look-controls";

/**
 * Controls for how connections look and run (ED-29), shared by the inspector and the quick-edit
 * bar so both change the same keys the same way. They act on every selected connection.
 */

/** Edits the selected connections' look in one undo step. */
function useLook(names: readonly string[]) {
  const store = useEditorStore();
  return (label: string, look: ConnectionLook) =>
    store
      .getState()
      .edit(label, (files, diagram) => setConnectionLook(files, diagram, { names, look }));
}

/** A small picture of a line ending in `kind` (pointing right, or left for the start). */
export function ArrowheadIcon({ kind, end }: { kind: Arrowhead; end: "start" | "end" }) {
  const shape = markerShape(kind, DEFAULT_ARROW_SIZE, 1.5);
  const tip = end === "end" ? 34 : 6;
  const angle = end === "end" ? 0 : 180;
  const inset = shape?.inset ?? 0;
  return (
    <svg viewBox="0 0 40 16" className="h-4 w-10" aria-hidden>
      <line
        x1={end === "end" ? 4 : tip + inset}
        x2={end === "end" ? tip - inset : 36}
        y1={8}
        y2={8}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {shape !== null ? (
        <path
          d={shape.d}
          transform={`translate(${tip} 8) rotate(${angle})`}
          fill={shape.filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

/** Arrowheads in the order the picker lists them: plain, filled, outline, notation. */
const PICKER_ORDER: readonly Arrowhead[] = ARROWHEADS;

export function ArrowheadPicker({
  names,
  end,
  value,
  compact = false,
  side = "bottom",
}: {
  names: readonly string[];
  end: "start" | "end";
  value: Arrowhead | null;
  compact?: boolean;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = useState(false);
  const apply = useLook(names);
  const label = end === "start" ? "Start arrowhead" : "End arrowhead";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-md text-fg-soft outline-none transition-colors hover:bg-fill-hover hover:text-fg focus-visible:ring-1 focus-visible:ring-border-emphasis data-[state=open]:bg-fill-active [&_svg.lucide]:size-3.5 [&_svg.lucide]:text-fg-muted",
          compact ? "px-1" : "w-full justify-between bg-fill-field px-2",
        )}
      >
        {value === null ? (
          <span className="text-caption text-fg-muted">Mixed</span>
        ) : (
          <ArrowheadIcon kind={value} end={end} />
        )}
        <ChevronDown />
      </PopoverTrigger>
      <PopoverContent side={side} align="start" aria-label={label} className="w-[248px] p-2">
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1">
          {PICKER_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={value === kind}
              aria-label={ARROWHEAD_LABELS[kind]}
              title={ARROWHEAD_LABELS[kind]}
              onClick={() => {
                apply("Change arrowhead", {
                  arrows: end === "start" ? { start: kind } : { end: kind },
                });
                setOpen(false);
              }}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg",
                value === kind && "bg-fill-active text-fg ring-1 ring-border-emphasis",
              )}
            >
              <ArrowheadIcon kind={kind} end={end} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PatternIcon({ pattern }: { pattern: LinePattern }) {
  const dash = LINE_DASHES[pattern];
  return (
    <svg viewBox="0 0 40 8" className="h-2 w-10" aria-hidden>
      <line
        x1={2}
        x2={38}
        y1={4}
        y2={4}
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray={dash === null ? undefined : dash.map((v) => v * 1.33).join(" ")}
        strokeLinecap={pattern === "dotted" || pattern === "dash-dot" ? "round" : "butt"}
      />
    </svg>
  );
}

export function LinePatternSelect({
  names,
  value,
}: {
  names: readonly string[];
  value: LinePattern | null;
}) {
  const apply = useLook(names);
  return (
    <Select
      label="Line pattern"
      value={value ?? "solid"}
      onChange={(line) => apply("Change line", { line, dash: null })}
      options={LINE_PATTERNS.map((pattern) => ({
        value: pattern,
        label: LINE_PATTERN_LABELS[pattern],
        icon: <PatternIcon pattern={pattern} />,
      }))}
    />
  );
}

const WIDTHS = ["0.5", "1", "1.5", "2", "3", "4", "6", "8"] as const;

const JUMP_LABELS: Readonly<Record<JumpStyle, string>> = {
  none: "Cross",
  arc: "Hop over (arc)",
  gap: "Break (gap)",
};

/**
 * The quick bar's line menu: pattern, width and how crossings draw, in one dropdown so the bar
 * stays short (draw.io's inline edge toolbar, 05-ui-shell-commands §8.5).
 */
export function LineStyleMenu({
  names,
  pattern,
  width,
  jumps,
}: {
  names: readonly string[];
  pattern: LinePattern | null;
  width: number | null;
  jumps: JumpStyle | null;
}) {
  const apply = useLook(names);
  return (
    <Menu>
      <MenuButton label="Line style">
        <PatternIcon pattern={pattern ?? "solid"} />
      </MenuButton>
      <MenuContent align="start" className="w-52">
        <MenuLabel>Pattern</MenuLabel>
        <MenuRadioGroup
          value={pattern ?? ""}
          onValueChange={(value) =>
            apply("Change line", { line: value as LinePattern, dash: null })
          }
        >
          {LINE_PATTERNS.map((option) => (
            <MenuRadioItem key={option} value={option} icon={<PatternIcon pattern={option} />}>
              {LINE_PATTERN_LABELS[option]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuLabel>Width</MenuLabel>
        <MenuRadioGroup
          value={width === null ? "" : String(width)}
          onValueChange={(value) => apply("Change line width", { width: Number(value) })}
        >
          {WIDTHS.map((option) => (
            <MenuRadioItem key={option} value={option}>
              {option} px
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuLabel>Crossings</MenuLabel>
        <MenuRadioGroup
          value={jumps ?? ""}
          onValueChange={(value) => apply("Change crossings", { jumps: value as JumpStyle })}
        >
          {JUMP_STYLES.map((option) => (
            <MenuRadioItem key={option} value={option}>
              {JUMP_LABELS[option]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function LineWidthSelect({
  names,
  value,
}: {
  names: readonly string[];
  value: number | null;
}) {
  const apply = useLook(names);
  const current = value === null ? "1.5" : String(value);
  const options = (WIDTHS as readonly string[]).includes(current) ? WIDTHS : [...WIDTHS, current];
  return (
    <Select
      label="Line width"
      value={current}
      onChange={(width) => apply("Change line width", { width: Number(width) })}
      options={options.map((width) => ({ value: width, label: `${width} px` }))}
    />
  );
}

export function ArrowSizeSelect({
  names,
  end,
  value,
}: {
  names: readonly string[];
  end: "start" | "end";
  value: number | null;
}) {
  const apply = useLook(names);
  const current = String(value ?? DEFAULT_ARROW_SIZE);
  const sizes = ["4", "5", "6", "7", "8", "10", "12", "16"];
  const options = sizes.includes(current) ? sizes : [...sizes, current];
  return (
    <Select
      label={end === "start" ? "Start arrowhead size" : "End arrowhead size"}
      value={current}
      onChange={(size) =>
        apply("Change arrowhead size", {
          arrowSize: end === "start" ? { start: Number(size) } : { end: Number(size) },
        })
      }
      options={options.map((size) => ({ value: size, label: size }))}
    />
  );
}

/** Route icons: an elbowed line, a curve and a straight line. */
const ROUTE_ICONS: Readonly<Record<RouteStyle, ReactNode>> = {
  orthogonal: (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path d="M2 13 H8 V3 H14" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  ),
  curved: (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path d="M2 13 C8 13 8 3 14 3" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  ),
  straight: (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path d="M2 13 L14 3" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  ),
};

export const ROUTE_LABELS: Readonly<Record<RouteStyle, string>> = {
  orthogonal: "Orthogonal",
  curved: "Curved",
  straight: "Straight",
};

export function RouteControl({
  names,
  value,
}: {
  names: readonly string[];
  value: RouteStyle | null;
}) {
  const store = useEditorStore();
  return (
    <SegmentedControl
      label="Route"
      size="sm"
      value={value ?? "orthogonal"}
      onChange={(route) =>
        store
          .getState()
          .edit("Change route", (files, diagram) =>
            setConnectionRoute(files, diagram, { names, route }),
          )
      }
      options={(["orthogonal", "curved", "straight"] as const).map((route) => ({
        value: route,
        label: ROUTE_ICONS[route],
        ariaLabel: ROUTE_LABELS[route],
      }))}
    />
  );
}

export function ReverseButton({
  names,
  compact = false,
}: {
  names: readonly string[];
  compact?: boolean;
}) {
  const store = useEditorStore();
  return (
    <Button
      variant="ghost"
      size="sm"
      title="Reverse direction (⌘R)"
      aria-label="Reverse direction"
      onClick={() =>
        store
          .getState()
          .edit("Reverse connection", (files, diagram) =>
            reverseConnection(files, diagram, { names }),
          )
      }
    >
      <ArrowLeftRight />
      {compact ? null : "Reverse"}
    </Button>
  );
}

export function ResetPathButton({
  names,
  anchors = false,
}: {
  names: readonly string[];
  anchors?: boolean;
}) {
  const store = useEditorStore();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        store
          .getState()
          .edit(anchors ? "Reset connection ends" : "Clear bends", (files, diagram) =>
            resetConnectionPath(files, diagram, { names, anchors }),
          )
      }
    >
      <RotateCcw />
      {anchors ? "Free the ends" : "Clear bends"}
    </Button>
  );
}

/** One value shared by every connection, or null when they differ. */
export function common<T>(
  connections: readonly Connection[],
  pick: (c: Connection) => T,
): T | null {
  const first = connections[0];
  if (first === undefined) return null;
  const value = pick(first);
  return connections.every((c) => pick(c) === value) ? value : null;
}
