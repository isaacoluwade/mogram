"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Italic, List } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { Decoration } from "@mogram/core/model";
import {
  FONT_LABELS,
  FONT_NAMES,
  FONT_SIZES,
  NOTE_COLORS,
  NOTE_FILL,
  formatPaint,
  noteInk,
  solid,
  type FontName,
  type Paint,
  type TextAlign,
} from "@mogram/core/presets";
import { textStyleSize } from "@mogram/core/layout";
import { ColorPicker } from "@/components/ui/color/color-picker";
import { SwatchFace } from "@/components/ui/color/swatch";
import { IconButton } from "@/components/ui/icon-button";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { fontStack } from "@/features/canvas/fonts";
import { cn } from "@/lib/cn";
import { activeTextCommands } from "./canvas/text-editor";
import { useEditor } from "./editor-context";
import { shortcutLabel } from "./commands/keys";
import { documentColors } from "./inspector/document-colors";
import { useEdit } from "./inspector/shared";

/**
 * Typography and colour controls for free text and sticky notes (ED-25), shared by the floating
 * quick-edit bar and the inspector so both change the same keys the same way.
 */

export type RichDecoration = Extract<Decoration, { variant: "text" | "note" }>;

export function isRich(decoration: Decoration | undefined): decoration is RichDecoration {
  return decoration?.variant === "text" || decoration?.variant === "note";
}

const ALIGN_ICONS: Readonly<Record<TextAlign, ReactNode>> = {
  left: <AlignLeft />,
  center: <AlignCenter />,
  right: <AlignRight />,
};
const ALIGN_LABELS: Readonly<Record<TextAlign, string>> = {
  left: "Align left",
  center: "Align centre",
  right: "Align right",
};

/** Keeps the canvas text field focused when a bar button is pressed while typing. */
const keepFocus = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault();

function useLookEditor(decoration: RichDecoration) {
  const { set } = useEdit();
  const name = decoration.name;
  return {
    set: (values: Record<string, string | number | boolean | null>, label: string) =>
      set(name, values, label),
    look: decoration.look,
  };
}

/** A compact menu trigger for the bar: value text and a chevron. */
export function MenuButton({
  label,
  children,
  className,
  style,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <MenuTrigger
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-label text-fg-soft outline-none transition-colors hover:bg-fill-hover hover:text-fg focus-visible:ring-1 focus-visible:ring-border-emphasis data-[state=open]:bg-fill-active data-[state=open]:text-fg [&_svg]:size-3.5 [&_svg]:text-fg-muted",
        className,
      )}
      style={style}
    >
      {children}
      <ChevronDown />
    </MenuTrigger>
  );
}

