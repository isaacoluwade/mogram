import { isQueue, routingOf } from "../capacity/plan";
import { describePattern } from "../capacity/patterns";
import { suggestedSizes } from "../capacity/presets";
import type { EditResult } from "../edit/context";
import { addConnection, updateElement } from "../edit/elements";
import { copySnippet, pasteSnippetNamed } from "../edit/files";
import { setFlowValue, setScale, setTrafficPattern } from "../edit/capacity";
import { EditError } from "../edit/session";
import { addScene, setSceneEntry } from "../edit/scenes";
import { parseDiagram } from "../format/parse";
import { computeLayout } from "../layout/compute";
import type { ConceptPlatform, ConceptTopic } from "../presets/concepts";
import type {
  Component,
  Concept,
  Connection,
  Diagram,
  GridPoint,
  ProjectFiles,
  Scale,
  SceneCapacity,
  SceneEntry,
} from "../model/types";

/**
 * Concepts (D-83): a diagram that explains an idea, applied to someone's own diagram or inserted
 * whole. Nothing here knows any particular concept: applying copies what the concept's role
 * elements do with traffic (scaling, capacity, hit rates…) onto the elements picked for those
 * roles, joins them the way the concept joins its roles, and brings the concept's scenes along,
 * aimed at the picked elements. So a concept anyone writes works the same way as a built-in one.
 */

/**
 * What changes, in plain words: shown before applying (a dry run) and after. Each line says how
 * things are once it's applied, so it reads the same either way. `notes` are what the person
 * should know that isn't a change (nothing leads into what they picked).
 */
export interface ConceptResult extends EditResult {
  readonly report: readonly string[];
  readonly notes: readonly string[];
}

/** Role element (in the concept) → element picked for it (in the diagram). */
export type ConceptBindings = Readonly<Record<string, string | undefined>>;

/** The concept a diagram is, or an error saying it isn't one. */
export function conceptOf(diagram: Diagram): Concept {
  const concept = diagram.settings.concept;
  if (concept === null) throw new EditError(`"${diagram.settings.name}" isn't a concept.`);
  return concept;
}

const parentOf = (diagram: Diagram, name: string): string | null =>
  diagram.components.get(name)?.parent ?? diagram.containers.get(name)?.parent ?? null;

/** The element and the containers around it, innermost first. */
function selfAndAncestors(diagram: Diagram, name: string): string[] {
  const out = [name];
  for (
    let at = parentOf(diagram, name);
    at !== null && !out.includes(at);
    at = parentOf(diagram, at)
  )
    out.push(at);
  return out;
}

const labelOf = (diagram: Diagram, name: string): string =>
  diagram.components.get(name)?.label ?? diagram.containers.get(name)?.label ?? name;

/** What sort of thing an element is, whichever cloud's icon it has. */
function familyOf(component: Component): string | null {
  const type = component.type;
  if (isQueue(component)) return "queue";
  if (routingOf(component) === "split") return "balancer";
  if (/(cache|redis|memcache|elasticache)/.test(type)) return "cache";
  if (/(sql|database|\/db|postgres|mysql|maria|cosmos|dynamo|mongo|spanner|aurora|rds)/.test(type))
    return "database";
  if (/(users?$|person|people|client|customer)/.test(type)) return "people";
  if (/(dns|traffic-manager|route-?53)/.test(type)) return "switch";
  if (
    /(server|virtual-machine|\/vm|ec2|compute|app-service|function|lambda|container|api|service|worker|web-app|cloud-run|pod|deployment)/.test(
      type,
    )
  )
    return "compute";
  return null;
}

/**
 * Who should play each role, from `names` (what's selected): an element that does what the role's
 * element does (scales, caches…) or has the same kind of icon, else whatever's left. Looking
 * through a whole diagram instead, pass a higher `minimum`, so only real likenesses count.
 */
