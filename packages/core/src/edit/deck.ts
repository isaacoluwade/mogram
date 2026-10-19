import { YAMLMap, YAMLSeq, isMap, isScalar, isSeq, type Node } from "yaml";
import { parseDiagram } from "../format/parse";
import { findDiagramFolders } from "../format/project";
import type { Deck, DeckEntry, Diagram, ProjectFiles, Story } from "../model/types";

export { followIntoDecks, type SlideFields } from "./deck-list";
import { isValidName, toName, uniqueName } from "../model/names";
import { basename, dirname, joinPath, resolveFromFolder } from "../model/paths";
import { edit, type EditContext, type EditResult } from "./context";
import {
  deckOf,
  onlyPair,
  readSlide,
  sectionNode,
  slideList,
  slideNode,
  type SlideFields,
  type WrittenSlide,
} from "./deck-list";
import { EditError, setKey } from "./session";
import { updateStep } from "./stories";

/**
 * Editing a deck (D-100). A deck is a list in its `deck:` section, and every command here is a
 * change to that list, or to the folders it names. An entry is found by `item`, its place in
 * the list as written (`DeckEntry.item`), so a line the reader couldn't make sense of never
 * shifts which entry a command changes.
 *
 * Folders are given from the project's root, as `DeckEntry.folder` has them; what's written in
 * the file is relative to the deck's folder, as the file format says.
 */

/** A command that made a folder says which. */
export interface SlideFolderResult extends EditResult {
  readonly folder: string;
}

/** Where a slide brought in from a saved diagram came from, so it can offer the latest. */
export interface SlideOrigin {
  readonly diagram: string;
  readonly version: number;
}

type SlideEntry = Extract<DeckEntry, { kind: "slide" }>;

/** The slide entry at `item`; an error when there isn't one there. */
function slideAt(ctx: EditContext, item: number): WrittenSlide {
  const slide = readSlide(slideList(ctx).items[item] as Node | undefined);
  if (slide === null) throw new EditError(`Entry ${item + 1} of the deck isn't a slide.`);
  return slide;
}

/** The deck's reading of the slide entry at `item`. */
function slideEntry(diagram: Diagram, item: number): SlideEntry {
  const entry = deckOf(diagram).entries.find((each) => each.item === item);
  if (entry?.kind !== "slide") throw new EditError(`Entry ${item + 1} of the deck isn't a slide.`);
  return entry;
}

/** An insertion point in the list: the end unless said, and never past it. */
function insertAt(list: YAMLSeq, at: number | undefined): number {
  return Math.min(Math.max(0, Math.trunc(at ?? list.items.length)), list.items.length);
}

// -------------------------------------------------------------------------------------------------
// Folders

/** A folder given from the project's root, tidied; an error for one outside the project. */
function projectFolder(folder: string, what: string): string {
  const normalized = resolveFromFolder("", folder.trim().replace(/\/+$/, ""));
  if (normalized === null || normalized === "")
    throw new EditError(`The ${what} should be a folder inside the project.`);
  return normalized;
}

/** `to` as written from `from`: `title`, `part/intro`, `../shared/flow`. */
export function relativeFolder(from: string, to: string): string {
  const origin = from === "" ? [] : from.split("/");
  const target = to === "" ? [] : to.split("/");
  let common = 0;
  while (common < origin.length && common < target.length && origin[common] === target[common])
    common++;
  const path = [...origin.slice(common).map(() => ".."), ...target.slice(common)].join("/");
  return path === "" ? "." : path;
}

const within = (path: string, folder: string): boolean =>
  folder === "" || path === folder || path.startsWith(`${folder}/`);

const moved = (path: string, from: string, to: string): string =>
  within(path, from) ? `${to}${path.slice(from.length)}` : path;

function occupied(files: ProjectFiles, folder: string): boolean {
  return Object.keys(files).some((path) => within(path, folder));
}