export function FontMenu({ decoration }: { decoration: RichDecoration }) {
  const { set, look } = useLookEditor(decoration);
  const fallback: FontName =
    decoration.variant === "text" &&
    (decoration.style === "title" || decoration.style === "heading")
      ? "geist"
      : "inter";
  const current = look.font ?? fallback;
  return (
    <Menu>
      <MenuButton label="Font" style={{ fontFamily: fontStack(current) }} className="min-w-24">
        <span className="truncate">{FONT_LABELS[current]}</span>
      </MenuButton>
      <MenuContent align="start" className="w-52">
        <MenuRadioGroup
          value={look.font ?? "default"}
          onValueChange={(font) => set({ font: font === "default" ? null : font }, "Change font")}
        >
          <MenuRadioItem value="default">Default ({FONT_LABELS[fallback]})</MenuRadioItem>
          {FONT_NAMES.map((font) => (
            <MenuRadioItem key={font} value={font} style={{ fontFamily: fontStack(font) }}>
              {FONT_LABELS[font]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function FontSizeMenu({ decoration }: { decoration: RichDecoration }) {
  const { set, look } = useLookEditor(decoration);
  const automatic =
    decoration.variant === "note" ? "Auto" : `${textStyleSize(decoration.style)} (style)`;
  return (
    <Menu>
      <MenuButton label="Font size" className="min-w-16 tabular-nums">
        {look.fontSize === null ? (decoration.variant === "note" ? "Auto" : "Size") : look.fontSize}
      </MenuButton>
      <MenuContent align="start" className="max-h-80 w-40 overflow-y-auto">
        <MenuRadioGroup
          value={look.fontSize === null ? "auto" : String(look.fontSize)}
          onValueChange={(size) =>
            set({ font_size: size === "auto" ? null : Number(size) }, "Change font size")
          }
        >
          <MenuRadioItem value="auto">{automatic}</MenuRadioItem>
          {FONT_SIZES.map((size) => (
            <MenuRadioItem key={size} value={String(size)}>
              {size}
            </MenuRadioItem>
          ))}
          {look.fontSize !== null && !(FONT_SIZES as readonly number[]).includes(look.fontSize) ? (
            <MenuRadioItem value={String(look.fontSize)}>{look.fontSize}</MenuRadioItem>
          ) : null}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** Bold and italic: the selected words while typing, otherwise the whole text. */
export function EmphasisButtons({ decoration }: { decoration: RichDecoration }) {
  const { set, look } = useLookEditor(decoration);
  const typing = useEditor((s) => s.editingLabel === decoration.name);
  const toggle = (key: "bold" | "italic") => {
    const commands = activeTextCommands.current;
    if (typing && commands !== null && commands.hasSelection()) {
      commands[key]();
      return;
    }
    set({ [key]: !look[key] }, key === "bold" ? "Toggle bold" : "Toggle italic");
  };
  return (
    <>
      <IconButton
        label="Bold"
        shortcut={shortcutLabel("mod+b")}
        active={look.bold}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={() => toggle("bold")}
      >
        <Bold />
      </IconButton>
      <IconButton
        label="Italic"
        shortcut={shortcutLabel("mod+i")}
        active={look.italic}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={() => toggle("italic")}
      >
        <Italic />
      </IconButton>
    </>
  );
}

/** Lines that all start "- " are a list; the button adds or removes the markers. */
export function isList(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return lines.length > 0 && lines.every((line) => /^\s*[-*•]\s+/.test(line));
}

export function toggleListText(text: string): string {
  const listed = isList(text);
  return text
    .split("\n")
    .map((line) =>
      listed ? line.replace(/^\s*[-*•]\s+/, "") : line.trim().length === 0 ? line : `- ${line}`,
    )
    .join("\n");
}

export function ListButton({ decoration }: { decoration: RichDecoration }) {
  const { set } = useEdit();
  const typing = useEditor((s) => s.editingLabel === decoration.name);
  return (
    <IconButton
      label="Bulleted list"
      shortcut={shortcutLabel("mod+shift+8")}
      active={isList(decoration.text)}
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
      onClick={() => {
        const commands = activeTextCommands.current;
        if (typing && commands !== null) commands.list();
        else set(decoration.name, { label: toggleListText(decoration.text) }, "Toggle list");
      }}
    >
      <List />
    </IconButton>
  );
}

export function AlignMenu({ decoration }: { decoration: RichDecoration }) {
  const { set, look } = useLookEditor(decoration);
  return (
    <Menu>
      <MenuButton label="Alignment">{ALIGN_ICONS[look.align]}</MenuButton>
      <MenuContent align="start" className="w-44">
        <MenuRadioGroup value={look.align} onValueChange={(align) => set({ align }, "Align text")}>
          {(["left", "center", "right"] as const).map((align) => (
            <MenuRadioItem key={align} value={align}>
              <span className="flex items-center gap-2 [&_svg]:size-4">
                {ALIGN_ICONS[align]}
                {ALIGN_LABELS[align]}
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** Alignment as three buttons, for the inspector. */
export function AlignButtons({ decoration }: { decoration: RichDecoration }) {
  const { set, look } = useLookEditor(decoration);
  return (
    <div role="radiogroup" aria-label="Alignment" className="flex items-center gap-0.5">
      {(["left", "center", "right"] as const).map((align) => (
        <IconButton
          key={align}
          role="radio"
          aria-checked={look.align === align}
          label={ALIGN_LABELS[align]}
          size="sm"
          active={look.align === align}
          onClick={() => set({ align }, "Align text")}
        >
          {ALIGN_ICONS[align]}
        </IconButton>
      ))}
    </div>
  );
}

function useDocumentColors(): readonly Paint[] {
  const diagram = useEditor((s) => s.parsed().diagram);
  return useMemo(() => documentColors(diagram), [diagram]);
}

/** A note's fill: note colours first, then everything (gradients too). */
export function NoteFillPicker({
  decoration,
  children,
  side = "bottom",
}: {
  decoration: Extract<Decoration, { variant: "note" }>;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const { set } = useEdit();
  const colors = useDocumentColors();
  return (
    <ColorPicker
      label="Note colour"
      value={decoration.fill}
      gradients
      presets={{ title: "Sticky note colours", colors: NOTE_COLORS }}
      documentColors={colors}
      side={side}
      align="center"
      onChange={(paint, live) =>
        set(
          decoration.name,
          { fill: formatPaint(paint ?? solid(NOTE_FILL)) },
          "Change note colour",
          { coalesce: live },
        )
      }
    >
      {children}
    </ColorPicker>
  );
}

/** The words' colour: their own, or automatic (from the tone, or against a note's fill). */
export function TextColorPicker({
  decoration,
  children,
  side = "bottom",
}: {
  decoration: RichDecoration;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const { set } = useEdit();
  const colors = useDocumentColors();
  const value = decoration.look.color;
  return (
    <ColorPicker
      label="Text colour"
      value={value === null ? null : solid(value)}
      none="Automatic"
      documentColors={colors}
      side={side}
      align="center"
      onChange={(paint, live) =>
        set(
          decoration.name,
          { color: paint === null || paint.kind !== "solid" ? null : paint.color },
          "Change text colour",
          { coalesce: live },
        )
      }
    >
      {children}
    </ColorPicker>
  );
}

/** The colour the words actually show in, for the "A" swatch. */
export function textInk(decoration: RichDecoration, themeText: string): string {
  if (decoration.look.color !== null) return decoration.look.color;
  return decoration.variant === "note" ? noteInk(decoration.fill) : themeText;
}

/** "A" over a bar of the text colour, as text colour buttons usually look. */
export function TextColorFace({ color }: { color: string }) {
  return (
    <span className="flex flex-col items-center leading-none" aria-hidden>
      <span className="text-[13px] font-semibold text-fg">A</span>
      <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function NoteFillFace({ fill }: { fill: Paint }) {
  return <SwatchFace paint={fill} className="size-5 rounded-full" />;
}