export function suggestBindings(
  concept: Diagram,
  diagram: Diagram,
  names: readonly string[],
  minimum = 1,
): Record<string, string> {
  const roles = conceptOf(concept).roles;
  const candidates = names.filter(
    (name) => diagram.components.has(name) || diagram.containers.has(name),
  );
  const out: Record<string, string> = {};
  const taken = new Set<string>();
  const score = (role: string, name: string): number => {
    const want = concept.components.get(role);
    const have = diagram.components.get(name);
    if (concept.containers.has(role)) return diagram.containers.has(name) ? 1 : -1;
    if (want === undefined || have === undefined) return -1;
    let points = 1;
    if (want.type === have.type) points += 4;
    if (familyOf(want) !== null && familyOf(want) === familyOf(have)) points += 3;
    if (want.scale !== null && have.scale?.kind === want.scale.kind) points += 3;
    if (want.hit !== null && have.hit !== null) points += 3;
    if (want.scale !== null && have.shape !== null) points -= 5;
    return points;
  };
  // Best matches first, so a selected cache goes to the cache's role whatever the order.
  const pairs = roles
    .flatMap((role) =>
      candidates.map((name) => ({ role: role.element, name, points: score(role.element, name) })),
    )
    .filter((pair) => pair.points >= minimum)
    .sort((a, b) => b.points - a.points);
  for (const pair of pairs) {
    if (out[pair.role] !== undefined || taken.has(pair.name)) continue;
    out[pair.role] = pair.name;
    taken.add(pair.name);
  }
  return out;
}

/** Edits applied one after another, each on the diagram the last one left. */
class Steps {
  files: ProjectFiles;
  diagram: Diagram;
  readonly report: string[] = [];

  constructor(files: ProjectFiles, diagram: Diagram) {
    this.files = files;
    this.diagram = diagram;
  }

  run(step: (files: ProjectFiles, diagram: Diagram) => EditResult): EditResult {
    const result = step(this.files, this.diagram);
    this.files = result.files;
    const parsed = parseDiagram(result.files, this.diagram.folder);
    this.diagram = parsed.diagram;
    return result;
  }
}

function describeScale(scale: Scale): string {
  return scale.kind === "out"
    ? `scales out, ${scale.min} to ${scale.max} copies`
    : `scales up through ${scale.sizes.map((s) => s.name).join(", ")}`;
}

/** Applies a concept to elements of this diagram (`bindings`: role → element). */
export function applyConcept(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly concept: Diagram; readonly bindings: ConceptBindings },
): ConceptResult {
  const source = args.concept;
  const concept = conceptOf(source);
  const bound = new Map<string, string>();
  const used = new Set<string>();
  for (const role of concept.roles) {
    const name = args.bindings[role.element];
    if (name === undefined || name === "") {
      if (!role.optional) throw new EditError(`Pick what plays "${role.label}".`);
      continue;
    }
    const isComponent = source.components.has(role.element);
    const target = isComponent ? diagram.components.get(name) : diagram.containers.get(name);
    if (target === undefined)
      throw new EditError(
        `"${role.label}" is played by a ${isComponent ? "component" : "container"}, and "${name}" isn't one here.`,
      );
    if (used.has(name)) throw new EditError(`"${labelOf(diagram, name)}" can only play one part.`);
    const own = source.components.get(role.element);
    if (own?.scale != null && diagram.components.get(name)?.shape != null)
      throw new EditError(
        `"${labelOf(diagram, name)}" is a shape, and shapes don't scale. Pick an icon component.`,
      );
    bound.set(role.element, name);
    used.add(name);
  }
  if (bound.size === 0) throw new EditError("Pick at least one element to apply it to.");

  const steps = new Steps(files, diagram);

  // 1. What each role's element does with traffic.
  for (const [role, name] of bound) {
    const own = source.components.get(role);
    if (own === undefined) continue;
    copyBehaviour(steps, own, name);
  }

  // 2. Joined the way the concept joins its roles.
  const joined = new Map<string, string[]>();
  for (const connection of source.connections.values()) {
    const from = boundAt(source, bound, connection.from.element);
    const to = boundAt(source, bound, connection.to.element);
    if (from === undefined || to === undefined) continue;
    let mine = connectionsBetween(steps.diagram, from, to);
    if (mine.length === 0) {
      const added = steps.run((f, d) => addConnection(f, d, { from, to }));
      mine = (added.select ?? []).filter((n) => steps.diagram.connections.has(n));
      steps.report.push(
        `A new connection from ${labelOf(steps.diagram, from)} to ${labelOf(steps.diagram, to)}.`,
      );
    }
    joined.set(connection.name, mine);
  }
  for (const connection of source.connections.values()) {
    const mine = joined.get(connection.name) ?? [];
    for (const name of mine) copyConnection(steps, source, connection, name, joined);
  }

  // 3. Traffic that rises and falls (D-84), where it enters on its way to the picked elements.
  for (const connection of source.connections.values()) {
    const pattern = connection.pattern;
    if (pattern === null) continue;
    for (const name of translateConnection(source, steps.diagram, bound, joined, connection)) {
      const mine = steps.diagram.connections.get(name);
      if (mine === undefined || mine.pattern !== null || mine.traffic !== null) continue;
      steps.run((f, d) => setTrafficPattern(f, d, { name, pattern }));
      steps.report.push(`Traffic on ${arrow(steps.diagram, mine)} ${describePattern(pattern)}.`);
    }
  }

  // 4. The concept's scenes, aimed at the picked elements.
  const translate = (target: string): string[] => {
    const role = bound.get(target);
    if (role !== undefined) return [role];
    const connection = source.connections.get(target);
    if (connection === undefined) return [];
    return translateConnection(source, steps.diagram, bound, joined, connection);
  };
  const added: string[] = [];
  const extended: string[] = [];
  for (const scene of source.scenes) {
    const lines = scene.entries.flatMap((entry) =>
      translate(entry.target).map((target) => ({ target, entry })),
    );
    if (lines.length === 0) continue;
    let name = scene.name;
    if (steps.diagram.scenes.some((s) => s.name === scene.name)) extended.push(scene.label);
    else {
      const created = steps.run((f, d) => addScene(f, d, { label: scene.label }));
      name = created.named ?? scene.name;
      added.push(scene.label);
    }
    for (const { target, entry } of lines)
      steps.run((f, d) =>
        setSceneEntry(f, d, {
          scene: name,
          target,
          value: {
            state: entry.state,
            flow: entry.flow,
            motion: entry.motion,
            capacity: sceneCapacityFor(source, entry, steps.diagram, target),
          },
        }),
      );
  }
  if (added.length > 0)
    steps.report.push(`A new scene${added.length === 1 ? "" : "s"}: ${listOf(added)}.`);
  if (extended.length > 0)
    steps.report.push(
      `The scene${extended.length === 1 ? "" : "s"} ${listOf(extended)} ${extended.length === 1 ? "includes" : "include"} what you picked.`,
    );
  const traffic =
    [...source.connections.values()].some((c) => c.pattern !== null) ||
    source.scenes.some((s) => s.entries.some((e) => e.capacity?.traffic !== undefined));
  const brought = steps.report.some((line) => line.startsWith("Traffic on "));
  const notes: string[] = [];
  if (traffic && !brought && added.length + extended.length === 0)
    notes.push(
      "Nothing leads into what you picked yet, so there's no traffic to change. Connect something to it.",
    );
  return { files: steps.files, select: [...bound.values()], report: steps.report, notes };
}

