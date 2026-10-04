/**
 * A deliberately small SVG reader and writer for the catalog build.
 *
 * The inputs are machine-written icon files from Microsoft, Lucide and Simple Icons, so a tiny
 * tokenizer is enough and keeps the build free of a full XML stack. Anything it does not
 * understand (CDATA, DOCTYPE internals, unbalanced tags) fails the build instead of guessing.
 */

export interface SvgElement {
  readonly kind: "element";
  name: string;
  attributes: Map<string, string>;
  children: SvgNode[];
}

export interface SvgText {
  readonly kind: "text";
  text: string;
}

export type SvgNode = SvgElement | SvgText;

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/?[^>]+>|[^<]+/giy;
const ATTRIBUTE = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/** Parses an SVG document and returns its root `<svg>` element. */
export function parseSvg(source: string): SvgElement {
  const root: SvgElement = {
    kind: "element",
    name: "#document",
    attributes: new Map(),
    children: [],
  };
  const stack: SvgElement[] = [root];
  let consumed = 0;
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(source); match !== null; match = TOKEN.exec(source)) {
    const token = match[0];
    consumed = match.index + token.length;
    const parent = stack[stack.length - 1];
    if (parent === undefined) throw new Error("SVG has more closing tags than opening tags.");
    if (token.startsWith("<!--") || token.startsWith("<?") || /^<!DOCTYPE/i.test(token)) continue;
    if (token.startsWith("<![CDATA[")) throw new Error("CDATA sections are not supported.");
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      if (parent.name !== name) throw new Error(`Expected </${parent.name}> but found ${token}.`);
      stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      const element = readTag(token);
      parent.children.push(element);
      if (!token.endsWith("/>")) stack.push(element);
      continue;
    }
    parent.children.push({ kind: "text", text: decodeEntities(token) });
  }
  // The sticky tokenizer stops at the first character it cannot read, so check it reached the end.
  if (consumed !== source.length) throw new Error(`Cannot read SVG after offset ${consumed}.`);
  if (stack.length !== 1) throw new Error("SVG has unclosed elements.");
  const svg = root.children.find((node): node is SvgElement => node.kind === "element");
  if (svg?.name !== "svg") throw new Error("Document does not start with an <svg> element.");
  return svg;
}

function readTag(token: string): SvgElement {
  const body = token.slice(1, token.endsWith("/>") ? -2 : -1);
  const nameMatch = /^[^\s/>]+/.exec(body);
  if (nameMatch === null) throw new Error(`Cannot read tag ${token}.`);
  const attributes = new Map<string, string>();
  for (const attribute of body.slice(nameMatch[0].length).matchAll(ATTRIBUTE)) {
    const [, name, , doubleQuoted, singleQuoted] = attribute;
    if (name === undefined) continue;
    attributes.set(name, decodeEntities(doubleQuoted ?? singleQuoted ?? ""));
  }
  return { kind: "element", name: nameMatch[0], attributes, children: [] };
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Writes an element back out on one line, with empty elements self-closed. */
export function serializeSvg(element: SvgElement): string {
  const attributes = [...element.attributes]
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
  if (element.children.length === 0) return `<${element.name}${attributes}/>`;
  const children = element.children
    .map((child) => (child.kind === "text" ? escapeText(child.text) : serializeSvg(child)))
    .join("");
  return `<${element.name}${attributes}>${children}</${element.name}>`;
}

/** Visits every element below and including `element`, parents before children. */
export function* walk(element: SvgElement): Generator<SvgElement> {
  yield element;
  for (const child of element.children) {
    if (child.kind === "element") yield* walk(child);
  }
}

/** Builds a fresh element; used when an icon is redrawn rather than cleaned. */
export function createElement(
  name: string,
  attributes: Readonly<Record<string, string>>,
  children: SvgNode[] = [],
): SvgElement {
  return { kind: "element", name, attributes: new Map(Object.entries(attributes)), children };
}
