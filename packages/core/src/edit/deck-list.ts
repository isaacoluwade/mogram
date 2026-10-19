import { Scalar, YAMLMap, YAMLSeq, isMap, isScalar, isSeq, type Node } from "yaml";
import { parseDiagram } from "../format/parse";
import { findDiagramFolders } from "../format/project";
import type { Deck, Diagram, ProjectFiles } from "../model/types";
import { edit, type EditContext } from "./context";
import { EditError } from "./session";

/**
 * A deck's `slides:` list as written (D-100), read and written one entry at a time. Shared by the
 * deck commands and by the commands whose changes follow into decks (renaming a story, a step
 * or a scene).
 */

/** What a slide entry says besides its folder. Null or `true`/`false` defaults leave a key out. */
export interface SlideFields {
  readonly story?: string | null;
  readonly from?: string | null;
  readonly to?: string | null;
  readonly scene?: string | null;
  readonly title?: string | null;
  readonly frame?: boolean;
  readonly skip?: boolean;
}

export function deckOf(diagram: Diagram): Deck {
  const deck = diagram.settings.deck;
  if (deck === null) throw new EditError("This diagram isn't a deck.");
  return deck;
}

/** The `slides:` list, made if there isn't one, always written one entry to a line. */
export function slideList(ctx: EditContext): YAMLSeq {
  const deck = deckOf(ctx.diagram);
  const section = ctx.session.section(deck.source.file, "deck");
  const node = section.get("slides", true) as Node | undefined;
  if (isSeq(node)) {
    node.flow = false;
    return node;
  }
  const list = new YAMLSeq();
  section.set("slides", list);
  return list;
}

/** The one key of a single-key map entry (`- title: {…}` or `- section: …`). */
export function onlyPair(node: Node | undefined): { key: string; value: unknown } | null {
  if (!isMap(node) || node.items.length !== 1) return null;
  const pair = node.items[0];
  if (pair === undefined || !isScalar(pair.key) || typeof pair.key.value !== "string") return null;
  return { key: pair.key.value, value: pair.value };
}

/** A slide entry as written: its folder as the file has it, and its other keys. */
export interface WrittenSlide {
  readonly written: string;
  readonly fields: SlideFields;
}

export function readSlide(node: Node | undefined): WrittenSlide | null {
  if (isScalar(node) && typeof node.value === "string") return { written: node.value, fields: {} };
  const pair = onlyPair(node);
  if (pair === null || pair.key === "section") return null;
  const fields: Record<string, string | boolean> = {};
  if (isMap(pair.value))
    for (const item of pair.value.items) {
      if (!isScalar(item.key) || !isScalar(item.value)) continue;
      const value = item.value.value;
      if (typeof value === "string" || typeof value === "boolean")
        fields[String(item.key.value)] = value;
    }
  return {
    written: pair.key,
    fields: {
      ...(typeof fields.story === "string" ? { story: fields.story } : {}),
      ...(typeof fields.from === "string" ? { from: fields.from } : {}),
      ...(typeof fields.to === "string" ? { to: fields.to } : {}),
      ...(typeof fields.scene === "string" ? { scene: fields.scene } : {}),
      ...(typeof fields.title === "string" ? { title: fields.title } : {}),
      ...(fields.frame === false ? { frame: false } : {}),
      ...(fields.skip === true ? { skip: true } : {}),
    },
  };
}

/**
 * A slide entry as it's written: the folder alone when nothing else is said, or the folder with
 * its keys on one line. Empty and default values are left out.
 */
export function slideNode(written: string, fields: SlideFields): Node {
  const keys = new YAMLMap();
  keys.flow = true;
  for (const key of ["story", "from", "to", "scene", "title"] as const) {
    const value = fields[key]?.trim();
    if (value !== undefined && value !== "") keys.set(key, value);
  }
  if (fields.frame === false) keys.set("frame", false);
  if (fields.skip === true) keys.set("skip", true);
  if (keys.items.length === 0) return new Scalar(written);
  const entry = new YAMLMap();
  entry.set(written, keys);
  return entry;
}

export function sectionNode(title: string): Node {
  const node = new YAMLMap();
  node.set("section", title);
  return node;
}

// -------------------------------------------------------------------------------------------------
// Following renames into decks

/**
 * What a deck says about a diagram's stories and scenes, changed along with them: a story,
 * step or scene renamed is renamed in every slide that names it, and one deleted is no longer
 * named. Called by the commands that rename and delete them (D-100).
 */
export function followIntoDecks(
  files: ProjectFiles,
  folder: string,
  change: (fields: SlideFields, story: string | null) => SlideFields,
): ProjectFiles {
  if (!Object.values(files).some((text) => /^deck\s*:/m.test(text))) return files;
  // An entry that names no story plays the first.
  const first = parseDiagram(files, folder).diagram.stories[0]?.name ?? null;
  let current = files;
  for (const deckFolder of findDiagramFolders(files)) {
    const deck = parseDiagram(current, deckFolder).diagram;
    const entries = deck.settings.deck?.entries ?? [];
    if (!entries.some((entry) => entry.kind === "slide" && entry.folder === folder)) continue;
    current = edit(current, deck, (ctx) => {
      const list = slideList(ctx);
      for (const entry of entries) {
        if (entry.kind !== "slide" || entry.folder !== folder) continue;
        const slide = readSlide(list.items[entry.item] as Node | undefined);
        if (slide === null) continue;
        list.items[entry.item] = slideNode(
          slide.written,
          change(slide.fields, entry.story ?? first),
        );
      }
    }).files;
  }
  return current;
}