/** A folder under `parent` named after `label` that nothing in the project uses yet. */
function freshFolder(files: ProjectFiles, parent: string, label: string): string {
  const prefix = parent === "" ? "" : `${parent}/`;
  const taken = new Set(
    Object.keys(files)
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length).split("/")[0] ?? ""),
  );
  const base = toName(label, "slide");
  return joinPath(parent, uniqueName(isValidName(base) ? base : "slide", taken));
}

/** That a folder can be a slide or a frame: it holds a diagram, and that diagram isn't a deck. */
function requireSlideFolder(
  files: ProjectFiles,
  deck: Diagram,
  folder: string,
  what: string,
): void {
  if (folder === deck.folder) throw new EditError(`A deck can't be its own ${what}.`);
  if (!findDiagramFolders(files).includes(folder))
    throw new EditError(`There is no diagram in the folder "${folder}".`);
  if (parseDiagram(files, folder).diagram.settings.deck !== null)
    throw new EditError(`"${folder}" is a deck. A deck's ${what}s are diagrams.`);
}

/** Keys whose values are paths in the project, relative to the diagram's folder. */
const PATH_KEYS = new Set(["opens", "file", "src", "icon"]);

/** Whether a value under one of `PATH_KEYS` is a path in the project (not a catalogue icon). */
function isProjectPath(key: string, value: string): boolean {
  if (/^[a-z]+:/i.test(value) || value.startsWith("/")) return false;
  return key !== "icon" || value.startsWith("./") || value.startsWith("../");
}

/**
 * Rewrites the paths in one moved Mogram file so they still reach what they reached: a path to
 * something that moved with it is left alone, a path out of the moved folder is written again
 * from the file's new place.
 */
function relocatePaths(ctx: EditContext, path: string, from: string, to: string): void {
  const oldFolder = dirname(path);
  const newFolder = moved(oldFolder, from, to);
  const visit = (node: unknown): void => {
    if (isMap(node))
      for (const pair of node.items) {
        const key = isScalar(pair.key) ? String(pair.key.value) : "";
        const value = pair.value;
        if (PATH_KEYS.has(key) && isScalar(value) && typeof value.value === "string") {
          const written = value.value;
          if (!isProjectPath(key, written)) continue;
          const target = resolveFromFolder(oldFolder, written);
          if (target === null || within(target, from)) continue;
          const again = relativeFolder(newFolder, target);
          value.value = key === "opens" && !again.startsWith("..") ? `./${again}` : again;
        } else visit(value);
      }
    else if (isSeq(node)) for (const item of node.items) visit(item);
  };
  visit(ctx.session.root(moved(path, from, to)));
}

const isMogramFile = (path: string): boolean => /(^|\/)mogram\.yaml$|\.mogram(\.yaml)?$/.test(path);

/**
 * Copies (or moves) a folder's files to another folder, fixing every path in them that leads
 * out, and every path elsewhere in the project that leads in: `opens`, the entries and frames
 * of every deck. `except` is a deck entry that's being repointed by the caller.
 */
function relocateFolder(
  ctx: EditContext,
  from: string,
  to: string,
  options: { readonly keep: boolean; readonly references: boolean },
): void {
  const files = ctx.files;
  const inside = Object.keys(files).filter((path) => path.startsWith(`${from}/`));
  for (const path of inside) {
    ctx.session.writeRaw(moved(path, from, to), files[path] ?? "");
    if (!options.keep) ctx.session.writeRaw(path, null);
  }
  for (const path of inside) if (isMogramFile(path)) relocatePaths(ctx, path, from, to);
  if (!options.references) return;

  // What the rest of the project says about the folder now says it about its new place.
  for (const folder of findDiagramFolders(files)) {
    if (within(folder, from)) continue;
    const diagram = parseDiagram(files, folder).diagram;
    for (const component of diagram.components.values()) {
      if (component.opens === null || !within(component.opens, from)) continue;
      const definition = definitionIn(
        ctx,
        component.source.file,
        component.shape === null ? "components" : "shapes",
        component.name,
      );
      if (definition === null) continue;
      const again = relativeFolder(folder, moved(component.opens, from, to));
      setKey(definition, "opens", again.startsWith("..") ? again : `./${again}`);
    }
    const deck = diagram.settings.deck;
    if (deck === null) continue;
    const list = listIn(ctx, deck);
    for (const entry of deck.entries) {
      if (entry.kind !== "slide" || !within(entry.folder, from)) continue;
      const slide = readSlide(list?.items[entry.item] as Node | undefined);
      if (list === null || slide === null) continue;
      list.items[entry.item] = slideNode(
        relativeFolder(folder, moved(entry.folder, from, to)),
        slide.fields,
      );
    }
    if (deck.frame !== null && within(deck.frame, from))
      setKey(
        ctx.session.section(deck.source.file, "deck"),
        "frame",
        relativeFolder(folder, moved(deck.frame, from, to)),
      );
  }
}

