import {
  LineCounter,
  isMap,
  isNode,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type Node,
  type YAMLMap,
} from "yaml";
import type { DiagnosticSink, Position } from "./diagnostics";

/** Hard limits on user-controlled input (engineering standards §5). */
export const MAX_FILE_BYTES = 1_000_000;
export const MAX_ALIAS_COUNT = 50;

export interface ParsedFile {
  readonly path: string;
  readonly doc: Document.Parsed;
  readonly lines: LineCounter;
  /** True when the YAML itself is broken and the file contributes nothing. */
  readonly broken: boolean;
}

export const YAML_PARSE_OPTIONS = {
  prettyErrors: false,
  uniqueKeys: true,
  maxAliasCount: MAX_ALIAS_COUNT,
} as const;

export function parseYamlFile(path: string, text: string, sink: DiagnosticSink): ParsedFile {
  const lines = new LineCounter();
  if (text.length > MAX_FILE_BYTES) {
    sink.error(
      { file: path, line: 1, column: 1 },
      `${path} is larger than 1 MB, which is more than Mogram reads.`,
    );
    const empty = parseDocument("", { lineCounter: lines });
    return { path, doc: empty, lines, broken: true };
  }
  const doc = parseDocument(text, { ...YAML_PARSE_OPTIONS, lineCounter: lines });
  for (const error of doc.errors) {
    const pos = lines.linePos(error.pos[0]);
    sink.error(
      { file: path, line: pos.line, column: pos.col },
      explainYamlError(error.code, error.message),
    );
  }
  for (const warning of doc.warnings) {
    const pos = lines.linePos(warning.pos[0]);
    sink.warning(
      { file: path, line: pos.line, column: pos.col },
      warning.message.split("\n")[0] ?? warning.message,
    );
  }
  const broken = doc.errors.length > 0;
  if (!broken && doc.contents !== null && !isMap(doc.contents)) {
    sink.error(
      positionOf({ path, lines }, doc.contents),
      `${path} should be a map of sections like "components:" and "connections:".`,
    );
    return { path, doc, lines, broken: true };
  }
  return { path, doc, lines, broken };
}

function explainYamlError(code: string, message: string): string {
  switch (code) {
    case "DUPLICATE_KEY":
      return "This key appears twice in the same section. Each name can only be used once.";
    case "BAD_INDENT":
    case "MISSING_CHAR":
    case "UNEXPECTED_TOKEN":
      return `This line isn't valid YAML: ${firstLine(message)}`;
    case "TAB_AS_INDENT":
      return "YAML can't be indented with tabs. Use spaces instead.";
    case "ALIAS_PROPS":
    case "BAD_ALIAS":
      return "This alias can't be used here.";
    case "RESOURCE_EXHAUSTION":
      return "This file uses too many aliases for Mogram to read safely.";
    default:
      return `This line isn't valid YAML: ${firstLine(message)}`;
  }
}

function firstLine(message: string): string {
  const line = message.split("\n")[0] ?? message;
  return line.replace(/ at line \d+, column \d+:?$/, "");
}

export function positionOf(
  file: { path: string; lines: LineCounter },
  node: Node | null | undefined,
): Position {
  const offset = node?.range?.[0] ?? 0;
  const pos = file.lines.linePos(offset);
  return { file: file.path, line: pos.line, column: pos.col };
}

export interface MapEntry {
  readonly key: string;
  readonly keyNode: Node;
  readonly value: Node | null;
}

/** Entries of a YAML map with string keys; reports and skips non-string keys. */
export function mapEntries(file: ParsedFile, node: YAMLMap, sink: DiagnosticSink): MapEntry[] {
  const out: MapEntry[] = [];
  for (const pair of node.items) {
    const keyNode = pair.key as Node | null;
    if (
      !isScalar(keyNode) ||
      (typeof keyNode.value !== "string" && typeof keyNode.value !== "number")
    ) {
      sink.error(positionOf(file, keyNode), "Keys here must be plain names.");
      continue;
    }
    out.push({ key: String(keyNode.value), keyNode, value: (pair.value as Node | null) ?? null });
  }
  return out;
}

export function scalarValue(node: Node | null): unknown {
  return isScalar(node) ? node.value : undefined;
}

export function asString(node: Node | null): string | null {
  const value = scalarValue(node);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function isNullish(node: Node | null): boolean {
  return node === null || (isScalar(node) && node.value === null);
}

export { isMap, isScalar, isSeq };

/** A YAML collection item as a node (the yaml library types items as `unknown`). */
export function nodeOf(item: unknown): Node | null {
  return isNode(item) ? item : null;
}
