import type { SceneCapacity, SceneEntry, TourChoice, TourStep } from "../model/types";
import { humanize, isValidName } from "../model/names";
import {
  FLOW_PRESETS,
  MOTION_PRESETS,
  STATE_PRESETS,
  isFlowPreset,
  isMotionPreset,
  isStatePreset,
} from "../presets/names";
import type { Position } from "./diagnostics";
import { didYouMean, listOptions } from "./suggest";
import { asString, isMap, isNullish, scalarValue, type MapEntry } from "./yaml-read";
import type { RawScene, RawTour, StepPositions } from "./raw";
import { SectionReader } from "./read-base";

/** Scenes and tours (SC-1 … SC-5, TO-1 … TO-6). */
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
            const entry = this.readSceneEntry(sceneEntry.key, line);
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

  private readSceneEntry(scene: string, line: MapEntry): SceneEntry | null {
    const at = this.pos(line.keyNode);
    const source = { file: at.file, line: at.line };
    const single = asString(line.value);
    if (single !== null) {
      if (isStatePreset(single))
        return { target: line.key, state: single, flow: null, motion: null, source };
      if (isFlowPreset(single))
        return { target: line.key, state: null, flow: single, motion: null, source };
      // `users_to_web: 5x` is short for `{ traffic: 5x }`.
      if (/^\d+(\.\d+)?\s*[x×]$/i.test(single.trim())) {
        const traffic = this.readMultiple(line.value, `The traffic on "${line.key}"`);
        return traffic === null
          ? null
          : {
              target: line.key,
              state: null,
              flow: null,
              motion: null,
              capacity: { traffic },
              source,
            };
      }
      this.sink.error(
        this.pos(line.value),
        `In scene "${scene}", "${single}" isn't a state or flow preset.${didYouMean(single, [...STATE_PRESETS, ...FLOW_PRESETS])} States: ${listOptions(STATE_PRESETS)}. Flows: ${listOptions(FLOW_PRESETS)}.`,
      );
      return null;
    }
    if (isMap(line.value)) {
      const fields = this.body(
        line.key,
        line.value,
        ["state", "flow", "motion", "traffic", "share", "hit", "copies", "size"],
        "scene",
      );
      const capacity = this.readSceneCapacity(fields, line.key);
      return {
        ...(capacity === null ? {} : { capacity }),
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
    this.sink.error(
      at,
      `In scene "${scene}", give "${line.key}" a preset, like "${line.key}: down".`,
    );
    return null;
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
