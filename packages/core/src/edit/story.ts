import { Scalar, YAMLMap, isMap, isScalar, type Node } from "yaml";
import type { Diagram, ProjectFiles, Tour } from "../model/types";
import { humanize, isValidName, toName, uniqueName } from "../model/names";
import type { FlowPreset, MotionPreset, StatePreset } from "../presets/names";
import { mainPath } from "../tours/graph";
import { edit, type EditContext, type EditResult } from "./context";
import { EditError, flowMap, renameKey, scalarString, setKey } from "./session";

// -------------------------------------------------------------------------------------------------
// Scenes (SC-5, SC-6)

function sceneSection(ctx: EditContext, scene: string): YAMLMap {
  const existing = ctx.diagram.scenes.find((s) => s.name === scene);
  if (existing === undefined) throw new EditError(`There is no scene called "${scene}".`);
  return ctx.session.section(existing.source.file, "scenes");
}

function sceneMap(ctx: EditContext, scene: string): YAMLMap {
  const section = sceneSection(ctx, scene);
  const node = section.get(scene, true) as Node | undefined;
  if (isMap(node)) return node;
  const map = new YAMLMap();
  section.set(scene, map);
  return map;
}

function sceneNames(diagram: Diagram): Set<string> {
  return new Set(diagram.scenes.map((scene) => scene.name));
}

export function addScene(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly label: string; readonly copyFrom?: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const base = toName(args.label, "scene");
    const name = uniqueName(isValidName(base) ? base : "scene", sceneNames(diagram));
    const file =
      args.copyFrom === undefined
        ? ctx.storyFile("scenes")
        : (diagram.scenes.find((s) => s.name === args.copyFrom)?.source.file ??
          ctx.storyFile("scenes"));
    const section = ctx.session.section(file, "scenes");
    if (args.copyFrom !== undefined) {
      const source = sceneMap(ctx, args.copyFrom);
      section.set(name, source.clone());
    } else {
      section.set(name, new Scalar(null));
    }
    ctx.setNamed(name);
  });
}

export function renameScene(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string; readonly to: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    ctx.setNamed(args.to);
    if (args.from === args.to) return;
    if (!isValidName(args.to)) throw new EditError(`"${args.to}" isn't a valid scene name.`);
    if (sceneNames(diagram).has(args.to))
      throw new EditError(`There is already a scene called "${args.to}".`);
    renameKey(sceneSection(ctx, args.from), args.from, args.to);
    rewriteTourScenes(ctx, (scene) => (scene === args.from ? args.to : scene));
  });
}

export function deleteScene(files: ProjectFiles, diagram: Diagram, scene: string): EditResult {
  return edit(files, diagram, (ctx) => {
    sceneSection(ctx, scene).delete(scene);
    rewriteTourScenes(ctx, (value) => (value === scene ? null : value));
  });
}

/** Reorders scenes (SC-6). Scenes in several files are reordered within each file. */
export function reorderScenes(
  files: ProjectFiles,
  diagram: Diagram,
  order: readonly string[],
): EditResult {
  return edit(files, diagram, (ctx) => {
    const rank = new Map(order.map((name, index) => [name, index]));
    const touched = new Set(diagram.scenes.map((scene) => scene.source.file));
    for (const file of touched) {
      const section = ctx.session.section(file, "scenes");
      const spacing = section.items.map((pair) =>
        isScalar(pair.key) ? pair.key.spaceBefore === true : false,
      );
      section.items.sort((a, b) => {
        const ra = rank.get(String(isScalar(a.key) ? a.key.value : "")) ?? Infinity;
        const rb = rank.get(String(isScalar(b.key) ? b.key.value : "")) ?? Infinity;
        return ra - rb;
      });
      // Keep blank-line spacing by position, not by scene, so the diff is only the moved lines.
      section.items.forEach((pair, index) => {
        if (isScalar(pair.key)) pair.key.spaceBefore = spacing[index] === true;
      });
    }
  });
}

export interface SceneValue {
  readonly state?: StatePreset | null;
  readonly flow?: FlowPreset | null;
  readonly motion?: MotionPreset | null;
}

/**
 * Sets what one element looks like in a scene. A value equal to normal removes the line, so a
 * scene only ever records differences (SC-5).
 */
