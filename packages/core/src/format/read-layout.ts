import type { Node } from "yaml";
import type {
  ConnectionLabelPlace,
  Decoration,
  GridPoint,
  LayoutEntry,
  TextLook,
  TextStyle,
  Tone,
} from "../model/types";
import { isValidName } from "../model/names";
import { parsePaint, solid, type Paint } from "../presets/paint";
import { NOTE_FILL, NOTE_SIZE } from "../presets/text";
import { TONE_NAMES } from "../presets/tones";
import { ANCHOR_NAMES, NAMED_ANCHORS, type Anchor, type AnchorName } from "../presets/connectors";
import { didYouMean, listOptions } from "./suggest";
import type { Position } from "./diagnostics";
import { asString, isMap, isNullish, isSeq, scalarValue, type MapEntry, nodeOf } from "./yaml-read";
import type { RawDecoration, RawLayout, Mutable } from "./raw";
import { SectionReader } from "./read-base";

/** Typography keys, for free text and sticky notes only (ED-25). */
const LOOK_KEYS = ["font", "font_size", "bold", "italic", "align", "color"] as const;

export const DECORATION_KEYS = [
  "text",
  "width",
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
  "locked",
  "link",
  "data",
  "show",
  "on",
  "along",
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
      return point === null
        ? null
        : {
            at: point,
            size: null,
            z: 0,
            via: null,
            fromAnchor: null,
            toAnchor: null,
            label: null,
            locked: false,
            source,
          };
    }
    if (!isMap(entry.value)) {
      this.sink.error(
        at,
        `The layout for "${entry.key}" should be a position like [4, 6], or { at: [4, 6] }.`,
      );
      return null;
    }
    const fields = this.body(
      entry.key,
      entry.value,
      ["at", "size", "z", "via", "from_anchor", "to_anchor", "label", "locked"],
      "layout",
    );
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
      fromAnchor: this.readAnchor(fields.get("from_anchor"), entry.key, "start"),
      toAnchor: this.readAnchor(fields.get("to_anchor"), entry.key, "end"),
      label: this.readLabelPlace(fields.get("label"), entry.key),
      locked: this.optionalBoolean(fields.get("locked"), entry.key, "locked") ?? false,
      source,
    };
  }

  /** `right`, `top-left`… or `[x, y]` fractions of the element's box (ED-29). */
  private readAnchor(entry: MapEntry | undefined, owner: string, end: string): Anchor | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const text = asString(entry.value);
    if (text !== null && (ANCHOR_NAMES as readonly string[]).includes(text))
      return NAMED_ANCHORS[text as AnchorName];
    if (isSeq(entry.value) && entry.value.items.length === 2) {
      const [x, y] = entry.value.items.map((item) => scalarValue(nodeOf(item)));
      if (typeof x === "number" && typeof y === "number" && x >= 0 && x <= 1 && y >= 0 && y <= 1)
        return { x, y };
    }
    this.sink.error(
      this.pos(entry.value),
      `The ${end} anchor of "${owner}" should be a side or corner (${listOptions(ANCHOR_NAMES)}), or [x, y] fractions of the box like [1, 0.25].${didYouMean(text ?? "", ANCHOR_NAMES)}`,
    );
    return null;
  }

  /** `label: { at: 0.3, offset: -1 }`, or `label: 0.3` for a place along the path only. */
  private readLabelPlace(entry: MapEntry | undefined, owner: string): ConnectionLabelPlace | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const along = (node: Node | null): number | null => {
      const value = scalarValue(node);
      if (typeof value === "number" && value >= 0 && value <= 1) return value;
      this.sink.error(
        this.pos(node),
        `Where the label of "${owner}" sits along the line should be 0 (start) to 1 (end), like 0.5.`,
      );
      return null;
    };
    if (!isMap(entry.value)) {
      const at = along(entry.value);
      return at === null ? null : { at, offset: 0 };
    }
    const fields = this.body(owner, entry.value, ["at", "offset"], "label place");
    const atField = fields.get("at");
    const offsetField = fields.get("offset");
    const at = atField === undefined ? 0.5 : (along(atField.value) ?? 0.5);
    let offset = 0;
    if (offsetField !== undefined) {
      const value = scalarValue(offsetField.value);
      if (typeof value === "number" && Math.abs(value) <= 100) offset = value;
      else
        this.sink.error(
          this.pos(offsetField.value),
          `The label offset of "${owner}" should be a number of grid units, like 1 or -1.5.`,
        );
    }
    return { at, offset };
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
      // A width is what text wraps at; notes and zones have a size instead.
      const widthEntry = fields.get("width");
      if (widthEntry !== undefined && fields.get("text") === undefined)
        this.sink.warning(
          this.pos(widthEntry.keyNode),
          `"width" only applies to text, so it is ignored on "${entry.key}".`,
        );
      const position = fields.get("at");
      // Something that rides on an element (a branch name on a commit) needs no position.
      const onEntry = fields.get("on");
      const on = this.optionalString(onEntry, `What "${entry.key}" rides on`);
      const point =
        position === undefined
          ? on === null && !fields.has("in")
            ? null
            : { x: 0, y: 0 }
          : this.readPoint(position.value, entry.key);
      if (point === null) {
        if (position === undefined)
          this.sink.error(
            at,
            `Decoration "${entry.key}" needs a position, like "at: [4, 6]", or something to ride on, like "on: web".`,
          );
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
        locked: this.optionalBoolean(fields.get("locked"), entry.key, "locked") ?? false,
        show: this.readShow(fields.get("show"), entry.key),
        on,
        along: this.optionalPercent(fields.get("along"), `How far along "${entry.key}" sits`),
        source: { file: at.file, line: at.line },
        ...this.readExtras(fields, entry.key),
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
        const widthField = fields.get("width");
        let width =
          widthField === undefined || isNullish(widthField.value)
            ? null
            : this.readInteger(widthField.value, `The width of "${entry.key}"`);
        // A width to wrap at (D-102), in cells: enough for a word, at most a page across.
        if (width !== null && (width < 4 || width > 240)) {
          this.sink.error(
            this.pos(widthField?.value ?? null),
            `"width" should be a number of cells from 4 to 240.`,
          );
          width = null;
        }
        model = {
          ...base,
          variant: "text",
          text: (asString(text.value) ?? "").replace(/\s+$/, ""),
          style: style ?? "body",
          width,
          look: this.readLook(fields, entry.key),
        };
      } else {
        this.sink.error(at, `Decoration "${entry.key}" needs "text", "note", "label" or "zone".`);
        continue;
      }
      out.push({
        model,
        needsPosition: position === undefined && on === null,
        at,
        parentRef,
        onAt: onEntry === undefined ? null : this.pos(onEntry.value),
      });
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
    return this.readTextLook(fields, owner, { colorKey: "color", align: "left" });
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