/** "Shoppers → Front door" */
function arrow(diagram: Diagram, connection: Connection): string {
  return `${labelOf(diagram, connection.from.element)} → ${labelOf(diagram, connection.to.element)}`;
}

function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}

/** Scaling, capacity, routing, hit rate, queueing: what the role does, unless already set here. */
function copyBehaviour(steps: Steps, own: Component, name: string): void {
  const mine = steps.diagram.components.get(name);
  if (mine === undefined) return;
  const label = mine.label;
  if (own.scale !== null && mine.scale?.kind !== own.scale.kind) {
    // Sizes that fit what it is (a database's tiers, a machine's cores), at the concept's target.
    const scale: Scale =
      own.scale.kind === "up" ? { ...own.scale, sizes: suggestedSizes(mine).sizes } : own.scale;
    steps.run((f, d) => setScale(f, d, { name, scale }));
    steps.report.push(`${label} ${describeScale(scale)}.`);
  }
  if (own.capacity !== null && mine.capacity === null && mine.scale === null && own.scale === null)
    steps.run((f, d) => setFlowValue(f, d, { name, key: "capacity", value: own.capacity }));
  if (own.hit !== null && mine.hit === null) {
    steps.run((f, d) => setFlowValue(f, d, { name, key: "hit", value: own.hit }));
    steps.report.push(`${label} answers ${Math.round(own.hit * 100)}% of requests itself.`);
  }
  if (own.routing !== null && mine.routing === null) {
    steps.run((f, d) => setFlowValue(f, d, { name, key: "routing", value: own.routing }));
    steps.report.push(
      own.routing === "split"
        ? `${label} sends each request to one of the next steps, spreading them out.`
        : `${label} sends each request to every next step.`,
    );
  }
  if (own.queue === true && mine.queue === null) {
    steps.run((f, d) => setFlowValue(f, d, { name, key: "queue", value: true }));
    steps.report.push(`${label} holds requests until there's room to handle them.`);
  }
}

