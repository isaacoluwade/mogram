import type { Diagram } from "@mogram/core/model";
import type { SelectionInfo } from "../commands/selection";

/** The inspector's tabs (04-format-panel §16.2): by concern, always in the same order. */
export type InspectorTab = "element" | "style" | "arrange";
export type DiagramTab = "diagram" | "canvas";

/**
 * Which kind of element the inspector's open sections belong to (each kind remembers its own):
 * the selection's kind, a decoration's variant, "multi" or "diagram".
 */
export function scopeOf(diagram: Diagram, sel: SelectionInfo): string {
  if (sel.kind === "none") return "diagram";
  if (sel.single === null) return "multi";
  const decoration = diagram.decorations.get(sel.single);
  return decoration === undefined ? sel.kind : `decoration-${decoration.variant}`;
}
