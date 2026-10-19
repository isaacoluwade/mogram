import { conceptKind } from "@mogram/core/concepts";
import { parseDiagram } from "@mogram/core/format";
import type { Diagram } from "@mogram/core/model";
import { beatsOf, cursorAtStep, pictureAt, sceneMoment, type Moment } from "@mogram/core/picture";
import { CONCEPT_TOPICS } from "@mogram/core/presets";
import type { ConceptCard } from "../src/types";

/**
 * From the concept files to the catalog and the generated modules (D-85). Pure, so the build
 * writes what it returns and a test checks the committed files are what it would write.
 *
 * Every concept must read without a single problem, say what it explains, be filed under its own
 * topic, and tell its story: a story, scenes, or traffic that changes.
 */
export interface ConceptSource {
  /** `<topic>/<id>.mogram.yaml`, relative to `content/`. */
  readonly path: string;
  readonly text: string;
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEADER =
  "// Generated from content/ by scripts/build-catalog.ts. Do not edit: run `pnpm build:catalog`.\n";

/** The longest a caption can be and still be read in the time a beat takes. */
const CAPTION_LIMIT = 150;
/** The most beats a concept's story has: past this it's two ideas. */
const BEAT_LIMIT = 12;

/**
 * The story check (D-86, plan §8): what a concept's story must hold for it to be worth
 * watching. Short captions, not too many beats, and nothing written that never appears.
 */
export function storyProblems(diagram: Diagram): string[] {
  const problems: string[] = [];
  const main = diagram.stories[0];
  if (main === undefined) return problems;
  const beats = beatsOf(main);
  if (beats.length > BEAT_LIMIT)
    problems.push(
      `its story has ${beats.length} beats; ${BEAT_LIMIT} is the most one idea should need.`,
    );
  for (const story of diagram.stories)
    for (const step of story.steps)
      if (step.say !== null && step.say.length > CAPTION_LIMIT)
        problems.push(
          `a caption is ${step.say.length} characters ("${step.say.slice(0, 40)}…"); keep it under ${CAPTION_LIMIT}.`,
        );
  // Everything written is there at some moment: the opening, a step, or a scene.
  const seen = new Set<string>();
  const look = (moment: Moment | null): void => {
    const picture = pictureAt(diagram, moment);
    for (const name of [
      ...picture.diagram.components.keys(),
      ...picture.diagram.containers.keys(),
      ...picture.diagram.connections.keys(),
      ...picture.diagram.decorations.keys(),
    ])
      seen.add(name);
  };
  look(null);
  for (const scene of diagram.scenes) look(sceneMoment(scene.name));
  for (const story of diagram.stories)
    story.steps.forEach((_, index) => {
      look({ scene: null, story: cursorAtStep(diagram, { story: story.name, index }) });
    });
  for (const name of [
    ...diagram.components.keys(),
    ...diagram.containers.keys(),
    ...diagram.connections.keys(),
    ...diagram.decorations.keys(),
  ])
    if (!seen.has(name)) problems.push(`"${name}" is hidden and no step or scene ever shows it.`);
  return problems;
}

export function buildCatalog(sources: readonly ConceptSource[]): {
  readonly cards: readonly ConceptCard[];
  readonly files: Readonly<Record<string, string>>;
} {
  const problems: string[] = [];
  const cards: ConceptCard[] = [];
  const bodies = new Map<string, Map<string, string>>();
  for (const source of [...sources].sort((a, b) => a.path.localeCompare(b.path))) {
    const match = /^([a-z]+)\/([^/]+)\.mogram\.yaml$/.exec(source.path);
    if (match === null) {
      problems.push(`${source.path}: concepts live at content/<topic>/<id>.mogram.yaml.`);
      continue;
    }
    const folder = match[1] ?? "";
    const id = match[2] ?? "";
    if (!ID.test(id))
      problems.push(`${source.path}: "${id}" should be lowercase words joined by -.`);
    if (cards.some((card) => card.id === id)) problems.push(`${source.path}: "${id}" is taken.`);
    const { diagram, diagnostics } = parseDiagram({ "mogram.yaml": source.text });
    for (const d of diagnostics) problems.push(`${source.path}:${d.line} ${d.message}`);
    const concept = diagram.settings.concept;
    if (concept === null) {
      problems.push(`${source.path}: it has no concept: section.`);
      continue;
    }
    if (concept.summary === null) problems.push(`${source.path}: say what it explains (summary).`);
    if (concept.topic === null) problems.push(`${source.path}: give it a topic.`);
    else if (concept.topic !== folder)
      problems.push(
        `${source.path}: its topic is ${concept.topic}, so it belongs in content/${concept.topic}/.`,
      );
    const patterned = [...diagram.connections.values()].some((c) => c.pattern !== null);
    if (
      !patterned &&
      diagram.scenes.length === 0 &&
      diagram.tours.length === 0 &&
      diagram.stories.length === 0
    )
      problems.push(
        `${source.path}: it tells no story (a story, scenes, a tour or traffic that changes).`,
      );
    problems.push(...storyProblems(diagram).map((problem) => `${source.path}: ${problem}`));
    if (concept.topic === null || concept.summary === null) continue;
    cards.push({
      id,
      title: diagram.settings.name,
      summary: concept.summary,
      topic: concept.topic,
      platform: concept.platform,
      tags: concept.tags,
      kind: conceptKind(concept),
      parts: concept.roles.map((r) => ({
        element: r.element,
        label: r.label,
        optional: r.optional,
      })),
    });
    const topicBodies = bodies.get(concept.topic) ?? new Map<string, string>();
    topicBodies.set(id, source.text);
    bodies.set(concept.topic, topicBodies);
  }
  if (problems.length > 0) throw new Error(`The concepts have problems:\n${problems.join("\n")}`);

  const topics = CONCEPT_TOPICS.map((t) => t.id).filter((t) => bodies.has(t));
  const files: Record<string, string> = {
    "catalog.generated.ts": `${HEADER}import type { ConceptCard } from "./types";\n\nexport const CONCEPT_CATALOG: readonly ConceptCard[] = ${JSON.stringify(cards, null, 2)};\n`,
    "loaders.generated.ts": `${HEADER}/** Each topic's concept files, loaded the first time one of them is opened. */\nexport const TOPIC_LOADERS: Readonly<Record<string, () => Promise<{ readonly BODIES: Readonly<Record<string, string>> }>>> = {\n${topics.map((t) => `  ${JSON.stringify(t)}: () => import("./bodies/${t}.generated"),`).join("\n")}\n};\n`,
    "all.generated.ts": `${HEADER}${topics.map((t, i) => `import { BODIES as T${i} } from "./bodies/${t}.generated";`).join("\n")}\n\n/** Every concept's file, by id: for the server and tests (the editor loads them a topic at a time). */\nexport const ALL_CONCEPTS: Readonly<Record<string, string>> = { ${topics.map((_, i) => `...T${i}`).join(", ")} };\n`,
  };
  for (const topic of topics) {
    const entries = [...(bodies.get(topic) ?? new Map<string, string>())];
    files[`bodies/${topic}.generated.ts`] =
      `${HEADER}export const BODIES: Readonly<Record<string, string>> = {\n${entries.map(([id, text]) => `  ${JSON.stringify(id)}: ${JSON.stringify(text)},`).join("\n")}\n};\n`;
  }
  return { cards, files };
}
