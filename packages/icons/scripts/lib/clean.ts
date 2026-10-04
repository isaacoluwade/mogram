import { parseSvg, walk, type SvgElement, type SvgNode } from "./svg";

/** Elements that only carry authoring or accessibility text the app supplies itself. */
const NOISE_ELEMENTS = new Set(["title", "desc", "metadata"]);

/** Attributes editors leave behind that change nothing on screen. */
const NOISE_ATTRIBUTES = new Set(["data-name", "xml:space", "enable-background", "version"]);

/**
 * The root keeps only what defines its drawing. Width and height go so every icon scales to
 * the box the renderer gives it; `xviewBox` is a typo in one Microsoft file and is repaired.
 */
const ROOT_ONLY_NOISE = new Set(["id", "class", "width", "height", "x", "y", "xviewBox"]);

/** Strips comments, titles, editor attributes and whitespace between tags. */
export function removeNoise(svg: SvgElement): void {
  repairViewBox(svg);
  for (const name of ROOT_ONLY_NOISE) svg.attributes.delete(name);
  for (const element of walk(svg)) {
    element.children = element.children.filter((child) => !isNoise(child));
    for (const name of [...element.attributes.keys()]) {
      if (NOISE_ATTRIBUTES.has(name) || /^(sodipodi|inkscape):/.test(name)) {
        element.attributes.delete(name);
      }
    }
  }
}

function isNoise(node: SvgNode): boolean {
  if (node.kind === "text") return node.text.trim() === "";
  return NOISE_ELEMENTS.has(node.name) || /^(sodipodi|inkscape):/.test(node.name);
}

function repairViewBox(svg: SvgElement): void {
  if (svg.attributes.has("viewBox")) return;
  const typo = svg.attributes.get("xviewBox");
  const width = Number.parseFloat(svg.attributes.get("width") ?? "");
  const height = Number.parseFloat(svg.attributes.get("height") ?? "");
  const viewBox =
    typo ?? (Number.isFinite(width) && Number.isFinite(height) ? `0 0 ${width} ${height}` : null);
  if (viewBox === null)
    throw new Error("SVG has no viewBox and no width and height to derive one.");
  svg.attributes.set("viewBox", viewBox);
}

/**
 * CSS properties that SVG also accepts as presentation attributes. Styles are rewritten as
 * attributes because the app's Content Security Policy blocks inline `style` when an icon is
 * inlined into the page, while attributes always apply.
 */
const PRESENTATION_PROPERTIES = new Set([
  "baseline-shift",
  "clip-path",
  "clip-rule",
  "color",
  "direction",
  "display",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "font-family",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "mask",
  "opacity",
  "overflow",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "text-decoration",
  "visibility",
  "word-spacing",
  "writing-mode",
]);

/**
 * Properties that change nothing in these icons, dropped rather than kept as styles the CSP
 * would block anyway. `isolation` only matters with a blend mode, which no icon uses;
 * `enable-background` is an obsolete Illustrator hint; the text layout properties are Inkscape's
 * flowed-text settings, which SVG text ignores (`text-decoration` itself is kept).
 */
const IGNORED_PROPERTIES = new Set([
  "isolation",
  "enable-background",
  "line-height",
  "text-align",
  "text-indent",
  "text-transform",
  "text-decoration-line",
]);

type Declarations = readonly (readonly [property: string, value: string])[];

/**
 * Replaces `<style>` class rules and `style` attributes with presentation attributes, keeping
 * the CSS cascade: inline style beats class rules, which beat existing attributes. Class names
 * like `cls-1` would otherwise collide between icons inlined in one document.
 */
export function inlineStyles(svg: SvgElement): void {
  const rules = new Map<string, Declarations>();
  for (const element of walk(svg)) {
    element.children = element.children.filter((child) => {
      if (child.kind !== "element" || child.name !== "style") return true;
      readClassRules(textOf(child), rules);
      return false;
    });
  }
  for (const element of walk(svg)) {
    const classes = (element.attributes.get("class") ?? "").split(/\s+/).filter(Boolean);
    const fromClasses = classes.flatMap((name) => rules.get(name) ?? []);
    const fromStyle = readDeclarations(element.attributes.get("style") ?? "");
    for (const [property, value] of [...fromClasses, ...fromStyle]) {
      if (IGNORED_PROPERTIES.has(property) || property.startsWith("-inkscape-")) continue;
      // The `marker` shorthand has no attribute form; `none` is the only value that can be dropped.
      if (property === "marker" && value === "none") continue;
      if (!PRESENTATION_PROPERTIES.has(property)) {
        throw new Error(`Style property "${property}" has no presentation attribute.`);
      }
      element.attributes.set(property, value);
    }
    element.attributes.delete("class");
    element.attributes.delete("style");
  }
}

function textOf(element: SvgElement): string {
  return element.children.map((child) => (child.kind === "text" ? child.text : "")).join("");
}

