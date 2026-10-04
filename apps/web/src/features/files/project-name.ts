import { setSetting } from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import type { ProjectFiles } from "@mogram/core/model";
import { LIMITS } from "@/lib/api/contracts";

/** The diagram's name lives in its YAML (`name:`); renames write it there so every view agrees. */
export function withName(files: ProjectFiles, name: string): ProjectFiles {
  const { diagram } = parseDiagram(files, "");
  if (diagram.files.length === 0) return files;
  return setSetting(files, diagram, { key: "name", value: name }).files;
}

/** The name as stored alongside the diagram (trimmed to the API's limit). */
export function nameOf(files: ProjectFiles): string {
  const name = parseDiagram(files, "").diagram.settings.name.trim().slice(0, LIMITS.nameLength);
  return name.length > 0 ? name : "Untitled diagram";
}
