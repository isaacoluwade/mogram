import type { Decoration, GridPoint, LayoutEntry, TextLook, TextStyle, Tone } from "../model/types";
import { isValidName } from "../model/names";
import { parsePaint, solid, type Paint } from "../presets/paint";
import {
  FONT_NAMES,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  NOTE_FILL,
  NOTE_SIZE,
  TEXT_ALIGNS,
  type FontName,
  type TextAlign,
} from "../presets/text";
import { TONE_NAMES } from "../presets/tones";
import type { Position } from "./diagnostics";
import { asString, isMap, isNullish, isSeq, scalarValue, type MapEntry, nodeOf } from "./yaml-read";
import type { RawDecoration, RawLayout, Mutable } from "./raw";
import { SectionReader } from "./read-base";

/** Typography keys, for free text and sticky notes only (ED-25). */
const LOOK_KEYS = ["font", "font_size", "bold", "italic", "align", "color"] as const;

const DECORATION_KEYS = [
  "text",
  "label",
  "zone",
  "note",
  "style",
  "tone",
  "fill",
  ...LOOK_KEYS,
  "at",
  "size",
  "in",
  "z",
] as const;

/** Layout: positions, sizes, z-order and hand-bent paths, plus decorations (ED-11, ED-22). */
export class LayoutReader extends SectionReader {
  // ---------------------------------------------------------------------------------------------
  // Layout