function readClassRules(css: string, rules: Map<string, Declarations>): void {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let matched = "";
  for (const [whole, selectorList = "", body = ""] of withoutComments.matchAll(rule)) {
    matched += whole;
    for (const selector of selectorList.split(",").map((part) => part.trim())) {
      if (!/^\.[\w-]+$/.test(selector)) throw new Error(`Unsupported CSS selector "${selector}".`);
      const name = selector.slice(1);
      rules.set(name, [...(rules.get(name) ?? []), ...readDeclarations(body)]);
    }
  }
  if (withoutComments.replace(/\s/g, "") !== matched.replace(/\s/g, "")) {
    throw new Error("Stylesheet contains something other than class rules.");
  }
}

function readDeclarations(text: string): Declarations {
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":");
      if (colon < 1) throw new Error(`Cannot read CSS declaration "${part}".`);
      return [part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim()] as const;
    });
}

/**
 * Lifts the children of `<a>` elements that link nowhere (Inkscape leaves them behind when a
 * shape was once a link). A real link fails the build: icons are images and never navigate.
 */
export function unwrapLinks(element: SvgElement): void {
  element.children = element.children.flatMap((child) => {
    if (child.kind !== "element") return [child];
    unwrapLinks(child);
    if (child.name !== "a") return [child];
    if (HREF_ATTRIBUTES.some((name) => child.attributes.has(name))) {
      throw new Error("Icon contains a link.");
    }
    return child.children;
  });
}

/**
 * Lifts the children of `<g>` wrappers that carry no attributes (usually because their editor
 * ids were just dropped) and removes empty `<g>` and `<defs>`. Neither draws anything of its
 * own, so removing them changes nothing.
 */
export function unwrapBareGroups(element: SvgElement): void {
  element.children = element.children.flatMap((child) => {
    if (child.kind !== "element") return [child];
    unwrapBareGroups(child);
    const empty = child.children.length === 0 && (child.name === "g" || child.name === "defs");
    if (empty) return [];
    return child.name === "g" && child.attributes.size === 0 ? child.children : [child];
  });
}

const URL_REFERENCE = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;
const HREF_ATTRIBUTES = ["href", "xlink:href"];

/**
 * Renames every referenced id to `<prefix>-a`, `<prefix>-b`, … and drops ids nothing points at.
 * Many icons are inlined into one document, where two gradients with the same id would make
 * one icon paint with another's colours.
 */
export function scopeIds(svg: SvgElement, prefix: string): void {
  const referenced = new Set<string>();
  for (const element of walk(svg)) {
    for (const [name, value] of element.attributes) {
      for (const match of value.matchAll(URL_REFERENCE)) referenced.add(match[2] ?? "");
      if (HREF_ATTRIBUTES.includes(name) && value.startsWith("#")) referenced.add(value.slice(1));
    }
  }
  const renamed = new Map<string, string>();
  for (const element of walk(svg)) {
    const id = element.attributes.get("id");
    if (id === undefined) continue;
    if (referenced.has(id) && !renamed.has(id)) {
      renamed.set(id, `${prefix}-${letters(renamed.size)}`);
    }
  }
  // A reference to an id the file never defines is still scoped, so it cannot latch on to
  // another icon's gradient once both are inlined.
  for (const id of referenced) {
    if (!renamed.has(id)) renamed.set(id, `${prefix}-${letters(renamed.size)}`);
  }
  for (const element of walk(svg)) {
    rewriteIds(element, renamed);
  }
}

function rewriteIds(element: SvgElement, renamed: ReadonlyMap<string, string>): void {
  for (const [name, value] of [...element.attributes]) {
    if (name === "id") {
      const next = renamed.get(value);
      if (next === undefined) element.attributes.delete(name);
      else element.attributes.set(name, next);
      continue;
    }
    if (HREF_ATTRIBUTES.includes(name) && value.startsWith("#")) {
      element.attributes.set(name, `#${renamed.get(value.slice(1)) ?? value.slice(1)}`);
      continue;
    }
    element.attributes.set(
      name,
      value.replace(
        URL_REFERENCE,
        (_whole, _quote, id: string) => `url(#${renamed.get(id) ?? id})`,
      ),
    );
  }
}