function definitionIn(
  ctx: EditContext,
  file: string,
  section: string,
  name: string,
): YAMLMap | null {
  const map = ctx.session.root(file).get(section, true);
  const definition = isMap(map) ? map.get(name, true) : undefined;
  return isMap(definition) ? definition : null;
}

function listIn(ctx: EditContext, deck: Deck): YAMLSeq | null {
  const node = ctx.session.section(deck.source.file, "deck").get("slides", true);
  return isSeq(node) ? node : null;
}

// -------------------------------------------------------------------------------------------------
// The deck itself

/** Makes a diagram a deck (D-99): `deck:` with no slides yet. Its file then holds no elements. */
export function createDeck(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly frame?: string | null; readonly captions?: boolean } = {},
): EditResult {
  if (diagram.settings.deck !== null) throw new EditError("This diagram is already a deck.");
  const elements = diagram.components.size + diagram.containers.size + diagram.decorations.size;
  if (elements > 0)
    throw new EditError(
      "A deck's file holds its settings and its slides. Move its elements onto a slide first.",
    );
  const frame =
    args.frame === undefined || args.frame === null ? null : projectFolder(args.frame, "frame");
  if (frame !== null) requireSlideFolder(files, diagram, frame, "frame");
  return edit(files, diagram, (ctx) => {
    const section = ctx.session.section(diagram.settingsFile, "deck");
    if (frame !== null) section.set("frame", relativeFolder(diagram.folder, frame));
    if (args.captions === false) section.set("captions", "off");
    section.set("slides", new YAMLSeq());
  });
}

/** Sets the deck's frame (a folder, or null for none), or whether captions show to begin with. */
export function setDeckSetting(
  files: ProjectFiles,
  diagram: Diagram,
  args:
    | { readonly key: "frame"; readonly value: string | null }
    | { readonly key: "captions"; readonly value: boolean },
): EditResult {
  const deck = deckOf(diagram);
  const frame =
    args.key !== "frame" || args.value === null || args.value.trim() === ""
      ? null
      : projectFolder(args.value, "frame");
  if (frame !== null) requireSlideFolder(files, diagram, frame, "frame");
  return edit(files, diagram, (ctx) => {
    const section = ctx.session.section(deck.source.file, "deck");
    if (args.key === "frame")
      setKey(section, "frame", frame === null ? undefined : relativeFolder(diagram.folder, frame));
    // On is the default: it's only written when it's off.
    else setKey(section, "captions", args.value ? undefined : "off");
  });
}

// -------------------------------------------------------------------------------------------------
// Entries

/** Adds a slide showing a folder's diagram (from the project's root), at `at` or the end. */
export function addSlide(
  files: ProjectFiles,
  diagram: Diagram,
  args: SlideFields & { readonly folder: string; readonly at?: number },
): EditResult {
  deckOf(diagram);
  const folder = projectFolder(args.folder, "slide");
  requireSlideFolder(files, diagram, folder, "slide");
  return edit(files, diagram, (ctx) => {
    const list = slideList(ctx);
    list.items.splice(
      insertAt(list, args.at),
      0,
      slideNode(relativeFolder(diagram.folder, folder), args),
    );
  });
}

