import { writeConnectionCapacity, writeFlowBehaviour } from "./capacity";
import { Document, Scalar, YAMLMap, isMap, isScalar, type Node } from "yaml";
import type {
  ElementExtras,
  ShapeLook,
  CardRef,
  Component,
  Connection,
  Container,
  Diagram,
  GridPoint,
  Group,
  ProjectFiles,
} from "../model/types";
import { LAYOUT_FILE, basename, dirname, isMogramFile, joinPath } from "../model/paths";
import { formatPaint } from "../presets/paint";
import { parseDiagram } from "../format/parse";
import { endpointToString } from "../format/read";
import { edit, type EditContext, type EditResult } from "./context";
import { EditError, flowSeq, insertSetting, pointNode, setKey } from "./session";
import { printDocument } from "./patch";
import { addEntry } from "./elements";

// -------------------------------------------------------------------------------------------------
// Settings

export type SettingKey = "name" | "description" | "theme" | "background" | "grid";

/** Diagram settings live in mogram.yaml or the single file (FI-8). */
export function setSetting(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly key: SettingKey; readonly value: string | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const root = ctx.session.root(diagram.settingsFile);
    const value = args.value === null || args.value.trim() === "" ? undefined : args.value.trim();
    if (args.key === "theme" && value === "midnight") {
      root.delete("theme");
      return;
    }
    if (value !== undefined && !root.has(args.key)) {
      insertSetting(root, args.key, new Scalar(value));
      return;
    }
    setKey(root, args.key, value);
  });
}

// -------------------------------------------------------------------------------------------------
// Files

/** Writes or deletes (`null`) a non-YAML project file: card markdown or an uploaded icon. */
export function writeProjectFile(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly path: string; readonly content: string | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    ctx.session.writeRaw(args.path, args.content);
  });
}

/**
 * Moves elements into another Mogram file of the same diagram (FI-13). This is the only time
 * Mogram moves definitions between files, and only because the user asked (FI-14). When a
 * single-file diagram gains a second file, its layout moves to layout.mogram.yaml (FI-10).
 */
export function moveToFile(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly file: string },
): EditResult {
  const target = args.file;
  if (!isMogramFile(target))
    throw new EditError(`"${basename(target)}" should end in .mogram.yaml.`);
  if (dirname(target) !== diagram.folder)
    throw new EditError("Elements can only move to a file in the same folder.");
  if (basename(target) === LAYOUT_FILE)
    throw new EditError("layout.mogram.yaml only holds coordinates.");
  return edit(files, diagram, (ctx) => {
    for (const name of args.names) {
      const kind = ctx.requireKind(name);
      if (kind === "decoration") continue;
      const source = ctx.fileOf(name);
      if (source === target) continue;
      const sectionKey = ctx.sectionOf(name);
      const from = ctx.session.section(source, sectionKey);
      const pair = from.items.find((item) => isScalar(item.key) && item.key.value === name);
      if (pair === undefined) continue;
      from.items.splice(from.items.indexOf(pair), 1);
      const to = ctx.session.section(target, sectionKey);
      if (isScalar(pair.key)) pair.key.spaceBefore = false;
      to.items.push(pair);
    }
    if (diagram.mode === "single" && files[target] === undefined) moveLayoutToOwnFile(ctx);
  });
}

function moveLayoutToOwnFile(ctx: EditContext): void {
  const single = ctx.diagram.layoutFile;
  const root = ctx.session.root(single);
  const pair = root.items.find((item) => isScalar(item.key) && item.key.value === "layout");
  if (pair === undefined) return;
  root.items.splice(root.items.indexOf(pair), 1);
  const layoutPath = joinPath(ctx.diagram.folder, LAYOUT_FILE);
  const layoutRoot = ctx.session.root(layoutPath);
  if (isScalar(pair.key)) pair.key.spaceBefore = false;
  layoutRoot.items.push(pair);
}

// -------------------------------------------------------------------------------------------------
// Clipboard (ED-4)