  readLayout(section: MapEntry, out: RawLayout[], decorations: RawDecoration[]): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(
        this.pos(section.keyNode),
        `"layout" should map element names to positions, like "web_vm: [4, 6]".`,
      );
      return;
    }
    for (const entry of this.entries(section.value)) {
      if (entry.key === "decorations") {
        this.readDecorations(entry, decorations);
        continue;
      }
      const at = this.pos(entry.keyNode);
      const layout = this.readLayoutEntry(entry, at);
      if (layout !== null) out.push({ name: entry.key, entry: layout, at });
    }
  }

  private readLayoutEntry(entry: MapEntry, at: Position): LayoutEntry | null {
    const source = { file: at.file, line: at.line };
    if (isSeq(entry.value)) {
      const point = this.readPoint(entry.value, entry.key);
      return point === null ? null : { at: point, size: null, z: 0, via: null, source };
    }
    if (!isMap(entry.value)) {
      this.sink.error(
        at,
        `The layout for "${entry.key}" should be a position like [4, 6], or { at: [4, 6] }.`,
      );
      return null;
    }
    const fields = this.body(entry.key, entry.value, ["at", "size", "z", "via"], "layout");
    const atField = fields.get("at");
    const sizeField = fields.get("size");
    const zField = fields.get("z");
    const viaField = fields.get("via");
    let via: GridPoint[] | null = null;
    if (viaField !== undefined) {
      if (!isSeq(viaField.value)) {
        this.sink.error(
          this.pos(viaField.value),
          `"via" should be a list of points, like [[24, 10], [24, 18]].`,
        );
      } else {
        via = [];
        for (const item of viaField.value.items) {
          const point = this.readPoint(nodeOf(item), entry.key);
          if (point !== null) via.push(point);
        }
      }
    }
    return {
      at: atField === undefined ? null : this.readPoint(atField.value, entry.key),
      size: sizeField === undefined ? null : this.readSize(sizeField.value, entry.key),
      z:
        zField === undefined
          ? 0
          : (this.readInteger(zField.value, `The z-order of "${entry.key}"`) ?? 0),
      via,
      source,
    };
  }

  private readDecorations(section: MapEntry, out: RawDecoration[]): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(this.pos(section.keyNode), `"decorations" should list decorations by name.`);
      return;
    }
    for (const entry of this.entries(section.value)) {
      const at = this.pos(entry.keyNode);
      if (!isValidName(entry.key)) {
        this.sink.error(
          at,
          `"${entry.key}" isn't a valid name. Names start with a letter and use letters, numbers, "_" or "-".`,
        );
        continue;
      }
      const fields = this.body(entry.key, entry.value, DECORATION_KEYS, "decoration");
      const position = fields.get("at");
      const point = position === undefined ? null : this.readPoint(position.value, entry.key);
      if (point === null) {
        if (position === undefined)
          this.sink.error(at, `Decoration "${entry.key}" needs a position, like "at: [4, 6]".`);
        continue;
      }
      const tone = this.optionalLiteral<Tone>(fields.get("tone"), TONE_NAMES, entry.key, "tone");
      const zField = fields.get("z");
      const base = {
        kind: "decoration" as const,
        name: entry.key,
        tone: tone ?? "neutral",
        parent: null,
        at: point,
        z:
          zField === undefined
            ? 0
            : (this.readInteger(zField.value, `The z-order of "${entry.key}"`) ?? 0),
        source: { file: at.file, line: at.line },
      };
      const parentRef = this.optionalRef(fields.get("in"));
      const text = fields.get("text");
      const label = fields.get("label");
      const zone = fields.get("zone");
      const note = fields.get("note");
      let model: Mutable<Decoration>;
      if (note !== undefined) {
        const sizeField = fields.get("size");
        const size =
          sizeField === undefined ? { ...NOTE_SIZE } : this.readSize(sizeField.value, entry.key);
        if (size === null) continue;
        model = {
          ...base,
          variant: "note",
          text: (asString(note.value) ?? "").replace(/\s+$/, ""),
          size,
          fill: this.readFill(fields.get("fill"), entry.key),
          look: this.readLook(fields, entry.key),
        };
      } else if (zone !== undefined) {
        const sizeField = fields.get("size");
        const size = sizeField === undefined ? null : this.readSize(sizeField.value, entry.key);
        if (size === null) {
          if (sizeField === undefined)
            this.sink.error(
              at,
              `Highlight zone "${entry.key}" needs a size, like "size: [30, 14]".`,
            );
          continue;
        }
        this.ignoreNoteKeys(fields, entry.key, "highlight zones");
        model = { ...base, variant: "zone", text: asString(zone.value) ?? "", size };
      } else if (label !== undefined) {
        this.ignoreNoteKeys(fields, entry.key, "labels");
        model = { ...base, variant: "label", text: asString(label.value) ?? "" };
      } else if (text !== undefined) {
        const style = this.optionalLiteral<TextStyle>(
          fields.get("style"),
          ["body", "title", "heading", "caption"],
          entry.key,
          "style",
        );
        const fill = fields.get("fill");
        if (fill !== undefined)
          this.sink.warning(
            this.pos(fill.keyNode),
            `"fill" is for sticky notes, so it is ignored on "${entry.key}".`,
          );
        model = {
          ...base,
          variant: "text",
          text: (asString(text.value) ?? "").replace(/\s+$/, ""),
          style: style ?? "body",
          look: this.readLook(fields, entry.key),
        };
      } else {
        this.sink.error(at, `Decoration "${entry.key}" needs "text", "note", "label" or "zone".`);
        continue;
      }
      out.push({ model, at, parentRef });
    }
  }

  /** A note's fill: a colour or a gradient, yellow when unset. */
  private readFill(entry: MapEntry | undefined, owner: string): Paint {
    if (entry === undefined || isNullish(entry.value)) return solid(NOTE_FILL);
    const parsed = parsePaint(asString(entry.value) ?? "");
    if ("paint" in parsed) return parsed.paint;
    this.sink.error(this.pos(entry.value), `The fill of "${owner}": ${parsed.error}`);
    return solid(NOTE_FILL);
  }

  private readLook(fields: ReadonlyMap<string, MapEntry>, owner: string): TextLook {
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
        "left",
      color: this.optionalColor(fields.get("color"), owner),
    };
  }

  /** Typography and fills belong to text and notes; elsewhere they're ignored with a warning. */
  private ignoreNoteKeys(fields: ReadonlyMap<string, MapEntry>, owner: string, what: string) {
    for (const key of [...LOOK_KEYS, "fill"]) {
      const entry = fields.get(key);
      if (entry === undefined) continue;
      this.sink.warning(
        this.pos(entry.keyNode),
        `"${key}" is for text and sticky notes, not ${what}, so it is ignored on "${owner}".`,
      );
    }
  }
}