/** 0 → a, 25 → z, 26 → aa: short suffixes keep the scoped ids readable. */
function letters(index: number): string {
  let value = index;
  let result = "";
  do {
    result = String.fromCharCode(97 + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return result;
}

const FORBIDDEN_ELEMENTS = new Set([
  "a",
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "image",
  "audio",
  "video",
]);

/**
 * Fails the build if an icon could run code or load anything from outside the file. The
 * sources are trusted, so a hit means upstream changed and someone should look.
 */
export function assertSafe(svg: SvgElement): void {
  for (const element of walk(svg)) {
    if (FORBIDDEN_ELEMENTS.has(element.name.toLowerCase())) {
      throw new Error(`Unsafe element <${element.name}>.`);
    }
    for (const [name, value] of element.attributes) {
      if (/^on/i.test(name)) throw new Error(`Event handler attribute "${name}".`);
      if (/javascript:/i.test(value)) throw new Error(`Script URL in "${name}".`);
      if (HREF_ATTRIBUTES.includes(name) && !value.startsWith("#")) {
        throw new Error(`External reference "${value}".`);
      }
      if (/url\(\s*(?!['"]?#)/.test(value)) throw new Error(`External url() in "${name}".`);
    }
  }
}

/**
 * Puts `xmlns` and `viewBox` first on the root and keeps `xmlns:xlink` only while something
 * still uses an `xlink:` attribute. Editor namespaces (`xmlns:inkscape`, `xmlns:dc`, …) go, since
 * their elements and attributes were removed with the rest of the noise.
 */
export function tidyRoot(svg: SvgElement): void {
  const usesXlink = [...walk(svg)].some((element) =>
    [...element.attributes.keys()].some((name) => name.startsWith("xlink:")),
  );
  const viewBox = svg.attributes.get("viewBox");
  if (viewBox === undefined) throw new Error("SVG has no viewBox.");
  const rest = [...svg.attributes].filter(
    ([name]) => name !== "xmlns" && name !== "viewBox" && !name.startsWith("xmlns:"),
  );
  svg.attributes = new Map([
    ["xmlns", "http://www.w3.org/2000/svg"],
    ...(usesXlink ? [["xmlns:xlink", "http://www.w3.org/1999/xlink"] as const] : []),
    ["viewBox", viewBox],
    ...rest,
  ]);
}

/**
 * The full clean-up for vendor artwork: noise out, styles to attributes, ids scoped to the icon's
 * slug, links and bare groups unwrapped, root tidied, then checked. Used for every official
 * cloud icon set, whose files come from design tools rather than being hand-written.
 */
export function cleanArtwork(source: string, slug: string): SvgElement {
  const svg = parseSvg(source);
  removeNoise(svg);
  inlineStyles(svg);
  scopeIds(svg, slug);
  unwrapLinks(svg);
  unwrapBareGroups(svg);
  tidyRoot(svg);
  assertSafe(svg);
  return svg;
}

/**
 * Turns single-colour artwork into a glyph that takes the theme colour: every fill and stroke in
 * `colours` becomes `currentColor`. Any other colour fails the build, since it would no longer
 * match once the glyph is recoloured.
 */
export function toGlyph(svg: SvgElement, colours: ReadonlySet<string>): void {
  for (const element of walk(svg)) {
    for (const name of ["fill", "stroke", "color", "stop-color"]) {
      const value = element.attributes.get(name);
      if (value === undefined || value === "none" || value === "currentColor") continue;
      if (!colours.has(value.toLowerCase())) {
        throw new Error(`Glyph uses ${name}="${value}", which is not one of its own colours.`);
      }
      element.attributes.set(name, "currentColor");
    }
  }
}

/**
 * Turns two-colour artwork (a dark square with a white mark) into a glyph whose square takes the
 * theme colour and whose mark is cut out of it, so it shows whatever the icon sits on. On a light
 * canvas that is the vendor's light-background version and on a dark one its dark-background
 * version, from one file. Shapes in `cutout` move into a mask; shapes in `fill` become
 * `currentColor`. Anything else, or a transform above a cut-out shape, fails the build.
 */
export function toCutoutGlyph(
  svg: SvgElement,
  id: string,
  colours: { readonly fill: ReadonlySet<string>; readonly cutout: ReadonlySet<string> },
): void {
  const cut: SvgElement[] = [];
  const lift = (parent: SvgElement, inherited: Map<string, string>): void => {
    parent.children = parent.children.filter((child) => {
      if (child.kind !== "element") return true;
      const fill = child.attributes.get("fill")?.toLowerCase();
      if (fill !== undefined && colours.cutout.has(fill)) {
        const copy = { ...child, attributes: new Map([...inherited, ...child.attributes]) };
        copy.attributes.set("fill", "#000");
        cut.push(copy);
        return false;
      }
      if (child.attributes.has("transform")) {
        if ([...walk(child)].some((e) => colours.cutout.has(e.attributes.get("fill") ?? ""))) {
          throw new Error("A cut-out shape sits under a transform.");
        }
      }
      const rule = child.attributes.get("fill-rule");
      lift(child, rule === undefined ? inherited : new Map([...inherited, ["fill-rule", rule]]));
      return true;
    });
  };
  lift(svg, new Map());
  if (cut.length === 0) throw new Error("Nothing to cut out.");
  toGlyph(svg, colours.fill);
  const [, , width = "0", height = "0"] = (svg.attributes.get("viewBox") ?? "").split(/[\s,]+/);
  const mask: SvgElement = {
    kind: "element",
    name: "mask",
    attributes: new Map([["id", id]]),
    children: [
      {
        kind: "element",
        name: "rect",
        attributes: new Map([
          ["width", width],
          ["height", height],
          ["fill", "#fff"],
        ]),
        children: [],
      },
      ...cut,
    ],
  };
  const drawing: SvgElement = {
    kind: "element",
    name: "g",
    attributes: new Map([["mask", `url(#${id})`]]),
    children: svg.children,
  };
  svg.children = [
    { kind: "element", name: "defs", attributes: new Map(), children: [mask] },
    drawing,
  ];
}
