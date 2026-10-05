import type { Node, YAMLMap } from "yaml";
import type {
  DataValue,
  ElementExtras,
  ElementLink,
  GridPoint,
  GridSize,
  TextLook,
} from "../model/types";
import { isValidName } from "../model/names";
import { HEX_COLOR, normalizeHex } from "../presets/color";
import { parsePaint, type Paint } from "../presets/paint";
import {
  FONT_NAMES,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  TEXT_ALIGNS,
  type FontName,
  type TextAlign,
} from "../presets/text";
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
import { STYLE_SOURCES } from "./styles";

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
    // A named style's value is reported where the style is written (format/styles.ts).
    const source = node == null ? undefined : STYLE_SOURCES.get(node);
    return source === undefined
      ? positionOf(this.file, node)
      : { ...positionOf(source, node), shared: true };
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
  // Capacity (D-82)

  /** `3x`, `0.5x` or a plain number: traffic or capacity as a multiple of normal. */
  protected readMultiple(node: Node | null, what: string): number | null {
    const value = scalarValue(node);
    const text =
      typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
    const match = /^(\d+(?:\.\d+)?)\s*[x×]?$/i.exec(text);
    const number = match === null ? Number.NaN : Number(match[1]);
    if (Number.isFinite(number) && number <= 1000) return number;
    this.sink.error(
      this.pos(node),
      `${what} should be a multiple of normal traffic, like 3x (or 0.5x for half).`,
    );
    return null;
  }

  protected optionalMultiple(entry: MapEntry | undefined, what: string): number | null {
    return entry === undefined || isNullish(entry.value)
      ? null
      : this.readMultiple(entry.value, what);
  }

  protected optionalPercent(entry: MapEntry | undefined, what: string): number | null {
    return entry === undefined || isNullish(entry.value)
      ? null
      : this.readPercent(entry.value, what);
  }

  /** `70%`, or a fraction from 0 to 1. */
  protected readPercent(node: Node | null, what: string): number | null {
    const value = scalarValue(node);
    if (typeof value === "number" && value >= 0 && value <= 1) return value;
    const text = typeof value === "string" ? value.trim() : "";
    const match = /^(\d+(?:\.\d+)?)\s*%$/.exec(text);
    const percent = match === null ? Number.NaN : Number(match[1]);
    if (Number.isFinite(percent) && percent <= 100) return percent / 100;
    this.sink.error(this.pos(node), `${what} should be a percentage, like 70%.`);
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

  /** A colour or gradient (`fill`), or null when unset or wrong (wrong also says why). */
  protected optionalPaint(entry: MapEntry | undefined, owner: string, what: string): Paint | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const parsed = parsePaint(asString(entry.value) ?? "");
    if ("paint" in parsed) return parsed.paint;
    this.sink.error(this.pos(entry.value), `The ${what} of "${owner}": ${parsed.error}`);
    return null;
  }

  /** Typography keys (ED-25): font, font_size, bold, italic, align, and the colour key given. */
  protected readTextLook(
    fields: ReadonlyMap<string, MapEntry>,
    owner: string,
    options: { readonly colorKey: string; readonly align: TextAlign },
  ): TextLook {
    const sizeEntry = fields.get("font_size");
    let fontSize: number | null = null;
    if (sizeEntry !== undefined && !isNullish(sizeEntry.value)) {
      const value = scalarValue(sizeEntry.value);
      if (typeof value === "number" && value >= MIN_FONT_SIZE && value <= MAX_FONT_SIZE) {
        fontSize = value;
      } else if (value !== "auto") {
        this.sink.error(
          this.pos(sizeEntry.value),
          `The font size of "${owner}" should be a number from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE}, like 16, or "auto".`,
        );
      }
    }
    return {
      font: this.optionalLiteral<FontName>(fields.get("font"), FONT_NAMES, owner, "font"),
      fontSize,
      bold: this.optionalBoolean(fields.get("bold"), owner, "bold") ?? false,
      italic: this.optionalBoolean(fields.get("italic"), owner, "italic") ?? false,
      align:
        this.optionalLiteral<TextAlign>(fields.get("align"), TEXT_ALIGNS, owner, "alignment") ??
        options.align,
      color: this.optionalColor(fields.get(options.colorKey), owner),
    };
  }

  /** `link:` and `data:`, which every element can carry (07 §18 P0-3, P0-5). */
  protected readExtras(fields: ReadonlyMap<string, MapEntry>, owner: string): ElementExtras {
    return {
      link: this.readLink(fields.get("link"), owner),
      data: this.readData(fields.get("data"), owner),
    };
  }

  private readLink(entry: MapEntry | undefined, owner: string): ElementLink | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const raw = (asString(entry.value) ?? "").trim();
    const internal = /^(scene|tour):(.+)$/.exec(raw);
    if (internal !== null) {
      const target = (internal[2] ?? "").trim();
      return internal[1] === "scene"
        ? { kind: "scene", scene: target }
        : { kind: "tour", tour: target };
    }
    if (raw.startsWith("#") && isValidName(raw.slice(1)))
      return { kind: "element", element: raw.slice(1) };
    // Web pages and mail only: never `javascript:` or other schemes.
    if (/^(https?:\/\/|mailto:)\S+$/i.test(raw)) return { kind: "url", url: raw };
    this.sink.error(
      this.pos(entry.value),
      `The link of "${owner}" should be a web address (https://…), scene:name, tour:name or #element.`,
    );
    return null;
  }

  protected readData(entry: MapEntry | undefined, owner: string): ReadonlyMap<string, DataValue> {
    const data = new Map<string, DataValue>();
    if (entry === undefined || isNullish(entry.value)) return data;
    if (!isMap(entry.value)) {
      this.sink.error(
        this.pos(entry.value),
        `"data" on "${owner}" should be named values, like { owner: payments, sla: 99.9 }.`,
      );
      return data;
    }
    for (const item of this.entries(entry.value)) {
      const value = scalarValue(item.value);
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        data.set(item.key, value);
      else
        this.sink.error(
          this.pos(item.value ?? item.keyNode),
          `"${item.key}" in the data of "${owner}" should be a single value: text, a number, true or false.`,
        );
    }
    return data;
  }
}
