import { followIntoDecks } from "./deck-list";
import { Pair, Scalar, YAMLMap, YAMLSeq, isMap, isScalar, isSeq, type Node } from "yaml";
import type { Diagram, ProjectFiles } from "../model/types";
import { isValidName, toName, uniqueName } from "../model/names";
import { edit, type EditContext, type EditResult } from "./context";
import { EditError, flowSeq, renameKey, setKey } from "./session";

// -------------------------------------------------------------------------------------------------
// Stories (D-86): named runs of steps, each a `set` with words.

/** A set: a scene, by name, or a step of a story. */
export type SetRef = string | { readonly story: string; readonly index: number };

function storySection(ctx: EditContext, story: string): YAMLMap {
  const existing = ctx.diagram.stories.find((s) => s.name === story);
  if (existing === undefined) throw new EditError(`There is no story called "${story}".`);
  return ctx.session.section(existing.source.file, "stories");
}

/** A story's list of steps, always written as a block list. */
function storySeq(ctx: EditContext, story: string): YAMLSeq {
  const section = storySection(ctx, story);
  const node = section.get(story, true) as Node | undefined;
  if (isSeq(node)) {
    node.flow = false;
    return node;
  }
  const seq = new YAMLSeq();
  section.set(story, seq);
  return seq;
}

/** A step's map; a step written as a caption on its own (`- Some words`) becomes `say:`. */
function stepMap(ctx: EditContext, story: string, index: number): YAMLMap {
  const seq = storySeq(ctx, story);
  // The parser leaves out steps that say and change nothing: count the ones it kept.
  const position = writtenIndex(ctx.diagram, seq, story, index);
  const node = seq.items[position] as Node | undefined;
  if (node === undefined) throw new EditError(`Story "${story}" has no step ${index + 1}.`);
  if (isMap(node)) {
    node.flow = false;
    return node;
  }
  const map = new YAMLMap();
  if (isScalar(node) && typeof node.value === "string") map.set("say", node.value);
  seq.items[position] = map;
  return map;
}

/**
 * Where the diagram's step `index` is in the written list. They match unless the file has a
 * step that says and changes nothing, which reading leaves out.
 */
function writtenIndex(diagram: Diagram, seq: YAMLSeq, story: string, index: number): number {
  const steps = diagram.stories.find((s) => s.name === story)?.steps ?? [];
  if (steps.length === seq.items.length) return index;
  let kept = -1;
  for (let i = 0; i < seq.items.length; i++) {
    const node = seq.items[i] as Node | undefined;
    const empty =
      node === undefined ||
      (isMap(node) && node.items.length === 0) ||
      (isScalar(node) &&
        (node.value === null || (typeof node.value === "string" && node.value.trim() === "")));
    if (!empty) kept++;
    if (kept === index) return i;
  }
  return seq.items.length;
}

/**
 * A step's `set:` map (made when missing), and how to tidy up once it's empty: the key goes,
 * and a step left saying and changing nothing goes with it.
 */
export function stepSet(
  ctx: EditContext,
  ref: { readonly story: string; readonly index: number },
): { readonly set: YAMLMap; readonly clear: () => void } {
  const step = stepMap(ctx, ref.story, ref.index);
  const node = step.get("set", true) as Node | undefined;
  let set: YAMLMap;
  if (isMap(node)) {
    node.flow = false;
    set = node;
  } else {
    set = new YAMLMap();
    step.set("set", set);
  }
  return {
    set,
    clear: () => {
      step.delete("set");
      if (step.items.length > 0) return;
      const seq = storySeq(ctx, ref.story);
      const at = seq.items.indexOf(step);
      if (at !== -1) seq.items.splice(at, 1);
    },
  };
}

function storyNames(diagram: Diagram): Set<string> {
  return new Set(diagram.stories.map((story) => story.name));
}

/** Adds a story with one step to begin with. The first story is the one a diagram plays. */
export function addStory(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly label?: string; readonly say?: string } = {},
): EditResult {
  return edit(files, diagram, (ctx) => {
    const base = toName(args.label ?? (diagram.stories.length === 0 ? "main" : "story"), "story");
    const name = uniqueName(isValidName(base) ? base : "story", storyNames(diagram));
    const file = diagram.stories[0]?.source.file ?? ctx.sectionFile("scenes");
    const seq = new YAMLSeq();
    const step = new YAMLMap();
    step.set("say", args.say ?? "What happens first.");
    seq.items.push(step);
    ctx.session.section(file, "stories").set(name, seq);
    ctx.setNamed(name);
  });
}