/** Starts a section at `at` (the end unless said). */
export function addSection(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly title: string; readonly at?: number },
): EditResult {
  const title = args.title.trim();
  if (title === "") throw new EditError("A section needs a title.");
  return edit(files, diagram, (ctx) => {
    const list = slideList(ctx);
    list.items.splice(insertAt(list, args.at), 0, sectionNode(title));
  });
}

export function renameSection(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly item: number; readonly title: string },
): EditResult {
  const title = args.title.trim();
  if (title === "") throw new EditError("A section needs a title.");
  return edit(files, diagram, (ctx) => {
    const list = slideList(ctx);
    if (onlyPair(list.items[args.item] as Node | undefined)?.key !== "section")
      throw new EditError(`Entry ${args.item + 1} of the deck isn't a section.`);
    list.items[args.item] = sectionNode(title);
  });
}

/** Changes what a slide entry says: its story, stretch, scene, title, frame or skip. */
export function updateSlide(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly item: number; readonly patch: SlideFields },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const slide = slideAt(ctx, args.item);
    const fields: SlideFields = { ...slide.fields };
    const patch = args.patch;
    // A different story's steps aren't this one's: its stretch starts over.
    const restart = patch.story !== undefined && patch.story !== fields.story;
    const next: SlideFields = {
      ...fields,
      ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
      ...(restart && patch.from === undefined ? { from: null } : {}),
      ...(restart && patch.to === undefined ? { to: null } : {}),
    };
    slideList(ctx).items[args.item] = slideNode(slide.written, next);
  });
}

/** Puts a copy of a slide entry after it. Both show the same folder until one is detached. */
export function duplicateSlide(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly item: number },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const slide = slideAt(ctx, args.item);
    slideList(ctx).items.splice(args.item + 1, 0, slideNode(slide.written, slide.fields));
  });
}

/**
 * Moves entries (slides or sections) to before the entry now at `to` (the end when `to` is the
 * list's length), keeping their order.
 */
export function moveEntries(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly items: readonly number[]; readonly to: number },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const list = slideList(ctx);
    const chosen = [...new Set(args.items)].sort((a, b) => a - b);
    for (const item of chosen)
      if (!Number.isInteger(item) || item < 0 || item >= list.items.length)
        throw new EditError(`The deck has no entry ${item + 1}.`);
    const moving = chosen.map((item) => list.items[item]);
    const staying = list.items.filter((_, item) => !chosen.includes(item));
    const to = insertAt(list, args.to);
    const at = to - chosen.filter((item) => item < to).length;
    staying.splice(at, 0, ...moving);
    list.items.splice(0, list.items.length, ...staying);
  });
}

/** Takes entries out of the deck. The folders they showed stay in the project. */
export function removeEntries(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly items: readonly number[] },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const list = slideList(ctx);
    for (const item of [...new Set(args.items)].sort((a, b) => b - a)) {
      if (!Number.isInteger(item) || item < 0 || item >= list.items.length)
        throw new EditError(`The deck has no entry ${item + 1}.`);
      list.items.splice(item, 1);
    }
  });
}

// -------------------------------------------------------------------------------------------------
// Stretches

function storyOf(files: ProjectFiles, slide: SlideEntry): { diagram: Diagram; story: Story } {
  const diagram = parseDiagram(files, slide.folder).diagram;
  const name = slide.story ?? diagram.stories[0]?.name;
  const story = diagram.stories.find((each) => each.name === name);
  if (story === undefined) throw new EditError("A still slide has no beats to split.");
  return { diagram, story };
}

/** Where a slide's stretch is in its story: the step after `from`, and the step `to` names. */
function stretchOf(story: Story, slide: SlideEntry): { first: number; last: number } {
  const index = (name: string | null, fallback: number) => {
    if (name === null) return fallback;
    const found = story.steps.findIndex((step) => step.name === name);
    return found === -1 ? fallback : found;
  };
  return { first: index(slide.from, -1) + 1, last: index(slide.to, story.steps.length - 1) };
}

/** Whether a slide can be split after step `step` of its story (D-100). */
export function canSplitSlide(
  files: ProjectFiles,
  diagram: Diagram,
  item: number,
  step: number,
): boolean {
  try {
    const slide = slideEntry(diagram, item);
    const { story } = storyOf(files, slide);
    const { first, last } = stretchOf(story, slide);
    return step >= first && step < last;
  } catch {
    return false;
  }
}

