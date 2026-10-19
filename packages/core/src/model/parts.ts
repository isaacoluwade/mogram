import type { Component, Part } from "./types";

/** `a.b` where `a` has parts: its element and the part. Null for anything else. */
export function partOf(
  components: ReadonlyMap<string, Component>,
  target: string,
): { readonly component: Component; readonly part: Part } | null {
  const dot = target.indexOf(".");
  if (dot === -1) return null;
  const component = components.get(target.slice(0, dot));
  const part = component?.parts.get(target.slice(dot + 1));
  return component === undefined || part === undefined ? null : { component, part };
}