function renameStoryHere(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string; readonly to: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    ctx.setNamed(args.to);
    if (args.from === args.to) return;
    if (!isValidName(args.to)) throw new EditError(`"${args.to}" isn't a valid story name.`);
    if (storyNames(diagram).has(args.to))
      throw new EditError(`There is already a story called "${args.to}".`);
    renameKey(storySection(ctx, args.from), args.from, args.to);
    // Choices that play it follow the new name.
    for (const story of diagram.stories) {
      const name = story.name === args.from ? args.to : story.name;
      const seq = ctx.session.section(story.source.file, "stories").get(name, true) as
        Node | undefined;
      if (!isSeq(seq)) continue;
      for (const step of seq.items) {
        const choices = isMap(step) ? (step.get("choices", true) as Node | undefined) : undefined;
        if (!isSeq(choices)) continue;
        for (const choice of choices.items)
          if (isMap(choice) && choice.get("play") === args.from) choice.set("play", args.to);
      }
    }
  });
}

function deleteStoryHere(files: ProjectFiles, diagram: Diagram, story: string): EditResult {
  return edit(files, diagram, (ctx) => {
    const section = storySection(ctx, story);
    section.delete(story);
    if (section.items.length === 0) {
      const file = diagram.stories.find((s) => s.name === story)?.source.file;
      if (file !== undefined) ctx.session.root(file).delete("stories");
    }
  });
}

/**
 * Adds a step at `index` (the end when left out). With words it starts a beat; without, it
 * carries on the beat before it.
 */
export function addStep(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly story: string; readonly index?: number; readonly say?: string | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const seq = storySeq(ctx, args.story);
    const count = diagram.stories.find((s) => s.name === args.story)?.steps.length ?? 0;
    const index = Math.min(Math.max(0, args.index ?? count), count);
    const step = new YAMLMap();
    if (args.say != null) step.set("say", args.say);
    // A wordless step has to change something to be kept: it starts with an empty set, which
    // the first change fills.
    else step.set("set", new YAMLMap());
    seq.items.splice(writtenIndex(diagram, seq, args.story, index), 0, step);
  });
}

export interface StoryStepPatch {
  /** The caption; null or "" removes it (the step then carries on the beat before). */
  readonly say?: string | null;
  /** What's spoken; null or "" removes it. */
  readonly script?: string | null;
  readonly name?: string | null;
  /** Seconds; null goes back to long enough to read. */
  readonly hold?: number | null;
  readonly pace?: "normal" | "slow";
  readonly focus?: readonly string[];
  readonly zoom?: string | null;
  readonly rewind?: string | null;
}

function updateStepHere(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly story: string; readonly index: number; readonly patch: StoryStepPatch },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const step = stepMap(ctx, args.story, args.index);
    const { patch } = args;
    if (patch.say !== undefined) {
      const say = patch.say?.trim() ?? "";
      if (say === "") step.delete("say");
      else if (step.has("say")) step.set("say", say);
      // Words come first in a step, the way it reads.
      else step.items.unshift(new Pair(new Scalar("say"), new Scalar(say)));
    }
    if (patch.script !== undefined) {
      const script = patch.script?.trim() ?? "";
      setKey(step, "script", script === "" ? undefined : script);
    }
    if (patch.name !== undefined) {
      const name = patch.name?.trim() ?? "";
      if (name !== "" && (!isValidName(name) || name === "start"))
        throw new EditError(`"${name}" isn't a valid step name.`);
      setKey(step, "name", name === "" ? undefined : name);
    }
    if (patch.hold !== undefined)
      setKey(step, "hold", patch.hold === null ? undefined : `${patch.hold}s`);
    if (patch.pace !== undefined) setKey(step, "pace", patch.pace === "slow" ? "slow" : undefined);
    if (patch.focus !== undefined)
      setKey(step, "focus", patch.focus.length === 0 ? undefined : flowSeq(patch.focus));
    if (patch.zoom !== undefined) setKey(step, "zoom", patch.zoom ?? undefined);
    if (patch.rewind !== undefined) setKey(step, "rewind", patch.rewind ?? undefined);
    // A step that now says and changes nothing would be left out on reading: keep it as a
    // wordless step with an empty set, ready for a change.
    if (step.items.length === 0) step.set("set", new YAMLMap());
  });
}

