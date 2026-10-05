"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  forceLinting,
  lintGutter,
  linter,
  type Diagnostic as CmDiagnostic,
} from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export interface LineDiagnostic {
  readonly line: number;
  readonly severity: "error" | "warning";
  readonly message: string;
}

/** Eden-styled editor theme, using the design tokens (no raw colours here). */
const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "12.5px",
      backgroundColor: "transparent",
      color: "var(--color-fg-soft)",
    },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.65" },
    ".cm-content": { caretColor: "var(--color-fg)", padding: "10px 0" },
    // Opaque (the panel's colour) so text scrolled sideways passes under the line numbers.
    ".cm-gutters": {
      backgroundColor: "var(--color-sidebar)",
      color: "var(--color-fg-ghost)",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "var(--color-fill-faint)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-fg-secondary)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "var(--color-fill-active) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--color-fg)" },
    "&.cm-focused": { outline: "none" },
    ".cm-tooltip": {
      backgroundColor: "var(--color-card)",
      border: "1px solid var(--color-border)",
      borderRadius: "10px",
      color: "var(--color-fg)",
    },
    ".cm-diagnostic": { fontFamily: "var(--font-sans)", fontSize: "12px", padding: "6px 10px" },
    ".cm-diagnostic-error": { borderLeft: "3px solid var(--color-rose)" },
    ".cm-diagnostic-warning": { borderLeft: "3px solid var(--color-amber)" },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--color-rose)",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--color-amber)",
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: "var(--color-fg)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-green)" },
  { tag: [tags.number, tags.integer], color: "var(--color-amber)" },
  { tag: [tags.bool, tags.null, tags.keyword], color: "var(--color-violet)" },
  { tag: [tags.comment, tags.lineComment], color: "var(--color-fg-muted)", fontStyle: "italic" },
  {
    tag: [tags.punctuation, tags.separator, tags.bracket, tags.squareBracket, tags.brace],
    color: "var(--color-fg-faint)",
  },
  { tag: [tags.labelName, tags.atom], color: "var(--color-orange)" },
]);

/**
 * A YAML editor for one project file. `value` changes from outside (canvas edits) update the
 * document unless the user is typing here; local edits are reported through `onChange`.
 */
export function YamlEditor({
  value,
  onChange,
  diagnostics,
  readOnly = false,
  label,
  language = "yaml",
  reveal = null,
}: {
  value: string;
  onChange: (value: string) => void;
  diagnostics: readonly LineDiagnostic[];
  readOnly?: boolean;
  label: string;
  language?: "yaml" | "markdown";
  /** A line to select and scroll to ("Show in YAML"); a new object each time it's asked for. */
  reveal?: { readonly line: number } | null;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  const lint = useRef(diagnostics);
  const readOnlyCompartment = useRef(new Compartment());
  useEffect(() => {
    change.current = onChange;
    lint.current = diagnostics;
  });

  useEffect(() => {
    if (host.current === null) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          ...(language === "yaml" ? [yaml()] : []),
          syntaxHighlighting(highlight),
          theme,
          lintGutter(),
          linter(
            (v): CmDiagnostic[] =>
              lint.current.flatMap((d) => {
                if (d.line < 1 || d.line > v.state.doc.lines) return [];
                const line = v.state.doc.line(d.line);
                return [
                  {
                    from: line.from,
                    to: Math.max(line.from, line.to),
                    severity: d.severity,
                    message: d.message,
                  },
                ];
              }),
            { delay: 150 },
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorState.tabSize.of(2),
          readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              update.transactions.some(
                (t) =>
                  t.isUserEvent("input") ||
                  t.isUserEvent("delete") ||
                  t.isUserEvent("undo") ||
                  t.isUserEvent("redo") ||
                  t.isUserEvent("move"),
              )
            ) {
              change.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once per file; later value changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  // External changes (from the canvas) replace the document unless it already matches.
  useEffect(() => {
    const editor = view.current;
    if (editor === null) return;
    const current = editor.state.doc.toString();
    if (current !== value && !editor.hasFocus) {
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (editor === null || reveal === null) return;
    const doc = editor.state.doc;
    if (reveal.line < 1 || reveal.line > doc.lines) return;
    const line = doc.line(reveal.line);
    editor.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    editor.focus();
  }, [reveal]);

  // Problems come from parsing every file, so refresh them when they change, not just on typing.
  useEffect(() => {
    if (view.current !== null) forceLinting(view.current);
  }, [diagnostics]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
