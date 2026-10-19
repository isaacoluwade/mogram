/**
 * Formulas (D-88): a value written as `= errors / allowed * 100` is worked out, never typed
 * twice. Small on purpose: numbers, text in quotes, names of other values, arithmetic,
 * comparisons, `and` / `or` / `not`, and a handful of functions. Nothing loops, nothing is
 * assigned, and it can't reach outside the values it's given.
 */

export type Value = number | string | boolean;

export type Formula =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly Formula[] }
  | { readonly kind: "unary"; readonly op: "-" | "not"; readonly arg: Formula }
  | {
      readonly kind: "binary";
      readonly op: BinaryOp;
      readonly left: Formula;
      readonly right: Formula;
    };

type BinaryOp = "+" | "-" | "*" | "/" | "%" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "and" | "or";

/** Whether a written value is a formula: text that starts with `=`. */
export function isFormula(value: unknown): value is string {
  return typeof value === "string" && value.trimStart().startsWith("=");
}

/** Functions on plain values, and how many arguments each takes (at least, at most). */
const FUNCTIONS: Readonly<Record<string, readonly [number, number]>> = {
  min: [1, 16],
  max: [1, 16],
  round: [1, 2],
  floor: [1, 1],
  ceil: [1, 1],
  abs: [1, 1],
  log2: [1, 1],
  if: [3, 3],
};

/** Functions that read the model: each takes the name of an element. */
export const MODEL_FUNCTIONS = ["load", "copies", "traffic", "count"] as const;
export type ModelFunction = (typeof MODEL_FUNCTIONS)[number];

export class FormulaError extends Error {
  override readonly name = "FormulaError";
}

type Token =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "name"; readonly value: string }
  | { readonly kind: "op"; readonly value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const text = source.trim().replace(/^=/, "");
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i);
    const space = /^\s+/.exec(rest);
    if (space !== null) {
      i += space[0].length;
      continue;
    }
    const number = /^\d+(?:\.\d+)?%?/.exec(rest);
    if (number !== null) {
      const raw = number[0];
      // `25%` is 0.25.
      tokens.push({
        kind: "number",
        value: raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw),
      });
      i += raw.length;
      continue;
    }
    const quoted = /^"([^"]*)"|^'([^']*)'/.exec(rest);
    if (quoted !== null) {
      tokens.push({ kind: "text", value: quoted[1] ?? quoted[2] ?? "" });
      i += quoted[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_.-]*[A-Za-z0-9_]|^[A-Za-z_]/.exec(rest);
    if (name !== null) {
      tokens.push({ kind: "name", value: name[0] });
      i += name[0].length;
      continue;
    }
    const op = /^(<=|>=|==|!=|[-+*/%<>(),])/.exec(rest);
    if (op !== null) {
      tokens.push({ kind: "op", value: op[0] });
      i += op[0].length;
      continue;
    }
    throw new FormulaError(`"${rest[0] ?? ""}" isn't something a formula can use.`);
  }
  return tokens;
}

/** Reads a formula (with or without its leading `=`). Throws a FormulaError saying what's wrong. */
export function parseFormula(source: string): Formula {
  const tokens = tokenize(source);
  let at = 0;
  const peek = (): Token | undefined => tokens[at];
  const isOp = (value: string): boolean => {
    const token = peek();
    return token !== undefined && token.kind === "op" && token.value === value;
  };
  const isWord = (value: string): boolean => {
    const token = peek();
    return token !== undefined && token.kind === "name" && token.value === value;
  };

  const primary = (): Formula => {
    const token = tokens[at++];
    if (token === undefined) throw new FormulaError("The formula stops before it's finished.");
    if (token.kind === "number") return { kind: "number", value: token.value };
    if (token.kind === "text") return { kind: "text", value: token.value };
    if (token.kind === "op" && token.value === "(") {
      const inner = either();
      if (!isOp(")")) throw new FormulaError(`A "(" is never closed.`);
      at++;
      return inner;
    }
    if (token.kind === "op" && token.value === "-")
      return { kind: "unary", op: "-", arg: primary() };
    if (token.kind === "name" && token.value === "not")
      return { kind: "unary", op: "not", arg: primary() };
    if (token.kind === "name" && token.value === "true") return { kind: "number", value: 1 };
    if (token.kind === "name" && token.value === "false") return { kind: "number", value: 0 };
    if (token.kind === "name") {
      if (!isOp("(")) return { kind: "name", name: token.value };
      at++;
      const args: Formula[] = [];
      if (!isOp(")"))
        for (;;) {
          args.push(either());
          if (isOp(",")) {
            at++;
            continue;
          }
          break;
        }
      if (!isOp(")")) throw new FormulaError(`${token.value}( is never closed.`);
      at++;
      const model = (MODEL_FUNCTIONS as readonly string[]).includes(token.value);
      const takes = FUNCTIONS[token.value];
      if (!model && takes === undefined)
        throw new FormulaError(
          `"${token.value}" isn't a function. There are ${[...Object.keys(FUNCTIONS), ...MODEL_FUNCTIONS].join(", ")}.`,
        );
      if (model && (args.length !== 1 || args[0]?.kind !== "name"))
        throw new FormulaError(
          `${token.value}() takes the name of one element, like ${token.value}(web).`,
        );
      if (takes !== undefined && (args.length < takes[0] || args.length > takes[1]))
        throw new FormulaError(
          takes[0] === takes[1]
            ? `${token.value}() takes ${takes[0]} value${takes[0] === 1 ? "" : "s"}.`
            : `${token.value}() takes ${takes[0]} to ${takes[1]} values.`,
        );
      return { kind: "call", name: token.value, args };
    }
    throw new FormulaError(`"${token.value}" isn't expected there.`);
  };
  const level = (next: () => Formula, ops: readonly string[], words = false): (() => Formula) => {
    return () => {
      let left = next();
      for (;;) {
        const token = peek();
        const word =
          token !== undefined && token.kind === (words ? "name" : "op") ? token.value : null;
        if (typeof word !== "string" || !ops.includes(word)) return left;
        at++;
        left = { kind: "binary", op: word as BinaryOp, left, right: next() };
      }
    };
  };
  const product = level(primary, ["*", "/", "%"]);
  const sum = level(product, ["+", "-"]);
  const compare = level(sum, ["<", "<=", ">", ">=", "==", "!="]);
  const both = level(compare, ["and"], true);
  const either = level(both, ["or"], true);

  const formula = either();
  const extra = peek();
  if (extra !== undefined)
    throw new FormulaError(
      `"${String(extra.value)}" isn't expected there${isWord("then") ? ": write if(test, this, that)" : ""}.`,
    );
  return formula;
}

