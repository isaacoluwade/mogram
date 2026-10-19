import type { Node } from "yaml";
import type {
  Place,
  SceneCapacity,
  SceneEntry,
  StoryChoice,
  StoryStep,
  Tone,
  TourChoice,
  TourStep,
} from "../model/types";
import { humanize, isValidName } from "../model/names";
import {
  FLOW_PRESETS,
  MOTION_PRESETS,
  STATE_PRESETS,
  isFlowPreset,
  isMotionPreset,
  isStatePreset,
} from "../presets/names";
import { MARKS, PRESENCES, isMark, isPresence } from "../presets/marks";
import { TONE_NAMES } from "../presets/tones";
import type { Position } from "./diagnostics";
import { didYouMean, listOptions } from "./suggest";
import { asString, isMap, isNullish, isSeq, nodeOf, scalarValue, type MapEntry } from "./yaml-read";
import type { RawControl, RawScene, RawStep, RawStory, RawTour, StepPositions } from "./raw";
import { FormulaError, isFormula, parseFormula } from "../values/formula";
import { SectionReader } from "./read-base";

/** What a line of a `set` can change, written as keys (D-86). */
export const SET_KEYS = [
  "state",
  "flow",
  "motion",
  "traffic",
  "share",
  "hit",
  "copies",
  "size",
  "show",
  "label",
  "tone",
  "mark",
  "in",
  "on",
  "cell",
  "along",
] as const;

export const STEP_KEYS = [
  "say",
  "set",
  "focus",
  "zoom",
  "hold",
  "pace",
  "name",
  "rewind",
  "choices",
  "when",
  "script",
] as const;

/** The longest a beat's script can be. */
export const MAX_SCRIPT = 4000;

/** The longest a step can stay, in seconds. */
export const MAX_HOLD = 60;

/** Scenes, stories and tours (SC-1 … SC-5, D-86, TO-1 … TO-6). */
export class StoryReader extends SectionReader {
  // ---------------------------------------------------------------------------------------------
  // Scenes