/** Shares, traffic and backups on a connection the concept joins two roles with. */
function copyConnection(
  steps: Steps,
  source: Diagram,
  connection: Connection,
  name: string,
  joined: ReadonlyMap<string, readonly string[]>,
): void {
  const mine = steps.diagram.connections.get(name);
  if (mine === undefined) return;
  if (connection.share !== null && mine.share === null) {
    steps.run((f, d) => setFlowValue(f, d, { name, key: "share", value: connection.share }));
    steps.report.push(
      `${arrow(steps.diagram, mine)} carries ${Math.round(connection.share * 100)}% of the traffic.`,
    );
  }
  if (connection.traffic !== null && mine.traffic === null) {
    steps.run((f, d) => setFlowValue(f, d, { name, key: "traffic", value: connection.traffic }));
    steps.report.push(
      `${arrow(steps.diagram, mine)} carries ${Math.round(connection.traffic * 100) / 100}× its usual traffic.`,
    );
  }
  if (connection.backupFor !== null && mine.backupFor === null) {
    const primary = joined.get(connection.backupFor)?.[0];
    const main = primary === undefined ? undefined : steps.diagram.connections.get(primary);
    if (main !== undefined && source.connections.has(connection.backupFor) && primary !== name) {
      steps.run((f, d) => updateElement(f, d, { name, set: { backup_for: main.name } }));
      steps.report.push(
        `${arrow(steps.diagram, mine)} takes over when ${labelOf(steps.diagram, main.to.element)} is down.`,
      );
    }
  }
}

/**
 * Who was picked for an element of the concept: its own role, or, for a container (a scale set),
 * the role inside it that traffic sent to it reaches.
 */
function boundAt(
  source: Diagram,
  bound: ReadonlyMap<string, string>,
  name: string,
): string | undefined {
  const own = bound.get(name);
  if (own !== undefined || !source.containers.has(name)) return own;
  for (const [role, picked] of bound)
    if (selfAndAncestors(source, role).includes(name)) return picked;
  return undefined;
}

/** Connections from one element to another, either end possibly the container around it. */
function connectionsBetween(diagram: Diagram, from: string, to: string): string[] {
  const froms = new Set(selfAndAncestors(diagram, from));
  const tos = new Set(selfAndAncestors(diagram, to));
  return [...diagram.connections.values()]
    .filter((c) => froms.has(c.from.element) && tos.has(c.to.element))
    .map((c) => c.name);
}

/**
 * Where a scene line on one of the concept's connections lands here. Between two roles: the
 * connections joining the picked elements. Where traffic enters the concept: where traffic enters
 * this diagram on its way to the first role it reaches, so a spike starts where people do. Into
 * or out of one role: the picked element's connections that way.
 */
function translateConnection(
  source: Diagram,
  diagram: Diagram,
  bound: ReadonlyMap<string, string>,
  joined: ReadonlyMap<string, readonly string[]>,
  connection: Connection,
): string[] {
  const both = joined.get(connection.name);
  if (both !== undefined) return [...both];
  const from = boundAt(source, bound, connection.from.element);
  const to = boundAt(source, bound, connection.to.element);
  if (from === undefined && isEntry(source, connection)) {
    const reached = firstRoleAfter(source, bound, connection);
    return reached === null ? [] : entriesInto(diagram, reached);
  }
  if (to !== undefined)
    return [...diagram.connections.values()]
      .filter((c) => selfAndAncestors(diagram, to).includes(c.to.element))
      .map((c) => c.name);
  if (from !== undefined)
    return [...diagram.connections.values()]
      .filter((c) => selfAndAncestors(diagram, from).includes(c.from.element))
      .map((c) => c.name);
  return [];
}

/** A connection out of something nothing feeds: where traffic starts. */
function isEntry(diagram: Diagram, connection: Connection): boolean {
  const start = connection.from.element;
  return ![...diagram.connections.values()].some((c) =>
    selfAndAncestors(diagram, start).includes(c.to.element),
  );
}

/** The first element downstream of a connection that someone picked, as picked. */
function firstRoleAfter(
  diagram: Diagram,
  bound: ReadonlyMap<string, string>,
  connection: Connection,
): string | null {
  const queue = [connection.to.element];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const at = queue.shift() ?? "";
    if (seen.has(at)) continue;
    seen.add(at);
    const picked = bound.get(at);
    if (picked !== undefined) return picked;
    // Into a container is into what's inside it.
    for (const child of [...diagram.components.values(), ...diagram.containers.values()])
      if (child.parent === at) queue.push(child.name);
    for (const next of diagram.connections.values())
      if (next.from.element === at) queue.push(next.to.element);
  }
  return null;
}

