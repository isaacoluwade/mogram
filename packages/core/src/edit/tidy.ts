import { parseDiagram } from "../format/parse";
import { computeLayout } from "../layout/compute";
import type { Diagram, ProjectFiles } from "../model/types";
import { edit, type EditResult } from "./context";

/**
 * Tidy up (07-document-workflow §18 P1-8): lays out what a container holds — or the whole
 * diagram — again with Mogram's automatic placement (sources left, destinations right, by the
 * traffic between them), and pins the result. Bends between the tidied elements are cleared so
 * the router draws fresh lines. Text, notes and zones keep their places. One undo step.
 */
export function tidyUp(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly parent: string | null; readonly folder?: string },
): EditResult {
  const names = [...diagram.components.values(), ...diagram.containers.values()]
    .filter((element) => element.parent === args.parent)
    .map((element) => element.name);
  if (names.length === 0) return { files };
  const tidy = new Set(names);

  // First forget where they were (and the bends between them)…
  const cleared = edit(files, diagram, (ctx) => {
    for (const name of names) ctx.setLayoutField(name, "at", undefined);
    for (const connection of diagram.connections.values()) {
      if (tidy.has(connection.from.element) && tidy.has(connection.to.element))
        ctx.setVia(connection.name, null);
    }
  });
  // …then let automatic placement put them somewhere, and pin that.
  const unpinned = parseDiagram(cleared.files, args.folder ?? diagram.folder).diagram;
  const layout = computeLayout(unpinned);
  const pinned = edit(cleared.files, unpinned, (ctx) => {
    for (const name of names) {
      const placed = layout.elements.get(name);
      if (placed !== undefined) ctx.setAt(name, placed.rel);
    }
  });
  return { files: pinned.files, select: names };
}