/** Clipboard text is Mogram YAML, so it can be pasted into any editor or another diagram. */
export function copySnippet(
  diagram: Diagram,
  names: readonly string[],
  positions: ReadonlyMap<string, GridPoint>,
): string {
  const selected = new Set<string>();
  const addWithChildren = (name: string): void => {
    if (selected.has(name)) return;
    if (!diagram.components.has(name) && !diagram.containers.has(name)) return;
    selected.add(name);
    for (const child of [...diagram.containers.values(), ...diagram.components.values()]) {
      if (child.parent === name) addWithChildren(child.name);
    }
  };
  for (const name of names) addWithChildren(name);
  if (selected.size === 0) return "";

  const topLevel = [...selected].filter((name) => {
    const parent =
      diagram.components.get(name)?.parent ?? diagram.containers.get(name)?.parent ?? null;
    return parent === null || !selected.has(parent);
  });
  const origin = {
    x: Math.min(...topLevel.map((name) => positions.get(name)?.x ?? 0)),
    y: Math.min(...topLevel.map((name) => positions.get(name)?.y ?? 0)),
  };

  const doc = new Document(new YAMLMap());
  const root = doc.contents as YAMLMap;
  root.set("mogram", "clipboard");
  const identity = (n: string): string => n;
  const section = (key: string): YAMLMap => {
    const node = root.get(key, true) as Node | undefined;
    if (isMap(node)) return node;
    const map = new YAMLMap();
    root.set(key, map);
    return map;
  };
  for (const container of diagram.containers.values()) {
    if (!selected.has(container.name)) continue;
    section("containers").set(
      container.name,
      containerNode(container, diagram.folder, identity, !topLevel.includes(container.name)),
    );
  }
  for (const component of diagram.components.values()) {
    if (!selected.has(component.name)) continue;
    section(component.shape === null ? "components" : "shapes").set(
      component.name,
      componentNode(component, diagram.folder, identity, !topLevel.includes(component.name)),
    );
  }
  for (const group of diagram.groups.values()) {
    if (group.members.length > 0 && group.members.every((member) => selected.has(member))) {
      section("groups").set(group.name, groupNode(group, identity));
    }
  }
  for (const connection of diagram.connections.values()) {
    if (selected.has(connection.from.element) && selected.has(connection.to.element)) {
      section("connections").set(
        connection.name,
        connectionNode(connection, diagram.folder, identity),
      );
    }
  }
  const layout = section("layout");
  for (const name of selected) {
    const at = positions.get(name);
    if (at === undefined) continue;
    const relative = topLevel.includes(name) ? { x: at.x - origin.x, y: at.y - origin.y } : at;
    const size = diagram.layout.get(name)?.size ?? null;
    if (size === null) layout.set(name, pointNode(relative));
    else {
      const entry = new YAMLMap();
      entry.flow = true;
      entry.set("at", pointNode(relative));
      entry.set("size", flowSeq([size.w, size.h]));
      layout.set(name, entry);
    }
  }
  return printDocument(doc, { indent: 2 });
}

/** True when text looks like something `copySnippet` produced (or any Mogram YAML). */
export function isMogramSnippet(text: string): boolean {
  return /^(mogram:|components:|containers:)/m.test(text);
}

/**
 * Pastes clipboard YAML at `at` inside `parent` (ED-4). Every pasted element gets a fresh unique
 * name and internal references follow.
 */
export function pasteSnippet(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly text: string; readonly parent: string | null; readonly at: GridPoint },
): EditResult {
  return pasteSnippetNamed(files, diagram, args).result;
}

