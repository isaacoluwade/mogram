import { findDiagramFolders } from "../format/project";
import { parseDiagram } from "../format/parse";
import type { Diagram, ProjectFiles } from "../model/types";
import { isMogramFile } from "../model/paths";

/**
 * What changed between two versions of a project, by name (version history: the summary on each
 * version, Show changes, bring back). Mogram can say "added Payments API" rather than "line 42
 * changed" because every element, scene and tour has a name.
 */

export type ChangeKind = "added" | "removed" | "changed";

export type ChangedThing =
  | "component"
  | "shape"
  | "container"
  | "group"
  | "connection"
  | "note"
  | "scene"
  | "tour"
  | "settings"
  | "style"
  | "file";

export interface Change {
  /** The diagram folder ("" is the top diagram); for files, the file's folder. */
  readonly folder: string;
  readonly thing: ChangedThing;
  /** Element, scene, tour or style name; the path for files; "settings" for settings. */
  readonly name: string;
  /** What people read: the element's label, the scene's label, the file name. */
  readonly label: string;
  readonly change: ChangeKind;
  /**
   * For a change: what differs, in plain words (label, state, style, container, position,
   * size, route…). Only "position", "size" and "route" means it was moved, not edited.
   */
  readonly fields: readonly string[];
}

export interface ProjectDiff {
  readonly changes: readonly Change[];
}

/** Keys that say where a model came from, not what it is. */
const IGNORED = new Set(["source", "hasExplicitLabel", "hasExplicitState", "hasExplicitArrows"]);

/** Plain words for model fields. */
const FIELD_NAMES: Readonly<Record<string, string>> = {
  parent: "container",
  look: "style",
  text: "label",
  card: "card",
  opens: "nested diagram",
  arrows: "arrowheads",
  arrowSize: "arrowheads",
  dash: "line",
  backupFor: "backup",
  members: "members",
  entries: "states",
  steps: "steps",
  scale: "scaling",
  hit: "hit rate",
  pattern: "traffic pattern",
};

