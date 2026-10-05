import { z } from "zod";
import { diffProjects, diffStats, summarizeDiff } from "@mogram/core/diff";
import {
  EditError,
  deleteElements,
  insertYaml,
  nestElements,
  renameElement,
  setScale,
  setSceneEntry,
  setSetting,
  tidyUp,
  updateElement,
  writeProjectFile,
  type EditResult,
  type SceneValue,
  type SettingKey,
} from "@mogram/core/edit";
import { findDiagramFolders, parseDiagram } from "@mogram/core/format";
import { lintDiagram, type LintFinding } from "@mogram/core/lint";
import type { Diagnostic, Diagram, ProjectFiles, Scale, SceneCapacity } from "@mogram/core/model";
import {
  CONCEPT_TOPICS,
  FLOW_PRESETS,
  type ConceptTopic,
  type FlowPreset,
  type MotionPreset,
  type StatePreset,
} from "@mogram/core/presets";
import { suggestedSizes } from "@mogram/core/capacity";
import { applyConcept, insertConcept } from "@mogram/core/concepts";
import type { ConceptCard, ConceptQuery } from "@mogram/concepts";
import { GRID, computeLayout } from "@mogram/core/layout";
import {
  MUTATING_TOOLS,
  type AssistantEvent,
  type AssistantOp,
  type ChangeSummary,
  type MutatingTool,
} from "./protocol";

/**
 * The assistant's tools (A2): what the model can do to a diagram, each mapped onto the same core
 * edits the canvas uses. `applyOp` is pure and deterministic, so the server (which runs the
 * model) and the browser (which replays each change as it streams in) end up with the same
 * files. `runTool` adds the checks the model gets answers from: inputs, icons that exist, files
 * that still parse, and the architecture review.
 */

const NAME = z.string().min(1).max(64);
const FOLDER = z
  .string()
  .max(512)
  .optional()
  .describe('A nested diagram\'s folder, like "aks". Leave it out for the diagram on screen.');
const VALUE = z.union([
  z.string().max(4_000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(200)).max(50),
  z.record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean()])),
]);
const MULTIPLE = z.union([z.number().min(0).max(100), z.string().max(16)]);
const PERCENT = z.union([z.number().min(0).max(1), z.string().max(16)]);
const SCENE_VALUE = z.union([
  z.string().max(32),
  z.strictObject({
    state: z.string().max(32).optional(),
    flow: z.string().max(32).optional(),
    motion: z.string().max(32).optional(),
    traffic: MULTIPLE.optional().describe("Connections: times what it usually carries, like 5."),
    share: PERCENT.optional().describe("Connections out of a load balancer: its share, 0–1."),
    hit: PERCENT.optional().describe("Caches: the share answered without going further, 0–1."),
    copies: z.number().int().min(1).max(24).optional().describe("Hold a scale set at this many."),
    size: z.string().max(80).optional().describe("Hold something that scales up at this size."),
  }),
  z.null(),
]);

const CONCEPT_TOPIC_IDS = CONCEPT_TOPICS.map((t) => t.id) as [ConceptTopic, ...ConceptTopic[]];