/**
 * "Start a new slide here" (D-100): the slide stops after step `step` of its story, and a new
 * slide right after it carries on from there. The step is given a name if it has none.
 */
export function splitSlide(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly item: number; readonly step: number },
): EditResult {
  const slide = slideEntry(diagram, args.item);
  const { diagram: shown, story } = storyOf(files, slide);
  if (!canSplitSlide(files, diagram, args.item, args.step))
    throw new EditError("A slide is split between two of its own beats.");
  const step = story.steps[args.step];
  if (step === undefined)
    throw new EditError(`Story "${story.name}" has no step ${args.step + 1}.`);

  // The step a slide stops after needs a name for `to:` and `from:` to use.
  let name = step.name;
  let current = files;
  if (name === null) {
    const taken = new Set(story.steps.flatMap((each) => (each.name === null ? [] : [each.name])));
    const base = toName(step.say ?? step.script ?? `beat ${args.step + 1}`, "beat").slice(0, 32);
    name = uniqueName(isValidName(base) ? base : "beat", taken);
    current = updateStep(files, shown, {
      story: story.name,
      index: args.step,
      patch: { name },
    }).files;
  }
  const stopAt = name;
  const deck = parseDiagram(current, diagram.folder).diagram;
  return edit(current, deck, (ctx) => {
    const written = slideAt(ctx, args.item);
    const list = slideList(ctx);
    const rest: SlideFields = {
      story: written.fields.story ?? null,
      from: stopAt,
      to: written.fields.to ?? null,
      scene: written.fields.scene ?? null,
      ...(written.fields.frame === false ? { frame: false } : {}),
      ...(written.fields.skip === true ? { skip: true } : {}),
    };
    list.items[args.item] = slideNode(written.written, { ...written.fields, to: stopAt });
    list.items.splice(args.item + 1, 0, slideNode(written.written, rest));
  });
}

/** Whether the slide at `item` can be joined to the one before it: one stretch split in two. */
export function canJoinSlides(diagram: Diagram, item: number): boolean {
  const entries = diagram.settings.deck?.entries ?? [];
  const current = entries.find((entry) => entry.item === item);
  const before = entries.find((entry) => entry.item === item - 1);
  return (
    current?.kind === "slide" &&
    before?.kind === "slide" &&
    current.folder === before.folder &&
    current.story === before.story &&
    current.scene === before.scene &&
    before.to !== null &&
    current.from === before.to
  );
}

/** "Join with the slide before" (D-100): undoes a split. */
export function joinSlides(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly item: number },
): EditResult {
  if (!canJoinSlides(diagram, args.item))
    throw new EditError("Only a slide that carries on from the one before it can be joined to it.");
  return edit(files, diagram, (ctx) => {
    const before = slideAt(ctx, args.item - 1);
    const current = slideAt(ctx, args.item);
    const list = slideList(ctx);
    list.items[args.item - 1] = slideNode(before.written, {
      ...before.fields,
      to: current.fields.to ?? null,
    });
    list.items.splice(args.item, 1);
  });
}

// -------------------------------------------------------------------------------------------------
// Folders for slides

/** A new slide with a blank diagram of its own, in a new folder inside the deck's. */
export function newSlideFolder(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name?: string; readonly at?: number } = {},
): SlideFolderResult {
  deckOf(diagram);
  const name = args.name?.trim() || "New slide";
  const folder = freshFolder(files, diagram.folder, name);
  const result = edit(files, diagram, (ctx) => {
    ctx.session.writeRaw(
      joinPath(folder, "mogram.yaml"),
      `mogram: 1\nname: ${JSON.stringify(name)}\n`,
    );
    const list = slideList(ctx);
    list.items.splice(
      insertAt(list, args.at),
      0,
      slideNode(relativeFolder(diagram.folder, folder), {}),
    );
  });
  return { ...result, folder };
}