export function setSceneEntry(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    readonly scene: string;
    readonly target: string;
    readonly value: SceneValue | null;
    /**
     * The element's own values, for a target inside a nested diagram (`aks.checkout`), which
     * this diagram doesn't define: a scene only records what differs from them (SC-5).
     */
    readonly base?: SceneValue;
  },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const map = sceneMap(ctx, args.scene);
    const value = args.value;
    const component = diagram.components.get(args.target);
    const container = diagram.containers.get(args.target);
    const connection = diagram.connections.get(args.target);
    const baseState = args.base?.state ?? component?.state ?? container?.state ?? null;
    const baseMotion = args.base?.motion ?? component?.motion ?? "none";
    const baseFlow = args.base?.flow ?? connection?.flow ?? null;

    const state = value?.state != null && value.state !== baseState ? value.state : null;
    const flow = value?.flow != null && value.flow !== baseFlow ? value.flow : null;
    const motion = value?.motion != null && value.motion !== baseMotion ? value.motion : null;

    if (state === null && flow === null && motion === null) {
      map.delete(args.target);
    } else if (motion === null) {
      map.set(args.target, state ?? flow);
    } else {
      const entries: [string, string][] = [];
      if (state !== null) entries.push(["state", state]);
      if (flow !== null) entries.push(["flow", flow]);
      entries.push(["motion", motion]);
      map.set(args.target, flowMap(entries));
    }
    if (map.items.length === 0) sceneSection(ctx, args.scene).set(args.scene, new Scalar(null));
  });
}

function rewriteTourScenes(ctx: EditContext, replace: (scene: string) => string | null): void {
  for (const tour of ctx.diagram.tours) {
    const map = tourMap(ctx, tour.name);
    const steps = map.get("steps", true) as Node | undefined;
    if (!isMap(steps)) continue;
    for (const step of steps.items) {
      if (!isMap(step.value)) continue;
      rewriteSceneKey(step.value, replace);
      const choices = step.value.get("choices", true) as Node | undefined;
      if (!isMap(choices)) continue;
      for (const choice of choices.items)
        if (isMap(choice.value)) rewriteSceneKey(choice.value, replace);
    }
  }
}

function rewriteSceneKey(map: YAMLMap, replace: (scene: string) => string | null): void {
  const value = scalarString(map.get("scene", true));
  if (value === null) return;
  const next = replace(value);
  if (next !== value) setKey(map, "scene", next ?? undefined);
}

// -------------------------------------------------------------------------------------------------
// Tours (TO-9, TO-10)

/**
 * Tours are always written in block style, as the format documents them. (A brand-new tour is an
 * empty map, which YAML can only print as `{}`; it turns into a block when it gets content.)
 */
function tourMap(ctx: EditContext, tour: string): YAMLMap {
  const existing = ctx.diagram.tours.find((t) => t.name === tour);
  if (existing === undefined) throw new EditError(`There is no tour called "${tour}".`);
  const section = ctx.session.section(existing.source.file, "tours");
  const node = section.get(tour, true) as Node | undefined;
  if (isMap(node)) {
    node.flow = false;
    return node;
  }
  const map = new YAMLMap();
  section.set(tour, map);
  return map;
}

function stepsMap(ctx: EditContext, tour: string): YAMLMap {
  const map = tourMap(ctx, tour);
  const node = map.get("steps", true) as Node | undefined;
  if (isMap(node)) {
    node.flow = false;
    return node;
  }
  const steps = new YAMLMap();
  map.set("steps", steps);
  return steps;
}

function stepMap(ctx: EditContext, tour: string, step: string): YAMLMap {
  const steps = stepsMap(ctx, tour);
  const node = steps.get(step, true) as Node | undefined;
  if (isMap(node)) return node;
  const map = new YAMLMap();
  steps.set(step, map);
  return map;
}

function requireTour(diagram: Diagram, name: string): Tour {
  const tour = diagram.tours.find((t) => t.name === name);
  if (tour === undefined) throw new EditError(`There is no tour called "${name}".`);
  return tour;
}

export function addTour(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly title: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const base = toName(args.title, "tour");
    const name = uniqueName(
      isValidName(base) ? base : "tour",
      new Set(diagram.tours.map((t) => t.name)),
    );
    const map = new YAMLMap();
    if (args.title.trim() !== humanize(name)) map.set("title", args.title.trim());
    ctx.session.section(ctx.storyFile("tours"), "tours").set(name, map);
    ctx.setNamed(name);
  });
}

export function updateTour(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    readonly tour: string;
    readonly title?: string;
    readonly start?: string | null;
    readonly rename?: string;
  },
): EditResult {
  return edit(files, diagram, (ctx) => {
    requireTour(diagram, args.tour);
    const map = tourMap(ctx, args.tour);
    const name = args.rename ?? args.tour;
    if (args.title !== undefined)
      setKey(map, "title", args.title.trim() === humanize(name) ? undefined : args.title.trim());
    if (args.start !== undefined) setKey(map, "start", args.start ?? undefined);
    if (args.rename !== undefined && args.rename !== args.tour) {
      if (!isValidName(args.rename))
        throw new EditError(`"${args.rename}" isn't a valid tour name.`);
      if (diagram.tours.some((t) => t.name === args.rename))
        throw new EditError(`There is already a tour called "${args.rename}".`);
      const existing = requireTour(diagram, args.tour);
      renameKey(ctx.session.section(existing.source.file, "tours"), args.tour, args.rename);
    }
    ctx.setNamed(name);
  });
}