/** The names of other values a formula reads (not the elements its model functions name). */
export function namesIn(formula: Formula): string[] {
  const out = new Set<string>();
  const walk = (node: Formula): void => {
    if (node.kind === "name") out.add(node.name);
    else if (node.kind === "unary") walk(node.arg);
    else if (node.kind === "binary") {
      walk(node.left);
      walk(node.right);
    } else if (node.kind === "call" && !(MODEL_FUNCTIONS as readonly string[]).includes(node.name))
      node.args.forEach(walk);
  };
  walk(formula);
  return [...out];
}

/** Whether a formula reads the model (`load(web)`…): such a value can't feed the model back. */
export function readsModel(formula: Formula): boolean {
  if (formula.kind === "call")
    return (
      (MODEL_FUNCTIONS as readonly string[]).includes(formula.name) || formula.args.some(readsModel)
    );
  if (formula.kind === "unary") return readsModel(formula.arg);
  if (formula.kind === "binary") return readsModel(formula.left) || readsModel(formula.right);
  return false;
}

export interface Scope {
  /** Another value, by name; undefined when there is none. */
  readonly value: (name: string) => Value | undefined;
  /** What the model says about an element; undefined when it can't say. */
  readonly model?: (fn: ModelFunction, element: string) => number | undefined;
}

const truthy = (value: Value): boolean =>
  typeof value === "number" ? value !== 0 : typeof value === "string" ? value !== "" : value;

const numeric = (value: Value): number =>
  typeof value === "number" ? value : typeof value === "boolean" ? (value ? 1 : 0) : Number(value);

/** Works a formula out. A name with no value, or a number that isn't one, throws a FormulaError. */
export function evaluate(formula: Formula, scope: Scope): Value {
  switch (formula.kind) {
    case "number":
    case "text":
      return formula.value;
    case "name": {
      const value = scope.value(formula.name);
      if (value === undefined)
        throw new FormulaError(`There is no value called "${formula.name}".`);
      return value;
    }
    case "unary": {
      const arg = evaluate(formula.arg, scope);
      return formula.op === "not" ? (truthy(arg) ? 0 : 1) : -numeric(arg);
    }
    case "binary": {
      const left = evaluate(formula.left, scope);
      if (formula.op === "and")
        return truthy(left) && truthy(evaluate(formula.right, scope)) ? 1 : 0;
      if (formula.op === "or")
        return truthy(left) || truthy(evaluate(formula.right, scope)) ? 1 : 0;
      const right = evaluate(formula.right, scope);
      if (formula.op === "==") return left === right || numeric(left) === numeric(right) ? 1 : 0;
      if (formula.op === "!=") return left === right || numeric(left) === numeric(right) ? 0 : 1;
      // Text joins with +, so a label can be built from parts.
      if (formula.op === "+" && (typeof left === "string" || typeof right === "string"))
        return `${shown(left)}${shown(right)}`;
      const a = numeric(left);
      const b = numeric(right);
      if (Number.isNaN(a) || Number.isNaN(b))
        throw new FormulaError(`"${String(Number.isNaN(a) ? left : right)}" isn't a number.`);
      switch (formula.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b === 0 ? 0 : a / b;
        case "%":
          return b === 0 ? 0 : a % b;
        case "<":
          return a < b ? 1 : 0;
        case "<=":
          return a <= b ? 1 : 0;
        case ">":
          return a > b ? 1 : 0;
        case ">=":
          return a >= b ? 1 : 0;
      }
      return 0;
    }
    case "call": {
      if ((MODEL_FUNCTIONS as readonly string[]).includes(formula.name)) {
        const element = formula.args[0];
        const name = element?.kind === "name" ? element.name : "";
        return scope.model?.(formula.name as ModelFunction, name) ?? 0;
      }
      if (formula.name === "if") {
        const [test, then, otherwise] = formula.args;
        if (test === undefined || then === undefined || otherwise === undefined) return 0;
        return evaluate(truthy(evaluate(test, scope)) ? then : otherwise, scope);
      }
      const args = formula.args.map((arg) => numeric(evaluate(arg, scope)));
      const first = args[0] ?? 0;
      switch (formula.name) {
        case "min":
          return Math.min(...args);
        case "max":
          return Math.max(...args);
        case "round": {
          const places = 10 ** Math.min(6, Math.max(0, args[1] ?? 0));
          return Math.round(first * places) / places;
        }
        case "floor":
          return Math.floor(first);
        case "ceil":
          return Math.ceil(first);
        case "abs":
          return Math.abs(first);
        case "log2":
          return first > 0 ? Math.log2(first) : 0;
      }
      return 0;
    }
  }
}

/** A value as it's shown in a label: whole numbers as they are, others to two places at most. */
export function shown(value: Value): string {
  if (typeof value !== "number") return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}