/**
 * Brings a whole diagram project in as a new slide (a template, a concept, another draft or a
 * saved diagram): its files go in a new folder inside the deck's.
 */
export function importSlideFiles(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    readonly files: ProjectFiles;
    readonly name?: string;
    readonly at?: number;
    readonly origin?: SlideOrigin;
  },
): SlideFolderResult {
  deckOf(diagram);
  for (const path of Object.keys(args.files))
    if (resolveFromFolder("", path) !== path)
      throw new EditError(`"${path}" isn't a file inside the project.`);
  const imported = parseDiagram(args.files).diagram;
  if (imported.files.length === 0) throw new EditError("That has no Mogram diagram in it.");
  if (imported.settings.deck !== null)
    throw new EditError("A deck can't be a slide of another deck.");
  if (args.origin !== undefined && (args.origin.diagram.trim() === "" || args.origin.version < 1))
    throw new EditError("Where the slide came from isn't a saved diagram.");

  const name = args.name?.trim() || imported.settings.name;
  const folder = freshFolder(files, diagram.folder, name);
  const result = edit(files, diagram, (ctx) => {
    for (const [path, content] of Object.entries(args.files))
      ctx.session.writeRaw(joinPath(folder, path), content);
    // A slide brought in from a saved diagram remembers it, so "Bring in the latest" can offer.
    if (args.origin !== undefined) {
      const root = ctx.session.root(joinPath(folder, basename(imported.settingsFile)));
      const data = root.get("data", true);
      const map = isMap(data) ? data : new YAMLMap();
      if (!isMap(data)) root.set("data", map);
      map.set("from_diagram", args.origin.diagram);
      map.set("from_version", args.origin.version);
    }
    // Chosen by another name than its diagram's (a template's card, a draft's name): the
    // slide keeps the name it was chosen by.
    const title = name === imported.settings.name ? {} : { title: name };
    const list = slideList(ctx);
    list.items.splice(
      insertAt(list, args.at),
      0,
      slideNode(relativeFolder(diagram.folder, folder), title),
    );
  });
  return { ...result, folder };
}

/**
 * Detach (D-100): gives one slide its own copy of the diagram it shows, so it can differ from
 * the other slides showing it.
 */
export function detachSlide(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly item: number; readonly folder?: string },
): SlideFolderResult {
  const slide = slideEntry(diagram, args.item);
  const folder =
    args.folder === undefined
      ? freshFolder(files, dirname(slide.folder), `${basename(slide.folder)}_copy`)
      : projectFolder(args.folder, "copy");
  if (within(folder, slide.folder) || within(slide.folder, folder))
    throw new EditError("A slide's copy needs a folder of its own, beside the one it copies.");
  if (occupied(files, folder)) throw new EditError(`The folder "${folder}" is already in use.`);
  const result = edit(files, diagram, (ctx) => {
    relocateFolder(ctx, slide.folder, folder, { keep: true, references: false });
    const written = slideAt(ctx, args.item);
    slideList(ctx).items[args.item] = slideNode(
      relativeFolder(diagram.folder, folder),
      written.fields,
    );
  });
  return { ...result, folder };
}

/**
 * Moves a slide's folder (a rename, or somewhere else in the project), keeping every slide of
 * every deck, every frame and every `opens` that named it pointed at it.
 */
export function renameSlideFolder(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string; readonly to: string },
): SlideFolderResult {
  const from = projectFolder(args.from, "folder");
  const to = projectFolder(args.to, "new folder");
  if (!findDiagramFolders(files).includes(from))
    throw new EditError(`There is no diagram in the folder "${from}".`);
  if (within(diagram.folder, from))
    throw new EditError("A deck's own folder can't be moved from inside it.");
  if (within(to, from) || within(from, to))
    throw new EditError("A folder can't be moved inside itself.");
  if (occupied(files, to)) throw new EditError(`The folder "${to}" is already in use.`);
  const result = edit(files, diagram, (ctx) => {
    relocateFolder(ctx, from, to, { keep: false, references: true });
  });
  return { ...result, folder: to };
}