/** A stable JSON-able form: maps and sets sorted, provenance dropped. */
function canon(value: unknown): unknown {
  if (value instanceof Map)
    return [...value.entries()]
      .map(([k, v]) => [String(k), canon(v)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  if (value instanceof Set) return [...value].map(String).sort();
  if (Array.isArray(value)) return value.map(canon);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (IGNORED.has(key)) continue;
      out[key] = canon((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** The top-level fields that differ, in plain words, without repeats. */
function changedFields(a: object, b: object): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = new Set<string>();
  for (const key of keys) {
    if (IGNORED.has(key)) continue;
    const before = (a as Record<string, unknown>)[key];
    const after = (b as Record<string, unknown>)[key];
    if (!same(before, after)) out.add(FIELD_NAMES[key] ?? key);
  }
  return [...out];
}

/** What a layout entry change means: moved, resized, rerouted, label moved, locked. */
function layoutFields(diagramA: Diagram, diagramB: Diagram, name: string): string[] {
  const a = diagramA.layout.get(name);
  const b = diagramB.layout.get(name);
  if (same(a, b)) return [];
  const out: string[] = [];
  if (!same(a?.at, b?.at)) out.push("position");
  if (!same(a?.size, b?.size)) out.push("size");
  if (
    !same(a?.via, b?.via) ||
    !same(a?.fromAnchor, b?.fromAnchor) ||
    !same(a?.toAnchor, b?.toAnchor)
  )
    out.push("route");
  if (!same(a?.label, b?.label)) out.push("label position");
  if (a?.locked !== b?.locked) out.push(b?.locked === true ? "locked" : "unlocked");
  if (a?.z !== b?.z) out.push("order");
  return out;
}

/** Changes that only move things around, rather than change what they are. */
export const LAYOUT_FIELDS: ReadonlySet<string> = new Set([
  "position",
  "size",
  "route",
  "label position",
  "order",
]);

export function isMoveOnly(change: Change): boolean {
  return change.change === "changed" && change.fields.every((field) => LAYOUT_FIELDS.has(field));
}

interface Named {
  readonly name: string;
}

function compareMaps<T extends Named>(
  out: Change[],
  folder: string,
  before: ReadonlyMap<string, T>,
  after: ReadonlyMap<string, T>,
  thing: (item: T) => ChangedThing,
  label: (item: T) => string,
  layout?: { a: Diagram; b: Diagram },
): void {
  for (const [name, item] of after) {
    const old = before.get(name);
    if (old === undefined) {
      out.push({
        folder,
        thing: thing(item),
        name,
        label: label(item),
        change: "added",
        fields: [],
      });
      continue;
    }
    const fields = [
      ...changedFields(old, item),
      ...(layout === undefined ? [] : layoutFields(layout.a, layout.b, name)),
    ];
    if (fields.length > 0)
      out.push({ folder, thing: thing(item), name, label: label(item), change: "changed", fields });
  }
  for (const [name, item] of before) {
    if (!after.has(name))
      out.push({
        folder,
        thing: thing(item),
        name,
        label: label(item),
        change: "removed",
        fields: [],
      });
  }
}

const byName = <T extends Named>(items: readonly T[]): ReadonlyMap<string, T> =>
  new Map(items.map((item) => [item.name, item]));

const firstLine = (text: string): string => {
  const line =
    text
      .split("\n")[0]
      ?.replace(/[*_#>`]/g, "")
      .trim() ?? "";
  return line.length > 40 ? `${line.slice(0, 39)}…` : line;
};

/** Changes within one diagram. */
export function diffDiagrams(before: Diagram, after: Diagram, folder = after.folder): Change[] {
  const out: Change[] = [];
  const layout = { a: before, b: after };
  compareMaps(
    out,
    folder,
    before.components,
    after.components,
    (c) => (c.shape === null ? "component" : "shape"),
    (c) => c.label,
    layout,
  );
  compareMaps(
    out,
    folder,
    before.containers,
    after.containers,
    () => "container",
    (c) => c.label,
    layout,
  );
  compareMaps(
    out,
    folder,
    before.groups,
    after.groups,
    () => "group",
    (g) => g.label,
  );
  compareMaps(
    out,
    folder,
    before.connections,
    after.connections,
    () => "connection",
    (c) => c.text ?? `${c.from.element} → ${c.to.element}`,
    layout,
  );
  compareMaps(
    out,
    folder,
    before.decorations,
    after.decorations,
    () => "note",
    (d) => firstLine(d.text) || d.name,
    layout,
  );
  compareMaps(
    out,
    folder,
    byName(before.scenes),
    byName(after.scenes),
    () => "scene",
    (s) => s.label,
  );
  compareMaps(
    out,
    folder,
    byName(before.tours),
    byName(after.tours),
    () => "tour",
    (t) => t.title,
  );
  compareMaps(
    out,
    folder,
    before.styles,
    after.styles,
    () => "style",
    (s) => s.name,
  );
  const settings = changedFields(before.settings, after.settings);
  if (settings.length > 0)
    out.push({
      folder,
      thing: "settings",
      name: "settings",
      label: "Diagram settings",
      change: "changed",
      fields: settings,
    });
  return out;
}

/**
 * Changes across a whole project: every diagram folder, plus the other files (cards, icons)
 * added, removed or edited.
 */
export function diffProjects(before: ProjectFiles, after: ProjectFiles): ProjectDiff {
  const changes: Change[] = [];
  const folders = new Set([...findDiagramFolders(before), ...findDiagramFolders(after)]);
  for (const folder of [...folders].sort()) {
    const a = parseDiagram(before, folder).diagram;
    const b = parseDiagram(after, folder).diagram;
    changes.push(...diffDiagrams(a, b, folder));
  }
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const path of [...paths].sort()) {
    if (isMogramFile(path)) continue;
    const a = before[path];
    const b = after[path];
    if (a === b) continue;
    const slash = path.lastIndexOf("/");
    changes.push({
      folder: slash < 0 ? "" : path.slice(0, slash),
      thing: "file",
      name: path,
      label: slash < 0 ? path : path.slice(slash + 1),
      change: a === undefined ? "added" : b === undefined ? "removed" : "changed",
      fields: [],
    });
  }
  return { changes };
}

export interface DiffStats {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly moved: number;
}

export function diffStats(diff: ProjectDiff): DiffStats {
  let added = 0;
  let removed = 0;
  let changed = 0;
  let moved = 0;
  for (const change of diff.changes) {
    if (change.change === "added") added++;
    else if (change.change === "removed") removed++;
    else if (isMoveOnly(change)) moved++;
    else changed++;
  }
  return { added, removed, changed, moved };
}

const listNames = (labels: readonly string[], max: number): string => {
  const shown = labels.slice(0, max);
  const rest = labels.length - shown.length;
  if (rest <= 0) return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown.join(", ");
  return `${shown.join(", ")} and ${rest} more`;
};

/**
 * One line for a version: "Added Payments API and Orders DB · changed 3 · removed 1 · moved 2".
 * Additions are named (people look for those); the rest are counted.
 */
export function summarizeDiff(diff: ProjectDiff): string {
  if (diff.changes.length === 0) return "No changes";
  const added = diff.changes.filter((c) => c.change === "added").map((c) => c.label);
  const removed = diff.changes.filter((c) => c.change === "removed").map((c) => c.label);
  const { changed, moved } = diffStats(diff);
  const parts: string[] = [];
  if (added.length > 0) parts.push(`added ${listNames(added, 2)}`);
  if (removed.length > 0)
    parts.push(
      added.length === 0 ? `removed ${listNames(removed, 2)}` : `removed ${removed.length}`,
    );
  if (changed > 0) {
    const only = diff.changes.filter((c) => c.change === "changed" && !isMoveOnly(c));
    const one = changed === 1 && added.length + removed.length === 0 ? only[0] : undefined;
    parts.push(
      one === undefined
        ? `changed ${changed}`
        : one.thing !== "settings"
          ? `changed ${one.label}`
          : one.fields.length === 1 && one.fields[0] === "name"
            ? "renamed the diagram"
            : "changed the diagram settings",
    );
  }
  if (moved > 0) parts.push(`moved ${moved}`);
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}
