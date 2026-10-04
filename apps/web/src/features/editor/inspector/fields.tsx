"use client";

import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  STATE_INFO,
  STATE_PRESETS,
  TONES,
  normalizeHex,
  paintColors,
  type StatePreset,
} from "@mogram/core/presets";
import { cn } from "@/lib/cn";
import { NEUTRAL_SWATCH } from "@/styles/colors";
import { ColorPicker } from "@/components/ui/color/color-picker";
import { Swatch } from "@/components/ui/color/swatch";
import { useEditor, useEditorStore } from "../editor-context";
import { documentColors } from "./document-colors";

/** Shared inspector building blocks, all composed from the design-system primitives. */

export function InspectorSection({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border-b border-border-subtle px-3.5 py-3 last:border-b-0">
      <div className="mb-2 flex h-5 items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-sans text-caption font-medium text-fg-faint">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Advanced options stay hidden until asked for (ED-21, PR-8). */
export function Advanced({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center gap-2 px-3.5 text-left text-caption font-medium text-fg-faint transition-colors hover:text-fg-soft"
      >
        <span className="flex-1">Advanced</span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <FieldStack className="px-3.5 pb-3.5">{children}</FieldStack> : null}
    </section>
  );
}

/** Rows of labelled fields, spaced so stacked controls never touch. */
export function FieldStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2.5", className)}>{children}</div>;
}

/** Quiet time after the last keystroke before a text field saves what was typed. */
export const SAVE_AFTER_MS = 400;

let typingSessions = 0;

/**
 * A text field that saves as you type: a short pause, leaving the field or Enter writes the value
 * to the diagram, and from there to the autosaved draft. Everything typed in one visit to the
 * field is one undo step, and Escape takes it back. `validate` holds back a value that isn't valid
 * yet (a half-typed name) and says why under the field. With `live={false}` the field saves only
 * when you leave it, for paths where each half-typed step would point somewhere real.
 */
