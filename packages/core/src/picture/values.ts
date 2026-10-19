import type { Control, DataValue, Diagram, StoryStep } from "../model/types";
import {
  FormulaError,
  evaluate,
  isFormula,
  parseFormula,
  readsModel,
  type Scope,
  type Value,
} from "../values/formula";

/** What the viewer has set each control to (D-88); a control that isn't here is at its start. */
export type ControlValues = ReadonlyMap<string, Value>;

/** A control's value: what the viewer set, or where it starts. */
export function controlValue(control: Control, given: ControlValues | undefined): Value {
  const set = given?.get(control.name);
  if (control.kind === "dial") {
    const value = typeof set === "number" ? set : control.start;
    return Math.min(control.max, Math.max(control.min, value));
  }
  if (control.kind === "toggle") return (typeof set === "boolean" ? set : control.start) ? 1 : 0;
  return typeof set === "string" && control.scenes.includes(set) ? set : control.start;
}

/** The scenes the controls have on, in the order the controls are written. */
export function scenesOn(diagram: Diagram, given: ControlValues | undefined): string[] {
  const on: string[] = [];
  for (const control of diagram.controls) {
    const value = controlValue(control, given);
    if (control.kind === "toggle" && value === 1) on.push(control.scene);
    if (control.kind === "pick" && typeof value === "string" && value !== "normal") on.push(value);
  }
  return on;
}

/**
 * Works out every value (D-88): the diagram's data and the controls, with what steps and scenes
 * set laid over (`set`). A formula that reads the model is left as written, for whoever has the
 * model to hand; one that can't be worked out (a loop, a missing name) is 0.
 */
export function workOut(
  diagram: Diagram,
  controls: ControlValues | undefined,
  set: ReadonlyMap<string, DataValue> = new Map(),
): Map<string, Value> {
  const written = new Map<string, DataValue>(diagram.settings.data);
  for (const [name, value] of set) written.set(name, value);
  for (const control of diagram.controls)
    written.set(control.name, controlValue(control, controls));

  const done = new Map<string, Value>();
  const working = new Set<string>();
  const resolve = (name: string): Value | undefined => {
    const known = done.get(name);
    if (known !== undefined) return known;
    const value = written.get(name);
    if (value === undefined) return undefined;
    if (!isFormula(value)) {
      done.set(name, value);
      return value;
    }
    // A loop: each value in it counts as 0 rather than hanging.
    if (working.has(name)) return 0;
    working.add(name);
    let result: Value = 0;
    try {
      const formula = parseFormula(value);
      result = readsModel(formula) ? value : evaluate(formula, { value: resolve });
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
    }
    working.delete(name);
    done.set(name, result);
    return result;
  };
  for (const name of written.keys()) resolve(name);
  return done;
}

/** A scope over worked-out values, for formulas written elsewhere (a meter, a step's `when`). */
export function scopeOf(values: ReadonlyMap<string, Value>, model?: Scope["model"]): Scope {
  return {
    value: (name) => {
      const value = values.get(name);
      // A value that reads the model is worked out here, where the model is known.
      if (model !== undefined && isFormula(value)) {
        try {
          return evaluate(parseFormula(value), scopeOf(values, model));
        } catch {
          return 0;
        }
      }
      return value;
    },
    ...(model === undefined ? {} : { model }),
  };
}

/** A formula's number in a scope; 0 when it can't be worked out. */
export function numberOf(formula: string, scope: Scope): number {
  try {
    const value = evaluate(parseFormula(formula), scope);
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : 0;
  } catch {
    return 0;
  }
}

/**
 * Whether each step plays (D-88): one with `when` plays only while its test holds, read from
 * the diagram's values and the controls. So a dial can change what happens, not just what's
 * shown.
 */
export function stepPlays(
  diagram: Diagram,
  controls: ControlValues | undefined,
): (step: StoryStep) => boolean {
  let scope: Scope | null = null;
  return (step) => {
    if (step.when === null) return true;
    scope ??= scopeOf(workOut(diagram, controls));
    return numberOf(step.when, scope) !== 0;
  };
}
