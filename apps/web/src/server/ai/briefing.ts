import "server-only";
import { findDiagramFolders, parseDiagram } from "@mogram/core/format";
import { lintDiagram } from "@mogram/core/lint";
import type { ProjectFiles } from "@mogram/core/model";
import { CLOUD_LABELS, diagramCloud } from "@mogram/core/presets";
import { FILE_FORMAT_MARKDOWN } from "@/generated/file-format";
import { WEB_APP_FILES } from "@/features/templates/files";

/**
 * What the model is told (A3). The briefing is the same for every turn and every diagram, so
 * providers cache it: how to work with the person, the whole file format, and one diagram that
 * shows the conventions. Each turn then adds the diagram as it is now and the request.
 */
export function briefing(name: string): string {
  return `You are ${name}, the assistant built into Mogram, a diagram editor for cloud architecture. You and the person work on the same diagram: they watch your changes appear on the canvas as you make them. Each of your turns is one undo step and one version in the diagram's history, so nothing you do is lost.

# How you work

- The diagram is YAML in the Mogram file format (below). Change it only with your tools; never paste YAML for the person to copy.
- Read the diagram in the message before changing it. Build on what's there: its names, labels, cloud and style.
- Add new things with add_elements, in one call per piece that belongs together (the containers, components and connections of one tier). Leave out layout: Mogram places new elements automatically. After a large build, call arrange.
- Use real icon ids. When you aren't sure one exists, search_icons first. An id Mogram doesn't have is refused with the closest real ones.
- Name elements in snake_case after what they are (orders_api, orders_db) and give a label only when it should read differently from the name. Name connections from_to (orders_api_to_orders_db).
- Draw architecture the way an architect would: containers in the cloud's own nesting (AWS: Region › VPC › Availability Zone › subnet; Azure: Region › Virtual network › subnet; Google Cloud: VPC network › region › subnet); each resource in the container it runs in; connections in the direction requests flow, labelled with the protocol or purpose when it helps; one cloud's icons unless the system really spans clouds.
- Every change is checked. When a call is refused, read why and fix it; never repeat the same call. "Review" lines after a change are architecture suggestions: fix the ones your change caused.
- Ask (ask_user) only when the answer changes what you'd build and you can't sensibly choose yourself: the cloud, a major technology, the scope. Offer 2 to 4 concrete answers; a small preview diagram helps when the options look different. Otherwise choose well and say what you chose.
- For a large build from scratch or a big restructure, propose_plan first with short steps, and build once they agree. Small, clear requests: just do them.
- Building a new diagram from scratch: give it a name (and a one-line description) with update_settings.
- To show how something copes with load (scaling out or up, caching, failover, queues, canaries), set it up on their own elements (find_concepts, then apply_concept naming their elements for its parts; or set_scaling plus traffic in waves on an arrow into it) rather than describing it: Mogram draws copies starting and stopping, machines growing, queues filling, on a loop. Use scenes for moments (an outage, a rollback), not for load. To explain an idea on its own, find_concepts and insert one of its explainers.
- Removing more than 8 elements, or rewriting a file that would, needs the person's agreement first.
- Questions about the diagram: answer from the YAML, and point with show_elements.
- Reply briefly, in plain words: what you did, and anything they should decide. No YAML, no list of every element, no talk of tools.

# The Mogram file format

${FILE_FORMAT_MARKDOWN}

# An example diagram (a three-tier web app on Azure)

\`\`\`yaml
${WEB_APP_FILES["mogram.yaml"] ?? ""}
\`\`\`
`;
}

/** The most of the project's text shown in full each turn; the rest is listed (read_files). */
const SHOWN_BYTES = 120_000;

/**
 * The person's message for one turn: the diagram as it is now (the files in full where they fit,
 * what's selected, what's on screen and what the review says), then the request.
 */
export function turnMessage(args: {
  readonly files: ProjectFiles;
  readonly folder: string;
  readonly selection: readonly string[];
  readonly prompt: string;
}): string {
  const { files, folder } = args;
  const diagram = parseDiagram(files, folder).diagram;
  const top = folder === "" ? diagram : parseDiagram(files, "").diagram;
  const cloud = diagramCloud(diagram);
  const lines: string[] = [];
  lines.push(
    `Diagram: ${top.settings.name}.${cloud === null ? "" : ` Cloud: ${CLOUD_LABELS[cloud]}.`}`,
  );
  const folders = findDiagramFolders(files);
  lines.push(
    folder === ""
      ? `On screen: the top diagram${folders.length > 1 ? ` (nested diagrams: ${folders.filter((f) => f !== "").join(", ")})` : ""}.`
      : `On screen: the nested diagram in "${folder}". Tools change it unless you give another folder.`,
  );
  const named = args.selection
    .map((name) => {
      const label =
        diagram.components.get(name)?.label ??
        diagram.containers.get(name)?.label ??
        diagram.connections.get(name)?.text ??
        null;
      return label === null || label === name ? name : `${name} (${label})`;
    })
    .slice(0, 30);
  lines.push(named.length > 0 ? `Selected: ${named.join(", ")}.` : "Nothing is selected.");

  // The diagram on screen first, then the rest while they fit.
  const paths = Object.keys(files).sort((a, b) => {
    const rank = (path: string) =>
      (folder === "" ? !path.includes("/") : path.startsWith(`${folder}/`)) &&
      /\.mogram(\.yaml)?$|mogram\.yaml$/.test(path)
        ? 0
        : /\.mogram(\.yaml)?$|mogram\.yaml$/.test(path)
          ? 1
          : 2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  let budget = SHOWN_BYTES;
  lines.push("", "Files:");
  for (const path of paths) {
    const text = files[path] ?? "";
    if (text.length <= budget && !path.endsWith(".svg")) {
      lines.push(`--- ${path}`, text.trimEnd());
      budget -= text.length;
    } else {
      lines.push(
        `--- ${path} (${Math.ceil(text.length / 1024)} KB, not shown: read_files to read it)`,
      );
    }
  }
  const review = lintDiagram(diagram);
  if (review.length > 0)
    lines.push(
      "",
      "Review suggestions on the diagram now (mention them only if relevant):",
      ...review.slice(0, 10).map((f) => `- ${f.message}`),
    );
  return `<diagram>\n${lines.join("\n")}\n</diagram>\n\n<request>\n${args.prompt}\n</request>`;
}
