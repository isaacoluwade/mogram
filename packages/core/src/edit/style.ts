import { YAMLMap, isNode, type Node } from "yaml";
import { STYLE_KEYS as NAMED_STYLE_KEYS, type StyleTarget } from "../format/styles";
import { isValidName } from "../model/names";
import type { Diagram, ProjectFiles } from "../model/types";
import { edit, type EditContext, type EditResult } from "./context";
import type { ElementKind } from "./context";
import { EditError } from "./session";

/**
 * Copy style / paste style (05-ui-shell-commands §13.2, draw.io's `copyStyle`/`pasteStyle`):
 * the keys that set how an element looks — never what it is, where it sits or what it says —
 * copied from one element and written onto others. A key the source leaves at its default is
 * removed from the targets, so they end up looking the same. Between kinds, only the keys both
 * share travel (a component's colour onto a connection).
 */

type StyleKind = ElementKind | "shape";

/** The look keys of each kind, as named styles use them, plus the named style itself. */
const STYLE_KEYS: Readonly<Partial<Record<StyleKind, readonly string[]>>> = {
  shape: ["style", ...NAMED_STYLE_KEYS.shape],
  component: ["style", ...NAMED_STYLE_KEYS.component],
  container: ["style", ...NAMED_STYLE_KEYS.container],
  connection: ["style", ...NAMED_STYLE_KEYS.connection],
  decoration: ["tone", "style", "font", "font_size", "bold", "italic", "align", "color", "fill"],
};

export interface CopiedStyle {
  readonly kind: StyleKind;
  /** Each style key's YAML as written; a key missing here is at its default. */
  readonly values: ReadonlyMap<string, Node>;
}

/** The style of `name`, or null when it has none to copy (groups). */
export function readStyle(files: ProjectFiles, diagram: Diagram, name: string): CopiedStyle | null {
  let style: CopiedStyle | null = null;
  edit(files, diagram, (ctx) => {
    const found = ctx.kindOf(name);
    const kind: StyleKind | null = found !== null && ctx.isShape(name) ? "shape" : found;
    const keys = kind === null ? undefined : STYLE_KEYS[kind];
    if (kind === null || keys === undefined) return;
    const map = ctx.definition(name);
    const values = new Map<string, Node>();
    for (const key of keys) {
      const node: unknown = map.get(key, true);
      if (isNode(node)) values.set(key, node.clone() as Node);
    }
    style = { kind, values };
  });
  return style;
}

export function applyStyle(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly style: CopiedStyle },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const from = STYLE_KEYS[args.style.kind] ?? [];
    for (const name of args.names) {
      const found = ctx.kindOf(name);
      const kind: StyleKind | null = found !== null && ctx.isShape(name) ? "shape" : found;
      const keys = kind === null ? undefined : STYLE_KEYS[kind];
      if (keys === undefined) continue;
      const map = ctx.definition(name);
      for (const key of keys) {
        if (!from.includes(key)) continue;
        const value = args.style.values.get(key);
        if (value === undefined) map.delete(key);
        else map.set(key, value.clone());
      }
    }
    return [...args.names];
  });
}

/** Whether `style` has anything to give an element of `kind`. */
export function styleApplies(style: CopiedStyle, kind: StyleKind): boolean {
  const to = STYLE_KEYS[kind] ?? [];
  return (STYLE_KEYS[style.kind] ?? []).some((key) => to.includes(key));
}

// -------------------------------------------------------------------------------------------------
// Named styles (03-shapes-styles-library §4): `styles:` at the top, `style: name` on elements.

/** What a named style can be applied to, or null (groups, notes and text). */
function targetOf(ctx: EditContext, name: string): StyleTarget | null {
  const kind = ctx.kindOf(name);
  if (kind === "component") return ctx.isShape(name) ? "shape" : "component";
  if (kind === "container" || kind === "connection") return kind;
  return null;
}

/** The file holding the styles: where they already are, else the settings file. */
function stylesFile(diagram: Diagram): string {
  return [...diagram.styles.values()][0]?.source.file ?? diagram.settingsFile;
}

function styleMap(ctx: EditContext, diagram: Diagram, style: string): YAMLMap | null {
  const definition = diagram.styles.get(style);
  if (definition === undefined) return null;
  const section = ctx.session.section(definition.source.file, "styles");
  const node: unknown = section.get(style, true);
  if (node instanceof YAMLMap) return node;
  const map = new YAMLMap();
  map.flow = true;
  section.set(style, map);
  return map;
}

