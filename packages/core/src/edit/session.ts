import {
  Document,
  Pair,
  Scalar,
  YAMLMap,
  YAMLSeq,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Node,
} from "yaml";
import type { Diagram, GridPoint, GridSize, ProjectFiles } from "../model/types";
import { YAML_PARSE_OPTIONS } from "../format/yaml-read";
import { detectStyle, patchOriginal, printDocument, type FileStyle } from "./patch";

/** A user-facing reason an edit can't be applied. Messages are plain language. */
export class EditError extends Error {
  override readonly name = "EditError";
}

/** Top-level keys in the order Mogram writes them: architecture first, layout last (FI-4). */
const SECTION_ORDER = [
  "mogram",
  "name",
  "description",
  "theme",
  "background",
  "grid",
  "libraries",
  "ports",
  "containers",
  "components",
  "groups",
  "connections",
  "scenes",
  "tours",
  "layout",
] as const;

function sectionRank(key: string): number {
  const index = (SECTION_ORDER as readonly string[]).indexOf(key);
  // Unknown keys stay with the architecture, before scenes/tours/layout.
  return index === -1 ? SECTION_ORDER.indexOf("connections") + 0.5 : index;
}

interface OpenDoc {
  readonly doc: Document;
  readonly original: string | null;
  readonly style: FileStyle;
  readonly before: string;
}

/**
 * Holds the YAML documents touched by one edit and writes them back with minimal diffs.
 * Commands use it to read and change the files; `commit()` produces the new file map.
 */
export class EditSession {
  private readonly docs = new Map<string, OpenDoc>();
  private readonly raw = new Map<string, string | null>();

  constructor(
    readonly files: ProjectFiles,
    readonly diagram: Diagram,
  ) {}

  /** The parsed document for `path`, created empty if the file doesn't exist yet. */
  doc(path: string): Document {
    const open = this.docs.get(path);
    if (open !== undefined) return open.doc;
    const original = this.raw.has(path) ? (this.raw.get(path) ?? null) : (this.files[path] ?? null);
    let doc: Document;
    if (original === null) {
      doc = new Document(new YAMLMap());
    } else {
      doc = parseDocument(original, YAML_PARSE_OPTIONS);
      const error = doc.errors[0];
      if (error !== undefined) {
        throw new EditError(
          `${path} has a YAML error (${error.message.split("\n")[0] ?? "invalid YAML"}). Fix it in the code view, then try again.`,
        );
      }
      if (doc.contents === null) doc.contents = new YAMLMap();
      if (!isMap(doc.contents)) throw new EditError(`${path} isn't a Mogram file Mogram can edit.`);
    }
    const style = detectStyle(original ?? "");
    this.docs.set(path, {
      doc,
      original,
      style,
      before: original === null ? "" : printDocument(doc, style),
    });
    return doc;
  }

  root(path: string): YAMLMap {
    const contents = this.doc(path).contents;
    if (!isMap(contents)) throw new EditError(`${path} isn't a Mogram file Mogram can edit.`);
    return contents;
  }

  /** A top-level section map, inserted in canonical order when missing. */
  section(path: string, key: string): YAMLMap {
    const root = this.root(path);
    const existing = root.get(key, true) as Node | undefined;
    if (isMap(existing)) return existing;
    const map = new YAMLMap();
    if (existing !== undefined) {
      // `components:` with nothing under it parses as null; replace in place.
      root.set(key, map);
      return map;
    }
    const keyNode = new Scalar(key);
    const pair = new Pair(keyNode, map);
    const rank = sectionRank(key);
    const index = root.items.findIndex(
      (item) => isScalar(item.key) && sectionRank(String(item.key.value)) > rank,
    );
    if (root.items.length > 0) keyNode.spaceBefore = true;
    if (index === -1) {
      root.items.push(pair);
    } else {
      const next = root.items[index];
      if (index === 0 && next !== undefined && isScalar(next.key)) next.key.spaceBefore = true;
      root.items.splice(index, 0, pair);
    }
    return map;
  }

  /** A section if it exists, without creating it. */
  findSection(path: string, key: string): YAMLMap | null {
    if (this.files[path] === undefined && !this.docs.has(path)) return null;
    const node = this.root(path).get(key, true) as Node | undefined;
    return isMap(node) ? node : null;
  }

  /** Writes a non-YAML file (card markdown, uploaded icon) or deletes it with `null`. */
  writeRaw(path: string, content: string | null): void {
    this.raw.set(path, content);
  }

  commit(): Record<string, string> {
    const next = new Map<string, string>(Object.entries(this.files));
    for (const [path, content] of this.raw) {
      if (this.docs.has(path)) continue;
      if (content === null) next.delete(path);
      else next.set(path, content);
    }
    for (const [path, open] of this.docs) {
      const after = printDocument(open.doc, open.style);
      const text =
        open.original === null ? after : patchOriginal(open.original, open.before, after);
      next.set(path, text.endsWith("\n") ? text : `${text}\n`);
    }
    return Object.fromEntries(next);
  }
}

// -------------------------------------------------------------------------------------------------
// Node helpers

export function flowSeq(values: readonly (number | string)[]): YAMLSeq {
  const seq = new YAMLSeq();
  seq.flow = true;
  for (const value of values) seq.items.push(new Scalar(value));
  return seq;
}

export function pointNode(point: GridPoint): YAMLSeq {
  return flowSeq([point.x, point.y]);
}

export function sizeNode(size: GridSize): YAMLSeq {
  return flowSeq([size.w, size.h]);
}

export function flowMap(entries: readonly (readonly [string, Node | string | number])[]): YAMLMap {
  const map = new YAMLMap();
  map.flow = true;
  for (const [key, value] of entries)
    map.set(key, typeof value === "object" ? value : new Scalar(value));
  return map;
}

/** The map under `key` in `parent`, converting `name: shorthand` scalars into maps. */
export function entryMap(
  parent: YAMLMap,
  key: string,
  shorthandKey: string | null = null,
): YAMLMap {
  const node = parent.get(key, true) as Node | undefined;
  if (isMap(node)) return node;
  const map = new YAMLMap();
  if (shorthandKey !== null && isScalar(node) && node.value !== null && node.value !== "") {
    map.set(shorthandKey, node.value);
  }
  parent.set(key, map);
  return map;
}

/** Sets or removes (`undefined`) a key. */
export function setKey(
  map: YAMLMap,
  key: string,
  value: Node | string | number | boolean | undefined,
): void {
  if (value === undefined) {
    map.delete(key);
    return;
  }
  map.set(key, value);
}

export function scalarString(node: unknown): string | null {
  if (isScalar(node) && (typeof node.value === "string" || typeof node.value === "number"))
    return String(node.value);
  return null;
}

/** Renames a key in place, keeping its position, value and comments. */
export function renameKey(map: YAMLMap, from: string, to: string): boolean {
  const pair = map.items.find((item) => isScalar(item.key) && item.key.value === from);
  if (pair === undefined || !isScalar(pair.key)) return false;
  pair.key.value = to;
  return true;
}

export { isMap, isScalar, isSeq };
