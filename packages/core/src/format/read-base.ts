import type { Node, YAMLMap } from "yaml";
import type { GridPoint, GridSize } from "../model/types";
import { HEX_COLOR, normalizeHex } from "../presets/color";
import type { DiagnosticSink, Position } from "./diagnostics";
import { didYouMean, listOptions } from "./suggest";
import {
  asString,
  isMap,
  isNullish,
  isSeq,
  mapEntries,
  positionOf,
  scalarValue,
  type MapEntry,
  type ParsedFile,
  nodeOf,
} from "./yaml-read";
import type { Ref } from "./raw";

/** Hex colours, with or without alpha (`#5c9776`, `#5c977680`). */
export const COLOR_PATTERN = HEX_COLOR;

/**
 * What every section reader shares: positions for diagnostics, and turning YAML nodes into
 * values with a clear message when they're wrong.
 */
export abstract class SectionReader {
  constructor(
    protected readonly file: ParsedFile,
    protected readonly folder: string,
    protected readonly sink: DiagnosticSink,
  ) {}

  protected pos(node: Node | null | undefined): Position {
    return positionOf(this.file, node);
  }

  protected entries(node: YAMLMap): MapEntry[] {
    return mapEntries(this.file, node, this.sink);
  }

  protected requireString(entry: MapEntry, what: string): string | null {
    const value = asString(entry.value);
    if (value === null)
      this.sink.error(this.pos(entry.value ?? entry.keyNode), `${what} should be text.`);
    return value;
  }

  /** Element bodies may be empty (`user:`), a map, or — for components — a bare type string. */
  protected body(
    name: string,
    node: Node | null,
    allowed: readonly string[],
    kind: string,
  ): Map<string, MapEntry> {
    const out = new Map<string, MapEntry>();
    if (isNullish(node) || node === null) return out;
    if (!isMap(node)) {
      this.sink.error(this.pos(node), `"${name}" should have its settings indented below it.`);
      return out;
    }
    for (const entry of this.entries(node)) {
      if (!allowed.includes(entry.key)) {
        this.sink.warning(
          this.pos(entry.keyNode),
          `"${entry.key}" isn't a ${kind} setting, so it is ignored.${didYouMean(entry.key, allowed)}`,
        );
        continue;
      }
      out.set(entry.key, entry);
    }
    return out;
  }

  protected readPoint(node: Node | null, owner: string): GridPoint | null {
    const values = this.readPair(node, owner, "position");
    return values === null ? null : { x: values[0], y: values[1] };
  }

  protected readSize(node: Node | null, owner: string): GridSize | null {
    const values = this.readPair(node, owner, "size");
    if (values === null) return null;
    if (values[0] <= 0 || values[1] <= 0) {
      this.sink.error(this.pos(node), `The size of "${owner}" must be bigger than zero.`);
      return null;
    }
    return { w: values[0], h: values[1] };
  }

  protected readPair(node: Node | null, owner: string, what: string): [number, number] | null {
    if (!isSeq(node) || node.items.length !== 2) {
      this.sink.error(
        this.pos(node),
        `The ${what} of "${owner}" should be two numbers, like [4, 6].`,
      );
      return null;
    }
    const [first, second] = node.items.map((item) => scalarValue(nodeOf(item)));
    if (typeof first !== "number" || typeof second !== "number") {
      this.sink.error(
        this.pos(node),
        `The ${what} of "${owner}" should be two numbers, like [4, 6].`,
      );
      return null;
    }
    if (!Number.isInteger(first) || !Number.isInteger(second)) {
      this.sink.error(
        this.pos(node),
        `The ${what} of "${owner}" must use whole numbers (grid units of 8px).`,
      );
      return null;
    }
    return [first, second];
  }

  protected readInteger(node: Node | null, what: string): number | null {
    const value = scalarValue(node);
    if (typeof value === "number" && Number.isInteger(value)) return value;
    this.sink.error(this.pos(node), `${what} should be a whole number.`);
    return null;
  }

  // ---------------------------------------------------------------------------------------------
  // Scalars

  protected optionalString(entry: MapEntry | undefined, what: string): string | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const value = asString(entry.value);
    if (value === null) this.sink.error(this.pos(entry.value), `${what} should be text.`);
    return value;
  }

  protected optionalRef(entry: MapEntry | undefined): Ref | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const value = asString(entry.value);
    if (value === null) {
      this.sink.error(this.pos(entry.value), `"in" should name a container.`);
      return null;
    }
    return { value, at: this.pos(entry.value) };
  }

  protected optionalBoolean(
    entry: MapEntry | undefined,
    owner: string,
    what: string,
  ): boolean | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const value = scalarValue(entry.value);
    if (typeof value === "boolean") return value;
    this.sink.error(this.pos(entry.value), `"${what}" for "${owner}" should be true or false.`);
    return null;
  }

  protected optionalColor(entry: MapEntry | undefined, owner: string): string | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const value = asString(entry.value);
    const color = value === null ? null : normalizeHex(value);
    if (color !== null) return color;
    this.sink.error(
      this.pos(entry.value),
      `The colour of "${owner}" should look like "#5c9776", or "#5c977680" to make it see-through.`,
    );
    return null;
  }

  protected optionalEnum<T extends string>(
    entry: MapEntry | undefined,
    options: readonly T[],
    guard: (value: unknown) => value is T,
    owner: string,
    what: string,
  ): T | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const value = asString(entry.value);
    if (guard(value)) return value;
    this.sink.error(
      this.pos(entry.value),
      `"${value ?? ""}" isn't a ${what} preset for "${owner}".${didYouMean(value ?? "", options)} Choose one of ${listOptions(options)}.`,
    );
    return null;
  }

  protected optionalLiteral<T extends string>(
    entry: MapEntry | undefined,
    options: readonly T[],
    owner: string,
    what: string,
  ): T | null {
    return this.optionalEnum(
      entry,
      options,
      (value): value is T =>
        typeof value === "string" && (options as readonly string[]).includes(value),
      owner,
      what,
    );
  }
}