/** Gives `names` the style `style` (null: none). Their own keys still win over it. */
export function setNamedStyle(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly style: string | null },
): EditResult {
  if (args.style !== null && !diagram.styles.has(args.style))
    throw new EditError(`There is no style "${args.style}".`);
  return edit(files, diagram, (ctx) => {
    const changed: string[] = [];
    for (const name of args.names) {
      if (targetOf(ctx, name) === null) continue;
      const map = ctx.definition(name);
      if (args.style === null) map.delete("style");
      else map.set("style", args.style);
      changed.push(name);
    }
    return changed;
  });
}

/**
 * A new style from how `from` looks now (its own keys over its style's), which it then takes:
 * draw.io's "Edit style ▸ save as". Its own look keys move into the style.
 */
export function createNamedStyle(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string; readonly style: string },
): EditResult {
  const style = args.style.trim();
  if (!isValidName(style))
    throw new EditError(
      `"${style}" isn't a valid style name. Names start with a letter and use letters, numbers, "_" or "-".`,
    );
  if (diagram.styles.has(style)) throw new EditError(`There is already a style "${style}".`);
  return edit(files, diagram, (ctx) => {
    const target = targetOf(ctx, args.from);
    if (target === null) throw new EditError(`"${args.from}" can't take a named style.`);
    const map = ctx.definition(args.from);
    const values = new YAMLMap();
    values.flow = true;
    // What it inherits from its current style, then its own keys on top.
    const current = map.get("style");
    const inherited = typeof current === "string" ? styleMap(ctx, diagram, current) : null;
    for (const key of NAMED_STYLE_KEYS[target]) {
      const own: unknown = map.get(key, true);
      const from: unknown = isNode(own) ? own : inherited?.get(key, true);
      if (isNode(from)) values.set(key, from.clone());
      map.delete(key);
    }
    const section = ctx.session.section(stylesFile(diagram), "styles");
    section.set(style, values);
    map.set("style", style);
    return [args.from];
  });
}

/**
 * The style `from` takes, changed to match it (its own look keys move into the style), so every
 * element with that style follows. draw.io's "Set as default style", per style.
 */
export function updateNamedStyle(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const target = targetOf(ctx, args.from);
    const map = ctx.definition(args.from);
    const current = map.get("style");
    const values = typeof current === "string" ? styleMap(ctx, diagram, current) : null;
    if (target === null || values === null)
      throw new EditError(`"${args.from}" doesn't take a named style.`);
    for (const key of NAMED_STYLE_KEYS[target]) {
      const own: unknown = map.get(key, true);
      if (!isNode(own)) continue;
      values.set(key, own.clone());
      map.delete(key);
    }
    return [args.from];
  });
}

/** Drops the look keys `names` set themselves, so they look exactly like their style. */
export function resetToNamedStyle(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[] },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const changed: string[] = [];
    for (const name of args.names) {
      const target = targetOf(ctx, name);
      if (target === null) continue;
      const map = ctx.definition(name);
      if (typeof map.get("style") !== "string") continue;
      for (const key of NAMED_STYLE_KEYS[target]) map.delete(key);
      changed.push(name);
    }
    return changed;
  });
}

/** The look keys `name` sets itself on top of its named style (what "Reset to style" drops). */
export function styleOverrides(files: ProjectFiles, diagram: Diagram, name: string): string[] {
  let keys: string[] = [];
  edit(files, diagram, (ctx) => {
    const target = targetOf(ctx, name);
    if (target === null) return;
    const map = ctx.definition(name);
    keys = NAMED_STYLE_KEYS[target].filter((key) => map.has(key));
  });
  return keys;
}

/** Removes a named style; the elements that took it keep their own keys and lose the rest. */
export function deleteNamedStyle(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly style: string },
): EditResult {
  const definition = diagram.styles.get(args.style);
  if (definition === undefined) throw new EditError(`There is no style "${args.style}".`);
  return edit(files, diagram, (ctx) => {
    const section = ctx.session.section(definition.source.file, "styles");
    section.delete(args.style);
    if (section.items.length === 0) ctx.session.root(definition.source.file).delete("styles");
    const users = [
      ...diagram.components.values(),
      ...diagram.containers.values(),
      ...diagram.connections.values(),
    ].filter((element) => element.style === args.style);
    for (const element of users) ctx.definition(element.name).delete("style");
    return users.map((element) => element.name);
  });
}