/** Pastes like `pasteSnippet`, and says what each pasted element is called now. */
export function pasteSnippetNamed(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly text: string; readonly parent: string | null; readonly at: GridPoint },
): { readonly result: EditResult; readonly renamed: ReadonlyMap<string, string> } {
  const clip = parseDiagram({ "clipboard.mogram.yaml": args.text }).diagram;
  if (clip.components.size + clip.containers.size === 0)
    throw new EditError("There's nothing Mogram can paste on the clipboard.");
  const renamed = new Map<string, string>();
  const result = edit(files, diagram, (ctx) => {
    for (const name of [
      ...clip.containers.keys(),
      ...clip.components.keys(),
      ...clip.groups.keys(),
      ...clip.connections.keys(),
    ]) {
      renamed.set(name, ctx.claimName(name));
    }
    const rename = (name: string): string => renamed.get(name) ?? name;
    const parent = args.parent !== null && diagram.containers.has(args.parent) ? args.parent : null;
    const top: string[] = [];
    const place = (name: string, ownParent: string | null): void => {
      const newName = rename(name);
      const entry = clip.layout.get(name);
      const isTop = ownParent === null;
      if (isTop) top.push(newName);
      const at = entry?.at ?? { x: 0, y: 0 };
      const position = isTop ? { x: args.at.x + at.x, y: args.at.y + at.y } : at;
      ctx.setAt(newName, position);
      if (entry?.size != null) ctx.setSize(newName, entry.size);
    };
    for (const container of clip.containers.values()) {
      const ownParent = container.parent === null ? null : rename(container.parent);
      const node = containerNode(
        { ...container, parent: ownParent ?? parent },
        clip.folder,
        rename,
        true,
      );
      ctx.session
        .section(ctx.homeFor(ownParent ?? parent), "containers")
        .set(rename(container.name), node);
      place(container.name, ownParent);
    }
    for (const component of clip.components.values()) {
      const ownParent = component.parent === null ? null : rename(component.parent);
      const node = componentNode(
        { ...component, parent: ownParent ?? parent },
        clip.folder,
        rename,
        true,
      );
      addEntry(
        ctx.session.section(
          ctx.homeFor(ownParent ?? parent),
          component.shape === null ? "components" : "shapes",
        ),
        rename(component.name),
        node,
        true,
      );
      place(component.name, ownParent);
    }
    for (const group of clip.groups.values()) {
      ctx.session
        .section(ctx.homeFor(parent), "groups")
        .set(rename(group.name), groupNode(group, rename));
    }
    for (const connection of clip.connections.values()) {
      ctx.session
        .section(ctx.homeFor(parent), "connections")
        .set(rename(connection.name), connectionNode(connection, clip.folder, rename));
    }
    return top;
  });
  return { result, renamed };
}

// -------------------------------------------------------------------------------------------------
// Model → YAML (only non-default values, FI-3)

function cardNode(card: CardRef, folder: string): Node | string {
  if (card.kind === "file") {
    const path = relativeTo(folder, card.path);
    if (card.title === null) return path;
    const map = new YAMLMap();
    map.flow = true;
    map.set("title", card.title);
    map.set("file", path);
    return map;
  }
  if (card.title === null) return card.body;
  const map = new YAMLMap();
  map.set("title", card.title);
  map.set("body", card.body);
  return map;
}

function relativeTo(folder: string, path: string): string {
  if (folder.length === 0) return path;
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
}

function opensPath(folder: string, opens: string): string {
  const fromParts = folder.length === 0 ? [] : folder.split("/");
  const toParts = opens.split("/");
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  )
    common++;
  const ups = fromParts.length - common;
  const rest = toParts.slice(common).join("/");
  return ups === 0 ? `./${rest}` : `${"../".repeat(ups)}${rest}`;
}

function componentNode(
  component: Component,
  folder: string,
  rename: (n: string) => string,
  withParent: boolean,
): YAMLMap {
  const map = new YAMLMap();
  if (component.shape === null) map.set("type", component.type);
  else map.set("shape", component.shape);
  if (withParent && component.parent !== null) map.set("in", rename(component.parent));
  if (component.hasExplicitLabel) map.set("label", component.label);
  if (component.hasExplicitState && component.state !== "healthy")
    map.set("state", component.state);
  if (component.motion !== "none") map.set("motion", component.motion);
  if (component.intensity !== "normal") map.set("intensity", component.intensity);
  if (component.speed !== "normal") map.set("speed", component.speed);
  if (component.color !== null) map.set("color", component.color);
  if (component.card !== null) map.set("card", cardNode(component.card, folder));
  if (component.opens !== null) map.set("opens", opensPath(folder, component.opens));
  writeFlowBehaviour(map, component);
  if (component.look !== null) writeShapeLook(map, component.look);
  writeExtras(map, component, rename);
  return map;
}

