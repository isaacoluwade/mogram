import { Scalar, YAMLMap } from "yaml";
import type { Concept, Diagram, ProjectFiles } from "../model/types";
import { edit, type EditResult } from "./context";
import { EditError, flowMap, flowSeq, insertSetting } from "./session";

/**
 * Makes the diagram a concept (D-83), or stops it being one (`null`): a summary, and the roles
 * its elements play, written in the settings file beside its name.
 */
export function setConcept(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly concept: Concept | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const root = ctx.session.root(diagram.settingsFile);
    const concept = args.concept;
    if (concept === null) {
      root.delete("concept");
      return;
    }
    const map = new YAMLMap();
    const summary = concept.summary?.trim() ?? "";
    if (summary !== "") map.set("summary", summary);
    if (concept.topic !== null) map.set("topic", concept.topic);
    if (concept.platform !== "any") map.set("platform", concept.platform);
    const tags = [...new Set(concept.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (tags.length > 0) map.set("tags", flowSeq(tags));
    const roles = new YAMLMap();
    for (const role of concept.roles) {
      if (!diagram.components.has(role.element) && !diagram.containers.has(role.element))
        throw new EditError(
          `A concept's roles are played by its components and containers, and "${role.element}" isn't one.`,
        );
      const label = role.label.trim();
      roles.set(
        role.element,
        role.optional
          ? flowMap([
              ["label", label],
              ["optional", new Scalar(true)],
            ])
          : new Scalar(label),
      );
    }
    if (roles.items.length > 0) map.set("roles", roles);
    if (root.has("concept")) root.set("concept", map);
    else insertSetting(root, "concept", map);
  });
}
