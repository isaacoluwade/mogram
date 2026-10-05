import { isScalar, visit, type Node } from "yaml";
import { isValidName } from "../model/names";
import type { DiagnosticSink, Position } from "./diagnostics";
import { didYouMean } from "./suggest";
import {
  isMap,
  isNullish,
  mapEntries,
  positionOf,
  type MapEntry,
  type ParsedFile,
} from "./yaml-read";

/**
 * Named styles (03-shapes-styles-library §4, draw.io's named styles): a top-level `styles:`
 * section of looks that elements take with `style: name`. An element's own keys win over its
 * style's, and each kind takes only the keys that mean something for it, so one style can serve
 * shapes and connections alike. Notes and text keep `style:` for their text style (title, body…).
 */

export type StyleTarget = "component" | "shape" | "container" | "connection";

/** A shape's look keys (and the motion keys it shares with components). */
const SHAPE_STYLE_KEYS: readonly string[] = [
  "color",
  "motion",
  "intensity",
  "speed",
  "tone",
  "fill",
  "stroke",
  "stroke_width",
  "dash",
  "corner",
  "lid",
  "slant",
  "wave",
  "shadow",
  "opacity",
  "font",
  "font_size",
  "bold",
  "italic",
  "align",
  "text_color",
];

/** The keys that set how each kind looks — never what it is, where it sits or what it says. */
export const STYLE_KEYS: Readonly<Record<StyleTarget, readonly string[]>> = {
  shape: SHAPE_STYLE_KEYS,
  component: ["color", "motion", "intensity", "speed"],
  container: ["color"],
  connection: [
    "color",
    "route",
    "arrows",
    "arrow_size",
    "line",
    "width",
    "corners",
    "jumps",
    "speed",
    "density",
  ],
};

const ANY_STYLE_KEY: readonly string[] = [...new Set(Object.values(STYLE_KEYS).flat())];

export interface NamedStyle {
  readonly name: string;
  readonly at: Position;
  readonly entries: ReadonlyMap<string, MapEntry>;
}

export type NamedStyles = ReadonlyMap<string, NamedStyle>;

/**
 * The file each style value was written in. A style is read with every element that takes it,
 * maybe from another file, so its problems are reported where the style is, and only once.
 */
export const STYLE_SOURCES = new WeakMap<Node, ParsedFile>();

/** Every file's `styles:`, read before any element so a style can be used from any file. */
export function readStyles(files: readonly ParsedFile[], sink: DiagnosticSink): NamedStyles {
  const styles = new Map<string, NamedStyle>();
  for (const file of files) {
    const root = file.doc.contents;
    if (file.broken || !isMap(root)) continue;
    // Only `styles:` here: the file's other keys are checked (once) when the file is read.
    for (const pair of root.items) {
      const keyNode = pair.key as Node | null;
      if (!isScalar(keyNode) || keyNode.value !== "styles") continue;
      const section = { key: "styles", keyNode, value: (pair.value as Node | null) ?? null };
      if (isNullish(section.value)) continue;
      if (!isMap(section.value)) {
        sink.error(
          positionOf(file, section.keyNode),
          `"styles" should be named looks, like "critical: { tone: rose, stroke_width: 2 }".`,
        );
        continue;
      }
      for (const style of mapEntries(file, section.value, sink)) {
        const at = positionOf(file, style.keyNode);
        if (!isValidName(style.key)) {
          sink.error(
            at,
            `"${style.key}" isn't a valid style name. Use letters, numbers, "_" or "-".`,
          );
          continue;
        }
        const existing = styles.get(style.key);
        if (existing !== undefined) {
          sink.error(
            at,
            `Style "${style.key}" is also in ${existing.at.file} (line ${existing.at.line}). Keep just one.`,
          );
          continue;
        }
        const entries = new Map<string, MapEntry>();
        if (!isNullish(style.value)) {
          if (!isMap(style.value)) {
            sink.error(
              at,
              `Style "${style.key}" should list its keys below it, like "{ tone: rose, shadow: true }".`,
            );
            continue;
          }
          for (const entry of mapEntries(file, style.value, sink)) {
            if (!ANY_STYLE_KEY.includes(entry.key)) {
              sink.warning(
                positionOf(file, entry.keyNode),
                `"${entry.key}" isn't a style key, so style "${style.key}" ignores it.${didYouMean(entry.key, ANY_STYLE_KEY)}`,
              );
              continue;
            }
            if (entry.value !== null)
              visit(entry.value, (_, node) => {
                if (node !== null && typeof node === "object" && "range" in node)
                  STYLE_SOURCES.set(node as Node, file);
              });
            STYLE_SOURCES.set(entry.keyNode, file);
            entries.set(entry.key, entry);
          }
        }
        styles.set(style.key, { name: style.key, at, entries });
      }
    }
  }
  return styles;
}