/** A shape's look, writing only what differs from the defaults. */
function writeShapeLook(map: YAMLMap, look: ShapeLook): void {
  if (look.tone !== "neutral") map.set("tone", look.tone);
  if (look.fill !== null) map.set("fill", formatPaint(look.fill));
  if (look.stroke !== null) map.set("stroke", look.stroke);
  if (look.strokeWidth !== 1.5) map.set("stroke_width", look.strokeWidth);
  if (look.dash !== "solid") map.set("dash", look.dash);
  if (look.corner !== null) map.set("corner", look.corner);
  if (look.lid !== null) map.set("lid", look.lid);
  if (look.slant !== null) map.set("slant", look.slant);
  if (look.wave !== null) map.set("wave", look.wave);
  if (look.shadow) map.set("shadow", true);
  if (look.opacity !== 100) map.set("opacity", look.opacity);
  const text = look.text;
  if (text.font !== null) map.set("font", text.font);
  if (text.fontSize !== null) map.set("font_size", text.fontSize);
  if (text.bold) map.set("bold", true);
  if (text.italic) map.set("italic", true);
  if (text.align !== "center") map.set("align", text.align);
  if (text.color !== null) map.set("text_color", text.color);
}

function containerNode(
  container: Container,
  folder: string,
  rename: (n: string) => string,
  withParent: boolean,
): YAMLMap {
  const map = new YAMLMap();
  if (container.type !== "box") map.set("type", container.type);
  if (withParent && container.parent !== null) map.set("in", rename(container.parent));
  if (container.hasExplicitLabel) map.set("label", container.label);
  if (container.hasExplicitState && container.state !== "healthy")
    map.set("state", container.state);
  if (container.rollup !== "worst") map.set("rollup", container.rollup);
  if (container.color !== null) map.set("color", container.color);
  if (container.icon !== null) map.set("icon", container.icon);
  if (container.card !== null) map.set("card", cardNode(container.card, folder));
  writeExtras(map, container, rename);
  return map;
}

function groupNode(group: Group, rename: (n: string) => string): YAMLMap {
  const map = new YAMLMap();
  if (group.hasExplicitLabel) map.set("label", group.label);
  map.set("members", flowSeq(group.members.map(rename)));
  writeExtras(map, group, rename);
  return map;
}

function connectionNode(
  connection: Connection,
  folder: string,
  rename: (n: string) => string,
): YAMLMap {
  const map = new YAMLMap();
  map.set(
    "from",
    endpointToString({ ...connection.from, element: rename(connection.from.element) }),
  );
  map.set("to", endpointToString({ ...connection.to, element: rename(connection.to.element) }));
  if (connection.flow !== "idle") map.set("flow", connection.flow);
  if (connection.text !== null) map.set("label", connection.text);
  if (connection.direction !== "forward") map.set("direction", connection.direction);
  if (connection.speed !== "normal") map.set("speed", connection.speed);
  if (connection.density !== "normal") map.set("density", connection.density);
  if (connection.route !== "orthogonal") map.set("route", connection.route);
  if (connection.color !== null) map.set("color", connection.color);
  if (connection.backupFor !== null) map.set("backup_for", rename(connection.backupFor));
  if (connection.card !== null) map.set("card", cardNode(connection.card, folder));
  writeConnectionCapacity(map, connection);
  writeExtras(map, connection, rename);
  return map;
}

/** `link:` and `data:` travel with a copied element; element links follow renamed copies. */
function writeExtras(map: YAMLMap, element: ElementExtras, rename: (n: string) => string): void {
  const link = element.link;
  if (link !== null)
    map.set(
      "link",
      link.kind === "url"
        ? link.url
        : link.kind === "scene"
          ? `scene:${link.scene}`
          : link.kind === "tour"
            ? `tour:${link.tour}`
            : `#${rename(link.element)}`,
    );
  if (element.data.size > 0) {
    const data = new YAMLMap();
    data.flow = true;
    for (const [key, value] of element.data) data.set(key, value);
    map.set("data", data);
  }
}