export const TOOL_INPUTS = {
  search_icons: z.strictObject({
    query: z.string().min(1).max(80).describe("What to look for: a service or product name."),
    library: z.enum(["azure", "aws", "gcp", "k8s", "generic", "tool"]).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  read_files: z.strictObject({
    paths: z.array(z.string().max(512)).min(1).max(10),
  }),
  add_elements: z.strictObject({
    yaml: z.string().min(1).max(60_000),
    folder: FOLDER,
  }),
  update_elements: z.strictObject({
    updates: z
      .array(
        z.strictObject({
          name: NAME,
          set: z
            .record(z.string().max(64), VALUE)
            .describe("Keys to set; null removes a key. `in` moves it into a container."),
        }),
      )
      .min(1)
      .max(50),
    folder: FOLDER,
  }),
  remove_elements: z.strictObject({
    names: z.array(NAME).min(1).max(200),
    confirmed: z
      .boolean()
      .optional()
      .describe("Only after the person agreed to removing this many (more than 8)."),
    folder: FOLDER,
  }),
  rename_element: z.strictObject({ name: NAME, to: NAME, folder: FOLDER }),
  move_into: z.strictObject({
    names: z.array(NAME).min(1).max(100),
    container: NAME.nullable().describe("The container to put them in, or null for the canvas."),
    folder: FOLDER,
  }),
  arrange: z.strictObject({
    container: NAME.nullable().describe(
      "Arrange what this container holds, or null for the whole diagram.",
    ),
    folder: FOLDER,
  }),
  update_scene: z.strictObject({
    scene: NAME,
    entries: z
      .record(z.string().max(200), SCENE_VALUE)
      .describe(
        "Element → state (down, degraded…), connection → flow (blocked, traffic…), or null to clear.",
      ),
  }),
  update_settings: z.strictObject({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    theme: z.string().max(40).nullable().optional(),
    background: z.string().max(300).nullable().optional(),
    grid: z.string().max(40).nullable().optional(),
  }),
  write_file: z.strictObject({
    path: z.string().min(1).max(512),
    content: z.string().max(200_000).nullable().describe("The whole file, or null to delete it."),
    confirmed: z.boolean().optional(),
  }),
  show_elements: z.strictObject({ names: z.array(NAME).min(1).max(50), folder: FOLDER }),
  ask_user: z.strictObject({
    question: z.string().min(1).max(300),
    options: z
      .array(
        z.strictObject({
          label: z.string().min(1).max(80),
          description: z.string().max(200).optional(),
          preview: z
            .string()
            .max(6_000)
            .optional()
            .describe("A small Mogram YAML diagram picturing this option."),
        }),
      )
      .min(2)
      .max(4),
    multi_select: z.boolean().optional(),
  }),
  set_scaling: z.strictObject({
    name: NAME,
    kind: z
      .enum(["out", "up", "off"])
      .describe("out: more copies as traffic grows; up: a bigger size; off: doesn't scale."),
    min: z.number().int().min(1).max(24).optional().describe("Fewest copies (out). Default 2."),
    max: z.number().int().min(1).max(24).optional().describe("Most copies (out). Default 8."),
    target: z
      .number()
      .min(0.05)
      .max(1)
      .optional()
      .describe("The load each copy or size is kept near, 0–1. Default 0.7."),
    sizes: z
      .array(
        z.strictObject({
          name: z.string().min(1).max(80),
          cpu: z.number().positive().max(1024).optional(),
          memory: z.number().positive().max(65536).optional().describe("GB"),
          disks: z.number().int().positive().max(64).optional(),
        }),
      )
      .min(1)
      .max(8)
      .optional()
      .describe("Up: smallest first. Leave out for sizes that fit what it is (a database, a VM)."),
    folder: FOLDER,
  }),
  find_concepts: z.strictObject({
    query: z.string().max(120).optional().describe("Words to look for: scaling, failover, dns…"),
    topic: z.enum(CONCEPT_TOPIC_IDS).optional(),
    platform: z
      .enum(["azure", "aws", "gcp", "kubernetes"])
      .optional()
      .describe("A platform's own concepts, and the general ones."),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  apply_concept: z.strictObject({
    concept: z.string().min(1).max(80).describe("Its id, from find_concepts."),
    roles: z
      .record(z.string().max(64), NAME)
      .describe("The concept's part → the element in this diagram that plays it."),
    insert: z
      .boolean()
      .optional()
      .describe("Add the concept's own example beside the diagram instead (roles are ignored)."),
    folder: FOLDER,
  }),
  propose_plan: z.strictObject({
    summary: z.string().min(1).max(800),
    steps: z.array(z.string().min(1).max(240)).min(1).max(12),
  }),
} as const;

export type ToolName = keyof typeof TOOL_INPUTS;

const DESCRIPTIONS: Readonly<Record<ToolName, string>> = {
  search_icons:
    "Find icons by name across Azure, AWS, Google Cloud, Kubernetes, generic icons and tool logos. Use it before giving a component a type you aren't sure exists; only listed ids work.",
  read_files:
    "Read files of the project that aren't shown in full (card markdown, other diagrams).",
  add_elements:
    "Add to the diagram with a YAML snippet in the file format: containers, components, shapes, groups, connections, layout (positions and decorations), scenes, tours, styles. Names are kept as written and must be new. Connections may name existing elements. Leave out layout to have everything placed automatically.",
  update_elements:
    'Change existing elements: set keys such as label, type, state, motion, tone, style, card, data, link, from/to (connections), flow, line, arrows, and capacity: capacity ("2x"), routing (split or copy), hit ("80%"), queue (true) on components; on connections, share ("10%") and traffic: a steady level ("3x"), or traffic that rises and falls on its own: "waves", "bursts", or { pattern: "waves", high: "5x", low: "1x", every: "10s" }. null removes a key. Setting `in` moves an element into a container (null: onto the canvas). Scaling: set_scaling.',
  remove_elements:
    "Remove elements by name; their connections and anything inside a removed container go too. More than 8 at once needs the person's agreement first (ask_user), then confirmed: true.",
  rename_element:
    "Rename an element's YAML name; connections, groups, scenes, tours and links follow. To change what it shows, set its label instead.",
  move_into:
    "Put elements inside a container (or onto the canvas with null). They're placed automatically inside it.",
  arrange:
    "Lay out what a container holds, or the whole diagram, again with automatic placement (sources left, destinations right). Use after big changes.",
  update_scene:
    "Set what a scene changes (scenes are moments like an outage or a traffic spike, and belong to the top diagram). Creates the scene if it's new. An entry names an element (or a connection, or a nested path like aks.ingress) and its state or flow in that scene, or capacity in it: a connection's traffic (\"5x\" is five times as much) or share, a cache's hit rate, copies or a size to hold at.",
  set_scaling:
    "Make a component scale: out (copies are added as traffic grows and removed as it falls, between min and max) or up (it grows smoothly into a bigger size, and back), or stop it scaling. Drawn live: a scale set grows and shrinks, a machine gains cores, memory and disks. To show it happening, give an arrow into it traffic in waves (update_elements, traffic: waves).",
  find_concepts:
    "Search Mogram's concepts (ready-made diagrams that explain an idea: scaling, failover, caching, networking, Git…) by words, topic or platform. Each comes back with its id, what it explains, and either the parts to pick (a pattern, applied to the person's own elements) or that it's an explainer (inserted as it is).",
  apply_concept:
    "Apply a concept (its id from find_concepts) to the person's own elements, naming the element that plays each part: it sets up what the concept needs on them (scaling, a cache's hit rate, a standby connection…), brings its traffic (waves on the arrows into them) and its scenes, so the idea plays out on their diagram. insert: true adds the concept's own example beside the diagram instead (the way to use an explainer).",
  update_settings:
    "Change the diagram's settings: name, description, theme (midnight, paper, blueprint…), background, grid colour.",
  write_file:
    "Write a whole file (a card's markdown under docs/, or a Mogram YAML file when a change is easier as a rewrite). Rewriting a file that removes more than 8 elements needs the person's agreement first.",
  show_elements:
    "Point the person at elements on the canvas (select them), without changing anything. Use when they ask where something is.",
  ask_user:
    "Ask the person one question with 2 to 4 answers (they can also write their own). Ends your turn: their answer comes in their next message. Ask only when the choice changes what you'd build.",
  propose_plan:
    "Before a large build or rebuild, set out what you'll do as short steps and stop for the person to agree. Ends your turn.",
};

/** A tool as providers describe it to the model. */
export interface ToolSpec {
  readonly name: ToolName;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export const TOOL_SPECS: readonly ToolSpec[] = (Object.keys(TOOL_INPUTS) as ToolName[]).map(
  (name) => {
    // Providers want the schema itself, without the dialect marker.
    const schema = { ...(z.toJSONSchema(TOOL_INPUTS[name]) as Record<string, unknown>) };
    delete schema.$schema;
    return { name, description: DESCRIPTIONS[name], inputSchema: schema };
  },
);

export const isMutating = (name: string): name is MutatingTool =>
  (MUTATING_TOOLS as readonly string[]).includes(name);

const diagramOf = (files: ProjectFiles, folder: string): Diagram =>
  parseDiagram(files, folder).diagram;

/** Paths the assistant may write: Mogram files and card markdown, inside the project. */
function checkPath(path: string): void {
  if (path.startsWith("/") || path.split("/").some((part) => part === ".." || part === ""))
    throw new EditError(`"${path}" isn't a path inside the project.`);
  if (!/\.(mogram\.yaml|mogram|md)$/.test(path) && !/(^|\/)mogram\.yaml$/.test(path))
    throw new EditError("Only Mogram YAML files and markdown cards can be written.");
}

/**
 * Applies one change to the files (the browser replays the same ops). Throws `EditError` for a
 * change that can't be made, with a message the model can act on.
 */
export function applyOp(files: ProjectFiles, op: AssistantOp): EditResult {
  const folder = op.folder;
  switch (op.tool) {
    case "add_elements": {
      const input = TOOL_INPUTS.add_elements.parse(op.input);
      return insertYaml(files, diagramOf(files, folder), { text: input.yaml });
    }
    case "update_elements": {
      const input = TOOL_INPUTS.update_elements.parse(op.input);
      let current: Record<string, string> = { ...files };
      for (const update of input.updates) {
        const { in: parent, name: newName, ...set } = update.set;
        if (newName !== undefined)
          throw new EditError("Rename elements with rename_element, not update_elements.");
        if (Object.keys(set).length > 0)
          current = updateElement(current, diagramOf(current, folder), {
            name: update.name,
            set,
          }).files;
        if (parent !== undefined) {
          if (parent !== null && typeof parent !== "string")
            throw new EditError("`in` takes a container's name, or null.");
          current = nestElements(current, diagramOf(current, folder), {
            names: [update.name],
            parent,
          }).files;
        }
      }
      return { files: current, select: input.updates.map((u) => u.name) };
    }
    case "remove_elements": {
      const input = TOOL_INPUTS.remove_elements.parse(op.input);
      const diagram = diagramOf(files, folder);
      const missing = input.names.filter((name) => !exists(diagram, name));
      if (missing.length > 0)
        throw new EditError(`${missing.map((n) => `"${n}"`).join(", ")} isn't in the diagram.`);
      return { files: deleteElements(files, diagram, input.names).files, select: [] };
    }
    case "rename_element": {
      const input = TOOL_INPUTS.rename_element.parse(op.input);
      return renameElement(files, diagramOf(files, folder), { from: input.name, to: input.to });
    }
    case "move_into": {
      const input = TOOL_INPUTS.move_into.parse(op.input);
      return nestElements(files, diagramOf(files, folder), {
        names: input.names,
        parent: input.container,
      });
    }
    case "arrange": {
      const input = TOOL_INPUTS.arrange.parse(op.input);
      const diagram = diagramOf(files, folder);
      if (input.container !== null && !diagram.containers.has(input.container))
        throw new EditError(`"${input.container}" isn't a container.`);
      return tidyUp(files, diagram, { parent: input.container, folder });
    }
    case "update_scene": {
      const input = TOOL_INPUTS.update_scene.parse(op.input);
      // Scenes belong to the top diagram.
      let current: Record<string, string> = { ...files };
      if (!diagramOf(current, "").scenes.some((s) => s.name === input.scene))
        current = insertYaml(current, diagramOf(current, ""), {
          text: `scenes:\n  ${input.scene}: {}\n`,
        }).files;
      for (const [target, raw] of Object.entries(input.entries)) {
        const value = raw === null ? null : sceneValueOf(raw);
        current = setSceneEntry(current, diagramOf(current, ""), {
          scene: input.scene,
          target,
          // Unknown words are caught when the result is parsed, with the valid ones listed.
          value: value as Parameters<typeof setSceneEntry>[2]["value"],
        }).files;
      }
      return { files: current };
    }
    case "update_settings": {
      const input = TOOL_INPUTS.update_settings.parse(op.input);
      let current: Record<string, string> = { ...files };
      for (const [key, value] of Object.entries(input) as [SettingKey, string | null][]) {
        if (value === undefined) continue;
        current = setSetting(current, diagramOf(current, folder), { key, value }).files;
      }
      return { files: current };
    }
    case "set_scaling": {
      const input = TOOL_INPUTS.set_scaling.parse(op.input);
      const diagram = diagramOf(files, folder);
      const component = diagram.components.get(input.name);
      if (component === undefined) throw new EditError(`"${input.name}" isn't a component.`);
      const target = input.target ?? component.scale?.target ?? 0.7;
      let scale: Scale | null = null;
      if (input.kind === "out") {
        const min = input.min ?? Math.min(2, input.max ?? 2);
        scale = { kind: "out", min, max: Math.max(min, input.max ?? 8), target };
      } else if (input.kind === "up") {
        const sizes =
          input.sizes?.map((size, index) => ({
            name: size.name,
            cpu: size.cpu ?? null,
            memory: size.memory ?? null,
            disks: size.disks ?? null,
            capacity: 2 ** index,
          })) ?? suggestedSizes(component).sizes;
        scale = { kind: "up", sizes, target };
      }
      return setScale(files, diagram, { name: input.name, scale });
    }
    case "apply_concept": {
      const input = TOOL_INPUTS.apply_concept.parse(op.input);
      // The server looks the concept up and sends its file with the change, so the browser
      // replays it without having the whole library.
      if (op.attachment === undefined)
        throw new EditError(`There's no concept "${input.concept}". Use find_concepts.`);
      const concept = parseDiagram({ "mogram.yaml": op.attachment }).diagram;
      const diagram = diagramOf(files, folder);
      if (input.insert === true) {
        const bounds = computeLayout(diagram).bounds;
        const at = {
          x: Math.ceil((bounds.x + bounds.w) / GRID) + 4,
          y: Math.floor(bounds.y / GRID),
        };
        return insertConcept(files, diagram, { concept, at });
      }
      return applyConcept(files, diagram, { concept, bindings: input.roles });
    }
    case "write_file": {
      const input = TOOL_INPUTS.write_file.parse(op.input);
      checkPath(input.path);
      return writeProjectFile(files, diagramOf(files, folder), {
        path: input.path,
        content: input.content,
      });
    }
  }
}

/** A scene entry as the model writes it: a preset, `5x`, or the fields of a scene line. */
function sceneValueOf(raw: Exclude<z.infer<typeof SCENE_VALUE>, null>): SceneValue {
  if (typeof raw === "string") {
    if (/^\d+(\.\d+)?\s*[x×]$/i.test(raw.trim())) return { capacity: { traffic: multiple(raw) } };
    return (FLOW_PRESETS as readonly string[]).includes(raw)
      ? { flow: raw as FlowPreset }
      : { state: raw as StatePreset };
  }
  const { state, flow, motion, traffic, share, hit, copies, size } = raw;
  const capacity: { -readonly [K in keyof SceneCapacity]: SceneCapacity[K] } = {};
  if (traffic !== undefined) capacity.traffic = multiple(traffic);
  if (share !== undefined) capacity.share = fraction(share);
  if (hit !== undefined) capacity.hit = fraction(hit);
  if (copies !== undefined) capacity.copies = copies;
  if (size !== undefined) capacity.size = size;
  // Unknown words are caught when the result is parsed, with the valid ones listed.
  return {
    ...(state === undefined ? {} : { state: state as StatePreset }),
    ...(flow === undefined ? {} : { flow: flow as FlowPreset }),
    ...(motion === undefined ? {} : { motion: motion as MotionPreset }),
    ...(Object.keys(capacity).length === 0 ? {} : { capacity }),
  };
}

/** 5, "5", "5x" → 5. */
function multiple(value: number | string): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value.replace(/[x×]\s*$/i, ""));
  if (!Number.isFinite(n) || n < 0)
    throw new EditError(`"${value}" isn't a traffic level like 5x.`);
  return n;
}

/** 0.2, "20%" → 0.2. */
function fraction(value: number | string): number {
  const n =
    typeof value === "number"
      ? value
      : value.trim().endsWith("%")
        ? Number.parseFloat(value) / 100
        : Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0 || n > 1)
    throw new EditError(`"${value}" isn't a share like 20%.`);
  return n;
}

const exists = (diagram: Diagram, name: string): boolean =>
  diagram.components.has(name) ||
  diagram.containers.has(name) ||
  diagram.groups.has(name) ||
  diagram.connections.has(name) ||
  diagram.decorations.has(name);

/** What the server needs beyond the files: the icon catalogue and the concept library. */
export interface ToolEnv {
  /** Icons whose name matches, best first. */
  searchIcons(
    query: string,
    options: { readonly library?: string; readonly limit: number },
  ): readonly { readonly id: string; readonly name: string }[];
  isIcon(id: string): boolean;
  /** Concepts that match, best first. */
  findConcepts(query: ConceptQuery, limit: number): readonly ConceptCard[];
  /** A concept's file by its id, or null when there's no such concept. */
  conceptFile(id: string): string | null;
}

export interface ToolCall {
  readonly name: string;
  readonly input: unknown;
}

export interface ToolResult {
  /** The files after the call (unchanged when it failed or changed nothing). */
  readonly files: ProjectFiles;
  /** What the model reads back. */
  readonly content: string;
  readonly isError: boolean;
  /** What the browser is told (the change to replay, a question, a plan). */
  readonly events: readonly AssistantEvent[];
  /** A question or plan: the turn ends here. */
  readonly ends: "question" | "plan" | null;
}

const failure = (files: ProjectFiles, content: string): ToolResult => ({
  files,
  content,
  isError: true,
  events: [],
  ends: null,
});

/** Errors in every diagram of the project, by file and message (lines move, so they're left out). */
function errorsOf(files: ProjectFiles): Map<string, Diagnostic> {
  const out = new Map<string, Diagnostic>();
  for (const folder of findDiagramFolders(files)) {
    for (const d of parseDiagram(files, folder).diagnostics) {
      if (d.severity === "error") out.set(`${d.file}|${d.message}`, d);
    }
  }
  return out;
}

const findingKey = (f: LintFinding) => `${f.rule}|${f.elements.join(",")}`;

/** How many elements a project has across its diagrams (for "this removes a lot"). */
function elementCount(files: ProjectFiles): number {
  let count = 0;
  for (const folder of findDiagramFolders(files)) {
    const d = diagramOf(files, folder);
    count += d.components.size + d.containers.size + d.connections.size;
  }
  return count;
}

/** Icons the change introduced that the catalogue doesn't have. */
function unknownIcons(env: ToolEnv, before: ProjectFiles, after: ProjectFiles): string[] {
  const out = new Set<string>();
  for (const folder of findDiagramFolders(after)) {
    const now = diagramOf(after, folder);
    const was = diagramOf(before, folder);
    for (const component of now.components.values()) {
      if (component.shape !== null) continue;
      if (was.components.get(component.name)?.type === component.type) continue;
      if (component.type.startsWith("icons/")) continue;
      if (!env.isIcon(component.type)) out.add(component.type);
    }
    for (const container of now.containers.values()) {
      const icon = container.icon;
      if (icon === null || was.containers.get(container.name)?.icon === icon) continue;
      if (!icon.startsWith("icons/") && !env.isIcon(icon)) out.add(icon);
    }
  }
  return [...out];
}

const LIMIT_WITHOUT_ASKING = 8;

/** A concept as the model reads it: id, what it explains, and the parts to pick (if any). */
function conceptLine(card: ConceptCard): string {
  const where = card.platform === "any" ? card.topic : `${card.topic}, ${card.platform}`;
  const use =
    card.kind === "explainer"
      ? "Explainer: insert it."
      : `Parts: ${card.parts.map((p) => `${p.element} = ${p.label}${p.optional ? " (optional)" : ""}`).join("; ")}.`;
  return `${card.id} — ${card.title} (${where}): ${card.summary} ${use}`;
}

/** Runs one tool call for the model (server side): checks, applies, reviews, explains. */
export function runTool(
  env: ToolEnv,
  state: { readonly files: ProjectFiles; readonly folder: string },
  call: ToolCall,
): ToolResult {
  const { files } = state;
  if (!(call.name in TOOL_INPUTS)) return failure(files, `There's no tool called "${call.name}".`);
  const name = call.name as ToolName;
  const parsed = TOOL_INPUTS[name].safeParse(call.input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(
      files,
      `The input isn't right: ${issue === undefined ? "invalid" : `${issue.path.join(".") || "input"}: ${issue.message}`}.`,
    );
  }
  const input = parsed.data as Record<string, unknown>;
  const folder =
    typeof input.folder === "string" && findDiagramFolders(files).includes(input.folder)
      ? input.folder
      : typeof input.folder === "string"
        ? null
        : state.folder;
  if (folder === null)
    return failure(files, `There's no diagram in the folder "${String(input.folder)}".`);

  switch (name) {
    case "search_icons": {
      const query = TOOL_INPUTS.search_icons.parse(input);
      const found = env.searchIcons(query.query, {
        ...(query.library !== undefined ? { library: query.library } : {}),
        limit: query.limit ?? 8,
      });
      return {
        files,
        content:
          found.length === 0
            ? `No icons match "${query.query}". Try a shorter or more general word ("database", "queue", "gateway"), or a generic/ icon.`
            : found.map((icon) => `${icon.id} — ${icon.name}`).join("\n"),
        isError: false,
        events: [],
        ends: null,
      };
    }
    case "find_concepts": {
      const query = TOOL_INPUTS.find_concepts.parse(input);
      const found = env.findConcepts(
        {
          ...(query.query !== undefined ? { text: query.query } : {}),
          ...(query.topic !== undefined ? { topic: query.topic } : {}),
          ...(query.platform !== undefined ? { platform: query.platform } : {}),
        },
        query.limit ?? 8,
      );
      return {
        files,
        content:
          found.length === 0
            ? "No concepts match. Try fewer or broader words, or another topic."
            : found.map(conceptLine).join("\n"),
        isError: false,
        events: [],
        ends: null,
      };
    }
    case "read_files": {
      const { paths } = TOOL_INPUTS.read_files.parse(input);
      const content = paths
        .map((path) =>
          files[path] === undefined
            ? `${path}: not found. The files are: ${Object.keys(files).join(", ")}`
            : `--- ${path}\n${(files[path] ?? "").slice(0, 60_000)}`,
        )
        .join("\n\n");
      return { files, content, isError: false, events: [], ends: null };
    }
    case "show_elements": {
      const { names } = TOOL_INPUTS.show_elements.parse(input);
      const diagram = diagramOf(files, folder);
      const missing = names.filter((n) => !exists(diagram, n));
      if (missing.length > 0)
        return failure(files, `${missing.map((n) => `"${n}"`).join(", ")} isn't in the diagram.`);
      return {
        files,
        content: "Shown on the canvas.",
        isError: false,
        events: [{ type: "focus", folder, names }],
        ends: null,
      };
    }
    case "ask_user": {
      const ask = TOOL_INPUTS.ask_user.parse(input);
      return {
        files,
        content: "Asked. Their answer comes in their next message.",
        isError: false,
        events: [
          {
            type: "question",
            question: ask.question,
            options: ask.options.map((option) => ({
              label: option.label,
              ...(option.description !== undefined ? { description: option.description } : {}),
              ...(option.preview !== undefined ? { preview: option.preview } : {}),
            })),
            multiSelect: ask.multi_select ?? false,
          },
        ],
        ends: "question",
      };
    }
    case "propose_plan": {
      const plan = TOOL_INPUTS.propose_plan.parse(input);
      return {
        files,
        content: "Proposed. Their answer comes in their next message.",
        isError: false,
        events: [{ type: "plan", summary: plan.summary, steps: plan.steps }],
        ends: "plan",
      };
    }
    case "apply_concept": {
      const id = TOOL_INPUTS.apply_concept.parse(input).concept;
      const file = env.conceptFile(id);
      if (file === null)
        return failure(files, `There's no concept "${id}". Use find_concepts to find one.`);
      return runChange(env, files, { tool: name, folder, input, attachment: file });
    }
    default:
      return runChange(env, files, { tool: name, folder, input });
  }
}

function runChange(env: ToolEnv, files: ProjectFiles, op: AssistantOp): ToolResult {
  if (
    op.tool === "remove_elements" &&
    Array.isArray(op.input.names) &&
    op.input.names.length > LIMIT_WITHOUT_ASKING &&
    op.input.confirmed !== true
  )
    return failure(
      files,
      `That removes ${op.input.names.length} elements. Ask the person first (ask_user); if they agree, call again with confirmed: true.`,
    );

  let result: EditResult;
  try {
    result = applyOp(files, op);
  } catch (error) {
    if (error instanceof EditError || error instanceof z.ZodError)
      return failure(files, error instanceof EditError ? error.message : "The input isn't right.");
    throw error;
  }
  const after = result.files;
  if (
    op.tool === "write_file" &&
    op.input.confirmed !== true &&
    elementCount(files) - elementCount(after) > LIMIT_WITHOUT_ASKING
  )
    return failure(
      files,
      `That rewrite removes ${elementCount(files) - elementCount(after)} elements. Ask the person first (ask_user); if they agree, call again with confirmed: true.`,
    );

  // Nothing that didn't parse before may fail now.
  const before = errorsOf(files);
  const added = [...errorsOf(after).entries()].filter(([key]) => !before.has(key));
  if (added.length > 0) {
    return failure(
      files,
      `Not applied: it would break the diagram.\n${added
        .slice(0, 8)
        .map(([, d]) => `- ${d.file}:${d.line} ${d.message}`)
        .join("\n")}`,
    );
  }
  const icons = unknownIcons(env, files, after);
  if (icons.length > 0) {
    const hints = icons
      .slice(0, 5)
      .map((id) => {
        const words = (id.split("/").pop() ?? id).replace(/[-_]/g, " ");
        const library = id.includes("/") ? id.split("/")[0] : undefined;
        const near = env
          .searchIcons(words, { ...(library !== undefined ? { library } : {}), limit: 4 })
          .map((icon) => icon.id);
        return `- "${id}" isn't an icon Mogram has.${near.length > 0 ? ` Closest: ${near.join(", ")}.` : " Use search_icons."}`;
      })
      .join("\n");
    return failure(files, `Not applied: unknown icons.\n${hints}`);
  }

  const diff = diffProjects(files, after);
  if (diff.changes.length === 0)
    return {
      files,
      content: "Nothing changed: it was already like that.",
      isError: false,
      events: [],
      ends: null,
    };
  const summary = summarizeDiff(diff);

  // What the architecture review says now that it didn't before.
  const seen = new Set(lintDiagram(diagramOf(files, op.folder)).map(findingKey));
  const review = lintDiagram(diagramOf(after, op.folder)).filter((f) => !seen.has(findingKey(f)));
  const warnings = parseDiagram(after, op.folder).diagnostics.filter(
    (d) => d.severity === "warning",
  );
  const lines = [`Done: ${summary}.`];
  if (warnings.length > 0)
    lines.push(
      `Warnings:\n${warnings
        .slice(0, 6)
        .map((d) => `- ${d.file}:${d.line} ${d.message}`)
        .join("\n")}`,
    );
  if (review.length > 0)
    lines.push(
      `Review (fix what's yours to fix):\n${review
        .slice(0, 6)
        .map((f) => `- ${f.message} ${f.fix}`)
        .join("\n")}`,
    );

  return {
    files: after,
    content: lines.join("\n"),
    isError: false,
    events: [{ type: "op", op, summary, select: result.select ?? [] }],
    ends: null,
  };
}

/** What a whole turn changed, for its card. */
export function changeSummary(before: ProjectFiles, after: ProjectFiles): ChangeSummary | null {
  const diff = diffProjects(before, after);
  if (diff.changes.length === 0) return null;
  return { line: summarizeDiff(diff), ...diffStats(diff) };
}