  readScenes(section: MapEntry, out: RawScene[]): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(
        this.pos(section.keyNode),
        `"scenes" should list scenes by name, like "region_outage:".`,
      );
      return;
    }
    for (const sceneEntry of this.entries(section.value)) {
      const at = this.pos(sceneEntry.keyNode);
      if (!isValidName(sceneEntry.key)) {
        this.sink.error(
          at,
          `"${sceneEntry.key}" isn't a valid scene name. Use letters, numbers, "_" or "-".`,
        );
        continue;
      }
      const entries: SceneEntry[] = [];
      const entryPositions: Position[] = [];
      if (!isNullish(sceneEntry.value)) {
        if (!isMap(sceneEntry.value)) {
          this.sink.error(
            at,
            `Scene "${sceneEntry.key}" should list elements and their state, like "db_primary: down".`,
          );
        } else {
          for (const line of this.entries(sceneEntry.value)) {
            const entry = this.readSceneEntry(`scene "${sceneEntry.key}"`, line);
            if (entry !== null) {
              entries.push(entry);
              entryPositions.push(this.pos(line.keyNode));
            }
          }
        }
      }
      out.push({
        model: {
          name: sceneEntry.key,
          label: humanize(sceneEntry.key),
          entries,
          source: { file: at.file, line: at.line },
        },
        at,
        entryPositions,
      });
    }
  }

  /**
   * One line of a `set`: a word (`db: down`, `a_to_b: blocked`, `banner: shown`, `users: 5x`) or
   * keys (`{ state: down, label: "Primary (down)" }`). `where` says where it is, for messages:
   * `scene "outage"` or `story "main"`.
   */
  private readSceneEntry(where: string, line: MapEntry): SceneEntry | null {
    const at = this.pos(line.keyNode);
    const source = { file: at.file, line: at.line };
    const blank = { target: line.key, state: null, flow: null, motion: null, source };
    // A value (a key of the diagram's `data:`), not an element: a number, a run from one
    // number to another across the step, or a formula.
    const raw = scalarValue(line.value);
    if (typeof raw === "number" || typeof raw === "boolean")
      return { ...blank, value: { to: raw } };
    if (isSeq(line.value)) {
      const [from, to] = line.value.items.map((item) => scalarValue(nodeOf(item)));
      if (line.value.items.length === 2 && typeof from === "number" && typeof to === "number")
        return { ...blank, value: { from, to } };
      this.sink.error(
        this.pos(line.value),
        `In ${where}, "${line.key}" runs from one number to another, like [30, 0].`,
      );
      return null;
    }
    if (isFormula(raw)) {
      try {
        parseFormula(raw);
        return { ...blank, value: { to: raw.trim() } };
      } catch (error) {
        this.sink.error(
          this.pos(line.value),
          `In ${where}, the formula for "${line.key}" can't be read. ${error instanceof FormulaError ? error.message : ""}`.trim(),
        );
        return null;
      }
    }
    const single = asString(line.value);
    if (single !== null) {
      if (isStatePreset(single)) return { ...blank, state: single };
      if (isFlowPreset(single)) return { ...blank, flow: single };
      if (isPresence(single)) return { ...blank, show: single };
      // `users_to_web: 5x` is short for `{ traffic: 5x }`.
      if (/^\d+(\.\d+)?\s*[x×]$/i.test(single.trim())) {
        const traffic = this.readMultiple(line.value, `The traffic on "${line.key}"`);
        return traffic === null ? null : { ...blank, capacity: { traffic } };
      }
      this.sink.error(
        this.pos(line.value),
        `In ${where}, "${single}" isn't something "${line.key}" can be set to.${didYouMean(single, [...STATE_PRESETS, ...FLOW_PRESETS, ...PRESENCES])} States: ${listOptions(STATE_PRESETS)}. Flows: ${listOptions(FLOW_PRESETS)}. Or ${listOptions(PRESENCES)}.`,
      );
      return null;
    }
    if (isMap(line.value)) {
      const fields = this.body(line.key, line.value, SET_KEYS, "set");
      const capacity = this.readSceneCapacity(fields, line.key);
      const show = this.optionalEnum(fields.get("show"), PRESENCES, isPresence, line.key, "show");
      const label = this.optionalString(fields.get("label"), `The label of "${line.key}"`);
      const tone = this.optionalLiteral<Tone>(fields.get("tone"), TONE_NAMES, line.key, "tone");
      const markEntry = fields.get("mark");
      const markWord = markEntry === undefined ? null : asString(markEntry.value);
      const mark =
        markWord === "none"
          ? "none"
          : this.optionalEnum(markEntry, MARKS, isMark, line.key, "mark");
      const place = this.readPlace(fields, line.key);
      return {
        ...(capacity === null ? {} : { capacity }),
        ...(show === null ? {} : { show }),
        ...(label === null ? {} : { label }),
        ...(tone === null ? {} : { tone }),
        ...(mark === null ? {} : { mark }),
        ...(place === null ? {} : { place }),
        target: line.key,
        state: this.optionalEnum(
          fields.get("state"),
          STATE_PRESETS,
          isStatePreset,
          line.key,
          "state",
        ),
        flow: this.optionalEnum(fields.get("flow"), FLOW_PRESETS, isFlowPreset, line.key, "flow"),
        motion: this.optionalEnum(
          fields.get("motion"),
          MOTION_PRESETS,
          isMotionPreset,
          line.key,
          "motion",
        ),
        source,
      };
    }
    this.sink.error(at, `In ${where}, give "${line.key}" a value, like "${line.key}: down".`);
    return null;
  }

  /** Where a set puts something: `in` a container, `on` an element, at a `cell`, `along` a line. */
  private readPlace(fields: ReadonlyMap<string, MapEntry>, target: string): Place | null {
    const out: { -readonly [K in keyof Place]: Place[K] } = {};
    const into = this.optionalString(fields.get("in"), `Where "${target}" goes`);
    if (into !== null) out.in = into;
    const on = this.optionalString(fields.get("on"), `What "${target}" rides on`);
    if (on !== null) out.on = on;
    const cellEntry = fields.get("cell");
    if (cellEntry !== undefined && !isNullish(cellEntry.value)) {
      const cell = this.readPair(cellEntry.value, target, "cell");
      if (cell !== null && cell[0] >= 0 && cell[1] >= 0) out.cell = { x: cell[0], y: cell[1] };
      else if (cell !== null)
        this.sink.error(
          this.pos(cellEntry.value),
          `The cell of "${target}" is [column, row], counted from 0.`,
        );
    }
    const along = this.optionalPercent(fields.get("along"), `How far along "${target}" sits`);
    if (along !== null) out.along = along;
    return Object.keys(out).length === 0 ? null : out;
  }

  /** Traffic, shares, hit rates, and copies or a size set by hand, for one scene line. */
  private readSceneCapacity(
    fields: ReadonlyMap<string, MapEntry>,
    target: string,
  ): SceneCapacity | null {
    const out: { -readonly [K in keyof SceneCapacity]: SceneCapacity[K] } = {};
    const traffic = this.optionalMultiple(fields.get("traffic"), `The traffic on "${target}"`);
    if (traffic !== null) out.traffic = traffic;
    const share = this.optionalPercent(fields.get("share"), `The share of "${target}"`);
    if (share !== null) out.share = share;
    const hit = this.optionalPercent(fields.get("hit"), `The hit rate of "${target}"`);
    if (hit !== null) out.hit = hit;
    const copiesEntry = fields.get("copies");
    if (copiesEntry !== undefined) {
      const copies = scalarValue(copiesEntry.value);
      if (typeof copies === "number" && Number.isInteger(copies) && copies >= 1 && copies <= 24)
        out.copies = copies;
      else
        this.sink.error(
          this.pos(copiesEntry.value),
          `The copies of "${target}" should be a whole number from 1 to 24.`,
        );
    }
    const size = this.optionalString(fields.get("size"), `The size of "${target}"`);
    if (size !== null) out.size = size;
    return Object.keys(out).length === 0 ? null : out;
  }

  // ---------------------------------------------------------------------------------------------
  // Stories (D-86)

  readStories(section: MapEntry, out: RawStory[]): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(
        this.pos(section.keyNode),
        `"stories" should list stories by name, like "main:", each a list of steps.`,
      );
      return;
    }
    for (const storyEntry of this.entries(section.value)) {
      const at = this.pos(storyEntry.keyNode);
      if (!isValidName(storyEntry.key)) {
        this.sink.error(
          at,
          `"${storyEntry.key}" isn't a valid story name. Use letters, numbers, "_" or "-".`,
        );
        continue;
      }
      const steps: StoryStep[] = [];
      const positions: RawStep[] = [];
      if (!isNullish(storyEntry.value)) {
        if (!isSeq(storyEntry.value)) {
          this.sink.error(
            this.pos(storyEntry.value),
            `Story "${storyEntry.key}" should be a list of steps, each starting with "- say:" or "- set:".`,
          );
        } else {
          for (const item of storyEntry.value.items) {
            const read = this.readStoryStep(storyEntry.key, nodeOf(item));
            if (read === null) continue;
            steps.push(read.step);
            positions.push(read.positions);
          }
        }
      }
      out.push({
        model: {
          name: storyEntry.key,
          label: humanize(storyEntry.key),
          steps,
          source: { file: at.file, line: at.line },
        },
        at,
        steps: positions,
      });
    }
  }

  private readStoryStep(
    story: string,
    node: Node | null,
  ): { step: StoryStep; positions: RawStep } | null {
    const where = `story "${story}"`;
    const at = this.pos(node);
    if (!isMap(node)) {
      // `- A caption on its own` is a step that only says something.
      const say = asString(node);
      if (say !== null && say.trim() !== "")
        return {
          step: { ...emptyStep({ file: at.file, line: at.line }), say: say.trim() },
          positions: { at, entries: [], focus: [], zoom: null, rewind: null, choices: [] },
        };
      this.sink.error(at, `A step of ${where} should have "say", "set" or both.`);
      return null;
    }
    const fields = this.body(`a step of ${where}`, node, STEP_KEYS, "step");
    const entries: SceneEntry[] = [];
    const entryPositions: Position[] = [];
    const setEntry = fields.get("set");
    if (setEntry !== undefined && !isNullish(setEntry.value)) {
      if (!isMap(setEntry.value)) {
        this.sink.error(
          this.pos(setEntry.value),
          `"set" in ${where} should list what changes, like "db_primary: down".`,
        );
      } else {
        for (const line of this.entries(setEntry.value)) {
          const entry = this.readSceneEntry(where, line);
          if (entry === null) continue;
          entries.push(entry);
          entryPositions.push(this.pos(line.keyNode));
        }
      }
    }
    const focus: string[] = [];
    const focusPositions: Position[] = [];
    const focusEntry = fields.get("focus");
    if (focusEntry !== undefined && !isNullish(focusEntry.value)) {
      const items = isSeq(focusEntry.value)
        ? focusEntry.value.items.map((item) => nodeOf(item))
        : [focusEntry.value];
      for (const item of items) {
        const name = asString(item);
        if (name === null)
          this.sink.error(this.pos(item), `"focus" in ${where} should name elements.`);
        else {
          focus.push(name);
          focusPositions.push(this.pos(item));
        }
      }
    }
    const holdEntry = fields.get("hold");
    let hold: number | null = null;
    if (holdEntry !== undefined && !isNullish(holdEntry.value)) {
      const value = scalarValue(holdEntry.value);
      const text =
        typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
      const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(text);
      const seconds = match === null ? Number.NaN : Number(match[1]);
      if (Number.isFinite(seconds) && seconds <= MAX_HOLD) hold = seconds;
      else
        this.sink.error(
          this.pos(holdEntry.value),
          `"hold" in ${where} should be seconds, up to ${MAX_HOLD}, like 3s.`,
        );
    }
    const choices: StoryChoice[] = [];
    const choicePositions: Position[] = [];
    const choicesEntry = fields.get("choices");
    if (choicesEntry !== undefined && !isNullish(choicesEntry.value)) {
      if (!isSeq(choicesEntry.value)) {
        this.sink.error(
          this.pos(choicesEntry.value),
          `"choices" in ${where} should be a list, like "- { label: Renew in time, play: renewed }".`,
        );
      } else {
        for (const item of choicesEntry.value.items) {
          const choice = nodeOf(item);
          const parts = this.body("a choice", choice, ["label", "play"], "choice");
          const label = this.optionalString(parts.get("label"), "A choice's label");
          const play = this.optionalString(parts.get("play"), "The story a choice plays");
          if (label === null || play === null) {
            this.sink.error(
              this.pos(choice),
              `A choice in ${where} needs a label and the story it plays, like { label: Renew in time, play: renewed }.`,
            );
            continue;
          }
          choices.push({ label, play });
          choicePositions.push(this.pos(parts.get("play")?.value));
        }
      }
    }
    const nameEntry = fields.get("name");
    let name = this.optionalString(nameEntry, `A step's name in ${where}`);
    if (name !== null && (!isValidName(name) || name === "start")) {
      this.sink.error(
        this.pos(nameEntry?.value),
        name === "start"
          ? `"start" already means the beginning of ${where}, so a step can't take it as a name.`
          : `"${name}" isn't a valid step name. Use letters, numbers, "_" or "-".`,
      );
      name = null;
    }
    const say = this.optionalString(fields.get("say"), `"say" in ${where}`)?.trim() ?? null;
    const scriptEntry = fields.get("script");
    let script = this.optionalString(scriptEntry, `"script" in ${where}`)?.trim() ?? null;
    if (script !== null && script.length > MAX_SCRIPT) {
      this.sink.error(
        this.pos(scriptEntry?.value),
        `"script" in ${where} is longer than ${MAX_SCRIPT.toLocaleString("en")} characters. Split it into beats.`,
      );
      script = script.slice(0, MAX_SCRIPT);
    }
    const zoomEntry = fields.get("zoom");
    const rewindEntry = fields.get("rewind");
    const step: StoryStep = {
      name,
      say: say === "" ? null : say,
      script: script === "" ? null : script,
      entries,
      focus,
      zoom: this.optionalString(zoomEntry, `"zoom" in ${where}`),
      hold,
      pace:
        this.optionalLiteral<"normal" | "slow">(
          fields.get("pace"),
          ["normal", "slow"],
          `a step of ${where}`,
          "pace",
        ) ?? "normal",
      rewind: this.optionalString(rewindEntry, `"rewind" in ${where}`),
      choices,
      when: this.readWhen(fields.get("when"), where),
      source: { file: at.file, line: at.line },
    };
    if (
      step.say === null &&
      step.script === null &&
      entries.length === 0 &&
      step.rewind === null &&
      focus.length === 0 &&
      step.zoom === null &&
      choices.length === 0
    ) {
      this.sink.warning(at, `This step of ${where} says and changes nothing, so it's left out.`);
      return null;
    }
    return {
      step,
      positions: {
        at,
        entries: entryPositions,
        focus: focusPositions,
        zoom: zoomEntry === undefined ? null : this.pos(zoomEntry.value),
        rewind: rewindEntry === undefined ? null : this.pos(rewindEntry.value),
        choices: choicePositions,
      },
    };
  }

  /** `when: "= work > lease"`: the step plays only while this holds. */
  private readWhen(entry: MapEntry | undefined, where: string): string | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const raw = scalarValue(entry.value);
    const text = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
    try {
      parseFormula(text);
      return text.trim().replace(/^=/, "").trim();
    } catch (error) {
      this.sink.error(
        this.pos(entry.value),
        `"when" in ${where} should be a test, like "= work > lease". ${error instanceof FormulaError ? error.message : ""}`.trim(),
      );
      return null;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Controls (D-88)

  readControls(section: MapEntry, out: RawControl[]): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(
        this.pos(section.keyNode),
        `"controls" should list what the viewer can set, like "rps: { dial: [1, 10] }".`,
      );
      return;
    }
    for (const entry of this.entries(section.value)) {
      const at = this.pos(entry.keyNode);
      const source = { file: at.file, line: at.line };
      if (!isValidName(entry.key)) {
        this.sink.error(
          at,
          `"${entry.key}" isn't a valid control name. Use letters, numbers, "_" or "-".`,
        );
        continue;
      }
      const fields = this.body(
        entry.key,
        entry.value,
        ["dial", "toggle", "pick", "start", "step", "unit", "label"],
        "control",
      );
      const label =
        this.optionalString(fields.get("label"), `The label of "${entry.key}"`) ??
        humanize(entry.key);
      const base = { name: entry.key, label, source };
      const start = fields.get("start");
      const dial = fields.get("dial");
      const toggle = fields.get("toggle");
      const pick = fields.get("pick");
      if (dial !== undefined) {
        const range = isSeq(dial.value)
          ? dial.value.items.map((item) => scalarValue(nodeOf(item)))
          : [];
        const [min, max] = range;
        if (
          range.length !== 2 ||
          typeof min !== "number" ||
          typeof max !== "number" ||
          min >= max
        ) {
          this.sink.error(
            this.pos(dial.value),
            `The dial "${entry.key}" needs its least and most, like "dial: [1, 10]".`,
          );
          continue;
        }
        const stepValue = scalarValue(fields.get("step")?.value ?? null);
        const startValue = scalarValue(start?.value ?? null);
        out.push({
          at,
          model: {
            ...base,
            kind: "dial",
            min,
            max,
            step: typeof stepValue === "number" && stepValue > 0 ? stepValue : (max - min) / 100,
            start: typeof startValue === "number" ? Math.min(max, Math.max(min, startValue)) : min,
            unit: this.optionalString(fields.get("unit"), `The unit of "${entry.key}"`) ?? "",
          },
        });
      } else if (toggle !== undefined) {
        const scene = asString(toggle.value);
        if (scene === null) {
          this.sink.error(
            this.pos(toggle.value ?? toggle.keyNode),
            `The toggle "${entry.key}" should name the scene it turns on, like "toggle: retries_on".`,
          );
          continue;
        }
        out.push({
          at: this.pos(toggle.value),
          model: {
            ...base,
            kind: "toggle",
            scene,
            start: scalarValue(start?.value ?? null) === true,
          },
        });
      } else if (pick !== undefined) {
        const scenes = isSeq(pick.value)
          ? pick.value.items.map((item) => asString(nodeOf(item))).filter((v) => v !== null)
          : [];
        if (scenes.length < 2) {
          this.sink.error(
            this.pos(pick.value ?? pick.keyNode),
            `The pick "${entry.key}" should list the scenes to choose from, like "pick: [iaas, paas, saas]".`,
          );
          continue;
        }
        const startName = asString(start?.value ?? null);
        out.push({
          at: this.pos(pick.value),
          model: {
            ...base,
            kind: "pick",
            scenes,
            start: startName !== null && scenes.includes(startName) ? startName : (scenes[0] ?? ""),
          },
        });
      } else {
        this.sink.error(
          at,
          `The control "${entry.key}" should be a dial ("dial: [1, 10]"), a toggle ("toggle: a_scene") or a pick ("pick: [one, two]").`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Tours

  readTours(section: MapEntry, out: RawTour[]): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(
        this.pos(section.keyNode),
        `"tours" should list tours by name, like "request_flow:".`,
      );
      return;
    }
    for (const tourEntry of this.entries(section.value)) {
      const at = this.pos(tourEntry.keyNode);
      if (!isValidName(tourEntry.key)) {
        this.sink.error(
          at,
          `"${tourEntry.key}" isn't a valid tour name. Use letters, numbers, "_" or "-".`,
        );
        continue;
      }
      const fields = this.body(tourEntry.key, tourEntry.value, ["title", "start", "steps"], "tour");
      const steps = new Map<string, TourStep>();
      const stepPositions = new Map<string, StepPositions>();
      const stepsEntry = fields.get("steps");
      if (stepsEntry !== undefined && !isNullish(stepsEntry.value)) {
        if (!isMap(stepsEntry.value)) {
          this.sink.error(
            this.pos(stepsEntry.keyNode),
            `Tour steps should be listed by element, like "web_vm:".`,
          );
        } else {
          for (const stepEntry of this.entries(stepsEntry.value)) {
            const read = this.readStep(tourEntry.key, stepEntry);
            steps.set(stepEntry.key, read.step);
            stepPositions.set(stepEntry.key, read.positions);
          }
        }
      }
      const startEntry = fields.get("start");
      const title = this.optionalString(
        fields.get("title"),
        `The title of tour "${tourEntry.key}"`,
      );
      out.push({
        model: {
          name: tourEntry.key,
          title: title ?? humanize(tourEntry.key),
          start: startEntry === undefined ? null : asString(startEntry.value),
          steps,
          source: { file: at.file, line: at.line },
        },
        at,
        startAt: startEntry === undefined ? null : this.pos(startEntry.value),
        stepPositions,
      });
    }
  }

  private readStep(tour: string, entry: MapEntry): { step: TourStep; positions: StepPositions } {
    const at = this.pos(entry.keyNode);
    const fields = this.body(entry.key, entry.value, ["next", "scene", "choices"], "tour step");
    const next = fields.get("next");
    const scene = fields.get("scene");
    const choices: TourChoice[] = [];
    const choicePositions: { next: Position | null; scene: Position | null }[] = [];
    const choicesEntry = fields.get("choices");
    if (choicesEntry !== undefined && !isNullish(choicesEntry.value)) {
      if (!isMap(choicesEntry.value)) {
        this.sink.error(
          this.pos(choicesEntry.keyNode),
          `Choices should map a label to the next element, like "Normal read: cdn".`,
        );
      } else {
        for (const choice of this.entries(choicesEntry.value)) {
          const direct = asString(choice.value);
          if (direct !== null) {
            choices.push({ label: choice.key, next: direct, scene: null });
            choicePositions.push({ next: this.pos(choice.value), scene: null });
          } else if (isMap(choice.value)) {
            const choiceFields = this.body(choice.key, choice.value, ["next", "scene"], "choice");
            const choiceNext = choiceFields.get("next");
            const choiceScene = choiceFields.get("scene");
            choices.push({
              label: choice.key,
              next: choiceNext === undefined ? null : asString(choiceNext.value),
              scene: choiceScene === undefined ? null : asString(choiceScene.value),
            });
            choicePositions.push({
              next: choiceNext === undefined ? null : this.pos(choiceNext.value),
              scene: choiceScene === undefined ? null : this.pos(choiceScene.value),
            });
          } else {
            this.sink.error(
              this.pos(choice.keyNode),
              `In tour "${tour}", choice "${choice.key}" should name the next element.`,
            );
          }
        }
      }
    }
    if (next !== undefined && choices.length > 0) {
      this.sink.warning(
        at,
        `Step "${entry.key}" has both "next" and "choices". Mogram uses the choices.`,
      );
    }
    return {
      step: {
        target: entry.key,
        next: next === undefined || choices.length > 0 ? null : asString(next.value),
        scene: scene === undefined ? null : asString(scene.value),
        choices,
        source: { file: at.file, line: at.line },
      },
      positions: {
        target: at,
        next: next === undefined ? null : this.pos(next.value),
        scene: scene === undefined ? null : this.pos(scene.value),
        choices: choicePositions,
      },
    };
  }
}

function emptyStep(source: { file: string; line: number }): StoryStep {
  return {
    name: null,
    say: null,
    script: null,
    entries: [],
    focus: [],
    zoom: null,
    hold: null,
    pace: "normal",
    rewind: null,
    choices: [],
    when: null,
    source,
  };
}