export function deleteTour(files: ProjectFiles, diagram: Diagram, tour: string): EditResult {
  return edit(files, diagram, (ctx) => {
    const existing = requireTour(diagram, tour);
    ctx.session.section(existing.source.file, "tours").delete(tour);
  });
}

/**
 * Appends a step by clicking an element (TO-9): the last step on the main path now leads to it.
 */
export function appendTourStep(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly tour: string; readonly target: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const tour = requireTour(diagram, args.tour);
    const path = mainPath(tour);
    const last = path[path.length - 1];
    if (last === args.target) return;
    // Clicking a part that's already on the path would quietly loop the tour back to it.
    const earlier = path.indexOf(args.target);
    if (earlier !== -1)
      throw new EditError(
        `That's already step ${earlier + 1} of this tour. To come back to it, add a branch instead.`,
      );
    // The first step is the tour's start; each later one is the previous step's `next`. A final
    // step needs no entry of its own.
    if (last === undefined) {
      tourMap(ctx, args.tour).set("start", args.target);
      return;
    }
    const lastStep = tour.steps.get(last);
    if (lastStep === undefined || (lastStep.next === null && lastStep.choices.length === 0)) {
      stepMap(ctx, args.tour, last).set("next", args.target);
    }
  });
}

/** Removes a step and joins its neighbours so the tour stays connected. */
export function removeTourStep(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly tour: string; readonly target: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const tour = requireTour(diagram, args.tour);
    const removed = tour.steps.get(args.target);
    const continueTo = removed?.next ?? removed?.choices[0]?.next ?? null;
    const steps = stepsMap(ctx, args.tour);
    steps.delete(args.target);
    for (const [target, step] of tour.steps) {
      if (target === args.target) continue;
      if (step.next === args.target)
        setKey(stepMap(ctx, args.tour, target), "next", continueTo ?? undefined);
      if (step.choices.some((choice) => choice.next === args.target)) {
        const choices = stepMap(ctx, args.tour, target).get("choices", true) as Node | undefined;
        if (isMap(choices)) {
          for (const choice of choices.items) {
            if (isScalar(choice.value) && choice.value.value === args.target)
              choice.value.value = continueTo;
            else if (isMap(choice.value) && choice.value.get("next") === args.target)
              setKey(choice.value, "next", continueTo ?? undefined);
          }
          choices.items = choices.items.filter(
            (choice) => !(isScalar(choice.value) && choice.value.value === null),
          );
        }
      }
    }
    if (tour.start === args.target)
      setKey(tourMap(ctx, args.tour), "start", continueTo ?? undefined);
  });
}

export interface StepPatch {
  readonly next?: string | null;
  readonly scene?: string | null;
}

export function updateTourStep(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly tour: string; readonly step: string; readonly set: StepPatch },
): EditResult {
  return edit(files, diagram, (ctx) => {
    requireTour(diagram, args.tour);
    const map = stepMap(ctx, args.tour, args.step);
    if (args.set.next !== undefined) setKey(map, "next", args.set.next ?? undefined);
    if (args.set.scene !== undefined) setKey(map, "scene", args.set.scene ?? undefined);
    if (args.set.next != null) {
      const steps = stepsMap(ctx, args.tour);
      if (!steps.has(args.set.next)) steps.set(args.set.next, new Scalar(null));
    }
  });
}

export interface ChoiceInput {
  readonly label: string;
  readonly next: string | null;
  readonly scene?: string | null;
}

/**
 * Replaces a step's choices (TO-6). The first time a linear step branches, its existing `next`
 * becomes the first choice so nothing the author wrote is lost.
 */
export function setTourChoices(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly tour: string; readonly step: string; readonly choices: readonly ChoiceInput[] },
): EditResult {
  return edit(files, diagram, (ctx) => {
    requireTour(diagram, args.tour);
    const map = stepMap(ctx, args.tour, args.step);
    if (args.choices.length === 0) {
      map.delete("choices");
      return;
    }
    const labels = new Set<string>();
    const choices = new YAMLMap();
    for (const choice of args.choices) {
      const label = choice.label.trim();
      if (label.length === 0)
        throw new EditError("Every choice needs a label, like “Normal read”.");
      if (labels.has(label)) throw new EditError(`Two choices are both called “${label}”.`);
      labels.add(label);
      if (choice.scene == null) choices.set(label, choice.next);
      else
        choices.set(
          label,
          flowMap([
            ["next", choice.next ?? ""],
            ["scene", choice.scene],
          ]),
        );
    }
    map.delete("next");
    map.set("choices", choices);
    const steps = stepsMap(ctx, args.tour);
    for (const choice of args.choices) {
      if (choice.next !== null && !steps.has(choice.next)) steps.set(choice.next, new Scalar(null));
    }
  });
}