export function CommitInput({
  value,
  onCommit,
  validate,
  live = true,
  placeholder,
  label,
  className,
  mono = false,
  multiline = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  validate?: (value: string) => string | null;
  live?: boolean;
  placeholder?: string;
  label: string;
  className?: string;
  mono?: boolean;
  /** A text area: Enter starts a new line, and ⌘/Ctrl+Enter finishes. */
  multiline?: boolean;
}) {
  const store = useEditorStore();
  const messageId = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  // Out of focus the field shows what is saved; in focus, what is being typed (a save that trims
  // "Web " to "Web" mustn't eat the space before the next word).
  if (!focused && draft !== value) setDraft(value);
  // Text typed and not saved yet, with the save bound to the element it was typed for, so a
  // selection that changes mid-word can never put it on another element.
  const typed = useRef<{ save: () => void; reason: string | null } | null>(null);
  const timer = useRef<number | null>(null);
  const session = useRef<string | null>(null);
  const discard = useRef(false);
  const problem = focused && draft !== value ? (validate?.(draft) ?? null) : null;

  const cancelTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  /** Saves what was typed if it is valid; otherwise returns why not. */
  const saveTyped = (): string | null => {
    cancelTimer();
    const waiting = typed.current;
    typed.current = null;
    if (waiting === null) return null;
    if (waiting.reason === null) waiting.save();
    return waiting.reason;
  };
  const endSession = () => {
    if (session.current !== null) store.getState().stopTyping(session.current);
    session.current = null;
  };

  // Unmounting while typing (the element was deleted, the panel closed) still saves the text.
  useEffect(
    () => () => {
      saveTyped();
      endSession();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on unmount, with the latest refs
    [],
  );

  const fieldProps = {
    "aria-label": label,
    "aria-invalid": problem !== null || undefined,
    "aria-describedby": problem !== null ? messageId : undefined,
    value: draft,
    placeholder,
    onFocus: () => {
      typingSessions += 1;
      session.current = `typing-${typingSessions}`;
      store.getState().startTyping(session.current);
      setFocused(true);
    },
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.target.value;
      setDraft(next);
      cancelTimer();
      typed.current =
        next === value ? null : { save: () => onCommit(next), reason: validate?.(next) ?? null };
      if (live && typed.current?.reason === null) {
        timer.current = window.setTimeout(saveTyped, SAVE_AFTER_MS);
      }
    },
    onBlur: () => {
      if (discard.current) {
        discard.current = false;
        cancelTimer();
        typed.current = null;
      } else {
        const reason = saveTyped();
        if (reason !== null) store.getState().notify(reason, "error");
      }
      endSession();
      setFocused(false);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation();
      if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey))
        event.currentTarget.blur();
      if (event.key === "Escape") {
        // Take back everything saved since the field was focused, then leave it.
        if (session.current !== null) store.getState().revertTyping(session.current);
        discard.current = true;
        event.currentTarget.blur();
      }
    },
    className: cn(
      "w-full min-w-0 rounded-md bg-fill-field px-2.5 text-label text-fg outline-none transition-colors placeholder:text-fg-ghost focus:bg-fill-hover focus-visible:ring-1 focus-visible:ring-border-emphasis",
      multiline ? "min-h-20 resize-y py-1.5 leading-normal" : "h-8",
      problem !== null && "ring-1 ring-rose focus-visible:ring-rose",
      mono && "font-mono text-caption",
      className,
    ),
  };
  const input = multiline ? (
    <textarea rows={Math.min(8, Math.max(3, draft.split("\n").length))} {...fieldProps} />
  ) : (
    <input {...fieldProps} />
  );
  if (validate === undefined) return input;
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      {input}
      {problem !== null ? (
        <p id={messageId} className="text-caption text-rose">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** One-click state presets (SC-2, PR-6) with each state's tone. */
export function StatePicker({
  value,
  onChange,
  label,
}: {
  value: StatePreset;
  onChange: (state: StatePreset) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1.5">
      {STATE_PRESETS.map((preset) => {
        const info = STATE_INFO[preset];
        const selected = value === preset;
        return (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={selected}
            title={info.description}
            onClick={() => onChange(preset)}
            className={cn(
              // Tight enough that the longest state ("Overloaded") fits a third of the panel.
              "flex h-8 min-w-0 items-center gap-1 rounded-md border px-1.5 text-caption font-medium transition-colors",
              selected
                ? "border-fill-strong bg-fill-active text-fg"
                : "border-border-muted bg-fill-faint text-fg-soft hover:bg-fill-hover",
            )}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: TONES[info.look.tone].dark.solid }}
            />
            <span className="truncate">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A grid of named presets (flow, motion) with descriptions as tooltips. */
export function PresetGrid<T extends string>({
  options,
  value,
  onChange,
  label,
  describe,
  dot,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  describe: (value: T) => { label: string; description: string };
  dot?: (value: T) => string | null;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1.5">
      {options.map((option) => {
        const info = describe(option);
        const selected = value === option;
        const color = dot?.(option) ?? null;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            title={info.description}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-caption font-medium transition-colors",
              selected
                ? "border-fill-strong bg-fill-active text-fg"
                : "border-border-muted bg-fill-faint text-fg-soft hover:bg-fill-hover",
            )}
          >
            {color !== null ? (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
            ) : null}
            <span className="truncate">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A labelled control row inside a section. */
export function FieldRow({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <label htmlFor={htmlFor} className="w-[72px] shrink-0 text-caption text-fg-muted">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/**
 * A typed colour: `#abc`, `abc`, `#aabbcc`, `aabbcc`, or the same with opacity (`#aabbcc80`) →
 * `#aabbcc` / `#aabbcc80`; anything else → null.
 */
export function parseHexColor(text: string): string | null {
  const trimmed = text.trim();
  return normalizeHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
}

/**
 * An element's colour override: a swatch that opens the colour picker (with opacity), the hex
 * text, and Reset back to the preset. `live` is true while a picker slider is being dragged, so
 * callers can fold those changes into one undo step.
 */
export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (value: string | null, live: boolean) => void;
  label: string;
}) {
  const diagram = useEditor((s) => s.parsed().diagram);
  const colors = useMemo(() => documentColors(diagram), [diagram]);
  return (
    <div className="flex w-full items-center gap-2">
      <ColorPicker
        label={label}
        value={value === null ? null : { kind: "solid", color: value }}
        none="Preset colour"
        documentColors={colors}
        onChange={(paint, live) =>
          onChange(paint === null ? null : (paintColors(paint)[0] ?? null), live)
        }
      >
        <Swatch
          name={`${label} colour: ${value ?? "preset"}`}
          paint={{ kind: "solid", color: value ?? NEUTRAL_SWATCH }}
          size="md"
          className="rounded-md"
        />
      </ColorPicker>
      <CommitInput
        label={label}
        value={value ?? ""}
        placeholder="Preset colour"
        mono
        live={false}
        onCommit={(next) => {
          // Empty resets to the preset; something that isn't a colour leaves it as it was.
          if (next.trim().length === 0) onChange(null, false);
          else {
            const color = parseHexColor(next);
            if (color !== null && color !== value) onChange(color, false);
          }
        }}
      />
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null, false)}
          className="shrink-0 text-caption text-fg-muted hover:text-fg"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