/** The connections where traffic enters this diagram on its way to `target`. */
function entriesInto(diagram: Diagram, target: string): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  const queue = [target];
  while (queue.length > 0) {
    const at = queue.shift() ?? "";
    if (seen.has(at)) continue;
    seen.add(at);
    const into = [...diagram.connections.values()].filter((c) =>
      selfAndAncestors(diagram, at).includes(c.to.element),
    );
    for (const c of into) {
      if (isEntry(diagram, c)) out.add(c.name);
      else queue.push(c.from.element);
    }
  }
  return [...out];
}

/** A scene line's capacity, with a size named the way the element here names its sizes. */
function sceneCapacityFor(
  source: Diagram,
  entry: SceneEntry,
  diagram: Diagram,
  target: string,
): SceneCapacity | null {
  const capacity = entry.capacity;
  if (capacity === undefined) return null;
  if (capacity.size === undefined) return capacity;
  const { size: named, ...rest } = capacity;
  const theirs = source.components.get(entry.target)?.scale;
  const mine = diagram.components.get(target)?.scale;
  if (theirs?.kind !== "up" || mine?.kind !== "up") return rest;
  // The same place in the list: their second size is this element's second size.
  const index = Math.max(
    0,
    theirs.sizes.findIndex((s) => s.name === named),
  );
  const size = mine.sizes[Math.min(index, mine.sizes.length - 1)]?.name;
  return size === undefined ? rest : { ...rest, size };
}

/**
 * Puts the concept's whole example into the diagram at `at` (grid units): its elements, under
 * fresh names where they're taken, and its scenes, merged into ones of the same name.
 */
export function insertConcept(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly concept: Diagram; readonly at: GridPoint },
): ConceptResult {
  const source = args.concept;
  const layout = computeLayout(source);
  const positions = new Map([...layout.elements].map(([name, element]) => [name, element.rel]));
  const top = [...source.components.values(), ...source.containers.values()]
    .filter((e) => e.parent === null)
    .map((e) => e.name);
  const text = copySnippet(source, top, positions);
  const pasted = pasteSnippetNamed(files, diagram, { text, parent: null, at: args.at });
  const steps = new Steps(pasted.result.files, diagram);
  steps.diagram = parseDiagram(steps.files, diagram.folder).diagram;
  const rename = (name: string): string => pasted.renamed.get(name) ?? name;
  const scenes: string[] = [];
  for (const scene of source.scenes) {
    let name = scene.name;
    if (!steps.diagram.scenes.some((s) => s.name === scene.name)) {
      name = steps.run((f, d) => addScene(f, d, { label: scene.label })).named ?? scene.name;
    }
    for (const entry of scene.entries)
      steps.run((f, d) =>
        setSceneEntry(f, d, {
          scene: name,
          target: rename(entry.target),
          value: {
            state: entry.state,
            flow: entry.flow,
            motion: entry.motion,
            capacity: entry.capacity ?? null,
          },
        }),
      );
    scenes.push(scene.label);
  }
  steps.report.push(`Added ${source.settings.name}.`);
  if (scenes.length > 0) steps.report.push(`Its scenes: ${listOf(scenes)}.`);
  return {
    files: steps.files,
    select: pasted.result.select ?? [],
    report: steps.report,
    notes: [],
  };
}

/** What a list of concepts shows about one (D-85). */
export interface ConceptInfo {
  readonly name: string;
  readonly summary: string | null;
  readonly topic: ConceptTopic | null;
  readonly platform: ConceptPlatform;
  readonly tags: readonly string[];
  /** A pattern you apply to your own elements, or an explainer you insert or open. */
  readonly kind: "pattern" | "explainer";
}

export const conceptKind = (concept: Concept): ConceptInfo["kind"] =>
  concept.roles.length > 0 ? "pattern" : "explainer";

/**
 * Whether a project is a concept, and what it's called, says and is about, without parsing the
 * files of every diagram that isn't one (lists of diagrams check each).
 */
export function conceptInfo(files: ProjectFiles, folder = ""): ConceptInfo | null {
  if (!Object.values(files).some((text) => /^concept:/m.test(text))) return null;
  const { diagram } = parseDiagram(files, folder);
  const concept = diagram.settings.concept;
  return concept === null
    ? null
    : {
        name: diagram.settings.name,
        summary: concept.summary,
        topic: concept.topic,
        platform: concept.platform,
        tags: concept.tags,
        kind: conceptKind(concept),
      };
}
