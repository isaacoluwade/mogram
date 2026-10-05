import type { DataValue, Diagram } from "./types";

/**
 * Placeholders (07-document-workflow §6.2): `%key%` in a label, note or connection text shows a
 * value when drawn. The key is looked up in the element's own `data:`, then in each container
 * around it, then in the diagram's `data:`, then among the built-ins: `name` (the YAML name),
 * `type`, `diagram` (the diagram's name) and `date` (today, as 2026-10-04). A token that finds
 * nothing stays as written, so a stray `%` never loses text; `%%` writes one `%`.
 */
const TOKEN = /%%|%([A-Za-z_][\w.-]*)%/g;

/** `text` with its placeholders filled by `lookup` (null: leave that token as written). */
export function fillPlaceholders(text: string, lookup: (key: string) => string | null): string {
  if (!text.includes("%")) return text;
  return text.replace(TOKEN, (token, key: string | undefined) =>
    key === undefined ? "%" : (lookup(key) ?? token),
  );
}

export interface PlaceholderContext {
  /** What `%date%` reads; today by default. */
  readonly date?: Date;
}

const show = (value: DataValue): string => String(value);

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Looks keys up for the element `name`: its data, its containers', the diagram's, built-ins. */
export function placeholderLookup(
  diagram: Diagram,
  name: string,
  context: PlaceholderContext = {},
): (key: string) => string | null {
  const elementOf = (at: string) =>
    diagram.components.get(at) ??
    diagram.containers.get(at) ??
    diagram.decorations.get(at) ??
    diagram.groups.get(at) ??
    diagram.connections.get(at);
  return (key) => {
    const seen = new Set<string>();
    for (let at: string | null = name; at !== null && !seen.has(at);) {
      seen.add(at);
      const element = elementOf(at);
      const value = element?.data.get(key);
      if (value !== undefined) return show(value);
      at = element !== undefined && "parent" in element ? element.parent : null;
    }
    const global = diagram.settings.data.get(key);
    if (global !== undefined) return show(global);
    switch (key) {
      case "name":
        return name;
      case "type": {
        const component = diagram.components.get(name);
        return component?.shape ?? component?.type ?? diagram.containers.get(name)?.type ?? null;
      }
      case "diagram":
        return diagram.settings.name;
      case "date":
        return isoDate(context.date ?? new Date());
      default:
        return null;
    }
  };
}

/** `text` as drawn for the element `name`. */
export function withPlaceholders(
  diagram: Diagram,
  name: string,
  text: string,
  context?: PlaceholderContext,
): string {
  return text.includes("%")
    ? fillPlaceholders(text, placeholderLookup(diagram, name, context))
    : text;
}
