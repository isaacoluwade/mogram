import { describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import { lintDiagram } from "@mogram/core/lint";
import { CONTAINER_STYLE_INFO } from "@mogram/core/presets";
import { isCatalogIcon } from "@mogram/icons";
import { TEMPLATES } from "./index";

/** Every folder in a template that holds a diagram (the top level and nested ones). */
function folders(files: Record<string, string>): string[] {
  const found = new Set<string>([""]);
  for (const path of Object.keys(files)) {
    const match = /^(.*)\/mogram\.yaml$/.exec(path);
    if (match?.[1] !== undefined) found.add(match[1]);
  }
  return [...found];
}

describe("templates", () => {
  for (const template of TEMPLATES) {
    it(`${template.id}: parses cleanly, passes architecture review, and only uses icons that exist`, () => {
      for (const folder of folders(template.files)) {
        const { diagram, diagnostics } = parseDiagram(template.files, folder);
        expect(diagnostics).toEqual([]);
        // Templates are what good looks like (the assistant learns from them too).
        expect(lintDiagram(diagram).map((f) => f.message)).toEqual([]);
        for (const component of diagram.components.values())
          expect(isCatalogIcon(component.type), `${folder}:${component.name}`).toBe(true);
        for (const container of diagram.containers.values()) {
          const icon = container.icon ?? CONTAINER_STYLE_INFO[container.type].icon;
          expect(isCatalogIcon(icon), `${folder}:${container.name}`).toBe(true);
        }
      }
    });
  }
});