/** Removes `count` steps from `from`. Removing a story's last step removes the story. */
function removeStepsHere(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly story: string; readonly from: number; readonly count?: number },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const seq = storySeq(ctx, args.story);
    const first = writtenIndex(diagram, seq, args.story, args.from);
    const last = writtenIndex(diagram, seq, args.story, args.from + (args.count ?? 1) - 1);
    seq.items.splice(first, last - first + 1);
    if (seq.items.length > 0) return;
    const section = storySection(ctx, args.story);
    section.delete(args.story);
    if (section.items.length === 0) {
      const file = diagram.stories.find((s) => s.name === args.story)?.source.file;
      if (file !== undefined) ctx.session.root(file).delete("stories");
    }
  });
}

/** Moves `count` steps starting at `from` so the first of them lands at `to` (as indexes are before the move). */
export function moveSteps(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    readonly story: string;
    readonly from: number;
    readonly count: number;
    readonly to: number;
  },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const seq = storySeq(ctx, args.story);
    const first = writtenIndex(diagram, seq, args.story, args.from);
    const moved = seq.items.splice(first, args.count);
    const target = args.to > args.from ? args.to - args.count : args.to;
    seq.items.splice(Math.min(Math.max(0, target), seq.items.length), 0, ...moved);
  });
}

/** Sets the choices a step offers: stories the viewer can play from there. */
export function setStepChoices(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    readonly story: string;
    readonly index: number;
    readonly choices: readonly { readonly label: string; readonly play: string }[];
  },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const step = stepMap(ctx, args.story, args.index);
    if (args.choices.length === 0) {
      step.delete("choices");
      return;
    }
    const seq = new YAMLSeq();
    for (const choice of args.choices) {
      const map = new YAMLMap();
      map.flow = true;
      map.set("label", new Scalar(choice.label));
      map.set("play", new Scalar(choice.play));
      seq.items.push(map);
    }
    step.set("choices", seq);
  });
}

/** Renames a story; slides that play it are told its new name (D-100). */
export function renameStory(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string; readonly to: string },
): EditResult {
  const result = renameStoryHere(files, diagram, args);
  const to = result.named ?? args.to;
  return {
    ...result,
    files: followIntoDecks(result.files, diagram.folder, (fields) =>
      fields.story === args.from ? { ...fields, story: to } : fields,
    ),
  };
}

/** Deletes a story; slides that played it play the first story again, all of it. */
export function deleteStory(files: ProjectFiles, diagram: Diagram, story: string): EditResult {
  const result = deleteStoryHere(files, diagram, story);
  return {
    ...result,
    files: followIntoDecks(result.files, diagram.folder, (fields) =>
      fields.story === story ? { ...fields, story: null, from: null, to: null } : fields,
    ),
  };
}

/** Changes a step; renaming it renames it where slides start or stop at it (D-100). */
export function updateStep(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly story: string; readonly index: number; readonly patch: StoryStepPatch },
): EditResult {
  const result = updateStepHere(files, diagram, args);
  const before = diagram.stories.find((story) => story.name === args.story)?.steps[args.index]
    ?.name;
  const after = args.patch.name;
  if (after === undefined || before === undefined || before === null || before === after)
    return result;
  return {
    ...result,
    files: followIntoDecks(result.files, diagram.folder, (fields, story) =>
      story !== args.story
        ? fields
        : {
            ...fields,
            ...(fields.from === before ? { from: after } : {}),
            ...(fields.to === before ? { to: after } : {}),
          },
    ),
  };
}

/** Removes steps; a slide that started or stopped at one of them plays from the start or to the end. */
export function removeSteps(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly story: string; readonly from: number; readonly count?: number },
): EditResult {
  const result = removeStepsHere(files, diagram, args);
  const steps = diagram.stories.find((story) => story.name === args.story)?.steps ?? [];
  const gone = new Set(
    steps
      .slice(args.from, args.from + (args.count ?? 1))
      .flatMap((step) => (step.name === null ? [] : [step.name])),
  );
  if (gone.size === 0) return result;
  return {
    ...result,
    files: followIntoDecks(result.files, diagram.folder, (fields, story) =>
      story !== args.story
        ? fields
        : {
            ...fields,
            ...(fields.from != null && gone.has(fields.from) ? { from: null } : {}),
            ...(fields.to != null && gone.has(fields.to) ? { to: null } : {}),
          },
    ),
  };
}
