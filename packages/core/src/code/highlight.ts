import type { CodeLanguage } from "../presets/code";

/**
 * Colouring code (D-103): one small tokeniser for each language, written by hand. A listing on
 * a slide needs its block types, keys, strings and marks told apart, not a full grammar, and a
 * highlighter library would need code generation the page's security policy doesn't allow.
 */
export type TokenKind =
  | "keyword"
  | "name"
  | "string"
  | "number"
  | "comment"
  | "punctuation"
  | "command"
  | "output"
  | "added"
  | "removed"
  | "changed"
  | "replaced"
  | "read"
  | "summary"
  | "plain";

export interface Token {
  readonly text: string;
  readonly kind: TokenKind;
}

type Line = Token[];

const whole = (text: string, kind: TokenKind): Line => [{ text, kind }];

/** Joins neighbouring tokens of one kind, so a line is as few `tspan`s as it can be. */
function merged(tokens: readonly Token[]): Line {
  const out: Token[] = [];
  for (const token of tokens) {
    if (token.text === "") continue;
    const last = out.at(-1);
    if (last !== undefined && last.kind === token.kind)
      out[out.length - 1] = { text: last.text + token.text, kind: last.kind };
    else out.push(token);
  }
  return out.length === 0 ? whole("", "plain") : out;
}

/** A quoted string starting at `at`: its length, to the closing quote or the end of the line. */
function quoted(line: string, at: number): number {
  const quote = line[at];
  let end = at + 1;
  while (end < line.length) {
    if (line[end] === "\\") end += 2;
    else if (line[end] === quote) return end + 1 - at;
    else end++;
  }
  return line.length - at;
}

const NUMBER = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const WORD = /^[A-Za-z_][\w-]*/;

// -------------------------------------------------------------------------------------------------
// Terraform's own output

/** A plan as Terraform prints it: each line is what its first mark says. */
function planLine(line: string): Line {
  const trimmed = line.trimStart();
  if (/^(?:Plan:|No changes\.|Changes to Outputs:|Apply complete!)/.test(trimmed))
    return whole(line, "summary");
  if (trimmed.startsWith("#")) return whole(line, "comment");
  if (trimmed.startsWith("-/+") || trimmed.startsWith("+/-")) return whole(line, "replaced");
  if (trimmed.startsWith("<=")) return whole(line, "read");
  if (trimmed.startsWith("+")) return whole(line, "added");
  if (trimmed.startsWith("-")) return whole(line, "removed");
  if (trimmed.startsWith("~")) return whole(line, "changed");
  return whole(line, "plain");
}

/** A terminal: a command after `$ ` or `> ` at the start of a line, and what it printed. */
function consoleLine(line: string): Line {
  const prompt = /^([$>] )(.*)$/.exec(line);
  if (prompt === null) return whole(line, "output");
  return merged([
    { text: prompt[1] ?? "", kind: "punctuation" },
    ...shellLine(prompt[2] ?? ""),
  ]).map((token) => (token.kind === "plain" ? { ...token, kind: "command" } : token));
}

/** A unified diff: a line's mark is its first character. */
function diffLine(line: string): Line {
  if (/^(?:\+\+\+|---|@@|diff |index )/.test(line)) return whole(line, "summary");
  if (line.startsWith("+")) return whole(line, "added");
  if (line.startsWith("-")) return whole(line, "removed");
  return whole(line, "plain");
}

// -------------------------------------------------------------------------------------------------
// Shell

/** Where a new command starts: after one of these, the next word is a command. */
const SHELL_SEPARATORS = ["&&", "||", "|", ";", "$(", "("];

function shellLine(line: string): Line {
  const tokens: Token[] = [];
  let command = true;
  let at = 0;
  while (at < line.length) {
    const rest = line.slice(at);
    const space = /^\s+/.exec(rest);
    if (space !== null) {
      tokens.push({ text: space[0], kind: "plain" });
      at += space[0].length;
      continue;
    }
    if (rest.startsWith("#") && (at === 0 || /\s/.test(line[at - 1] ?? ""))) {
      tokens.push({ text: rest, kind: "comment" });
      break;
    }
    const separator = SHELL_SEPARATORS.find((each) => rest.startsWith(each));
    if (separator !== undefined) {
      tokens.push({ text: separator, kind: "punctuation" });
      at += separator.length;
      command = true;
      continue;
    }
    if (rest.startsWith('"') || rest.startsWith("'")) {
      const length = quoted(line, at);
      tokens.push({ text: line.slice(at, at + length), kind: "string" });
      at += length;
      command = false;
      continue;
    }
    const variable = /^\$\{?[A-Za-z_]\w*\}?/.exec(rest);
    if (variable !== null) {
      tokens.push({ text: variable[0], kind: "name" });
      at += variable[0].length;
      command = false;
      continue;
    }
    const word = /^[^\s|&;()"'#]+/.exec(rest)?.[0] ?? rest.slice(0, 1);
    const assignment: boolean = command && /^[A-Za-z_]\w*=/.test(word);
    tokens.push({
      text: word,
      kind: assignment ? "name" : command ? "command" : NUMBER.test(word) ? "number" : "plain",
    });
    at += word.length;
    // `NAME=value command`: the command is the word after the assignment.
    command = assignment;
  }
  return merged(tokens);
}

// -------------------------------------------------------------------------------------------------
// HCL (Terraform)

const HCL_LITERALS = new Set(["true", "false", "null"]);

/** Where a multi-line comment or heredoc is still open at the end of a line. */
interface HclState {
  readonly comment: boolean;
  /** The word that ends an open heredoc. */
  readonly heredoc: string | null;
}

function hclLine(line: string, state: HclState): { line: Line; state: HclState } {
  if (state.heredoc !== null) {
    const ends = line.trim() === state.heredoc;
    return {
      line: whole(line, ends ? "punctuation" : "string"),
      state: { ...state, heredoc: ends ? null : state.heredoc },
    };
  }
  const tokens: Token[] = [];
  let comment = state.comment;
  let heredoc: string | null = null;
  // The first word of a line, followed by labels or a brace, is a block's type.
  const block = /^\s*([A-Za-z_][\w-]*)(?=\s*(?:"[^"]*"\s*|[A-Za-z_][\w-]*\s*)*\{)/.exec(line);
  const blockAt = block === null ? -1 : block[0].length - (block[1]?.length ?? 0);
  let at = 0;
  while (at < line.length) {
    const rest = line.slice(at);
    if (comment) {
      const end = rest.indexOf("*/");
      const length = end === -1 ? rest.length : end + 2;
      tokens.push({ text: rest.slice(0, length), kind: "comment" });
      at += length;
      comment = end === -1;
      continue;
    }
    if (rest.startsWith("/*")) {
      comment = true;
      continue;
    }
    if (rest.startsWith("#") || rest.startsWith("//")) {
      tokens.push({ text: rest, kind: "comment" });
      break;
    }
    const opens = /^<<-?([A-Za-z_]\w*)\s*$/.exec(rest);
    if (opens !== null) {
      tokens.push({ text: rest, kind: "punctuation" });
      heredoc = opens[1] ?? null;
      break;
    }
    if (rest.startsWith('"')) {
      const length = quoted(line, at);
      tokens.push({ text: line.slice(at, at + length), kind: "string" });
      at += length;
      continue;
    }
    const space = /^\s+/.exec(rest);
    if (space !== null) {
      tokens.push({ text: space[0], kind: "plain" });
      at += space[0].length;
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number !== null) {
      tokens.push({ text: number[0], kind: "number" });
      at += number[0].length;
      continue;
    }
    const word = WORD.exec(rest);
    if (word !== null) {
      const text = word[0];
      const kind: TokenKind =
        at === blockAt || HCL_LITERALS.has(text)
          ? "keyword"
          : /^\s*=(?!=)/.test(line.slice(at + text.length))
            ? "name"
            : "plain";
      tokens.push({ text, kind });
      at += text.length;
      continue;
    }
    const char = rest[0] ?? "";
    tokens.push({ text: char, kind: "{}[]()=,.:?".includes(char) ? "punctuation" : "plain" });
    at += 1;
  }
  return { line: merged(tokens), state: { comment, heredoc } };
}

// -------------------------------------------------------------------------------------------------
// YAML and JSON

const YAML_LITERALS = new Set(["true", "false", "null", "yes", "no", "on", "off", "~"]);

function yamlLine(line: string): Line {
  const tokens: Token[] = [];
  const indent = /^(\s*)(- )?/.exec(line)?.[0] ?? "";
  tokens.push({ text: indent.replace(/- $/, ""), kind: "plain" });
  if (indent.endsWith("- ")) tokens.push({ text: "- ", kind: "punctuation" });
  let rest = line.slice(indent.length);
  if (rest.startsWith("#")) return merged([...tokens, { text: rest, kind: "comment" }]);
  const key = /^("(?:\\.|[^"\\])*"|'[^']*'|[^\s:#][^:#]*?)(\s*:)(?=\s|$)/.exec(rest);
  if (key !== null) {
    tokens.push({ text: key[1] ?? "", kind: "name" }, { text: key[2] ?? "", kind: "punctuation" });
    rest = rest.slice(key[0].length);
  }
  // The value: a comment after a space, a quoted string, a number, a literal, or plain words.
  const comment = /(^|\s)#/.exec(rest);
  const value = comment === null ? rest : rest.slice(0, comment.index + (comment[1]?.length ?? 0));
  const trimmed = value.trim();
  const lead = value.slice(0, value.length - value.trimStart().length);
  const trail = value.slice(value.trimEnd().length);
  tokens.push({ text: lead, kind: "plain" });
  if (trimmed !== "")
    tokens.push({
      text: trimmed,
      kind: /^["']/.test(trimmed)
        ? "string"
        : NUMBER.test(trimmed) && NUMBER.exec(trimmed)?.[0] === trimmed
          ? "number"
          : YAML_LITERALS.has(trimmed.toLowerCase())
            ? "keyword"
            : /^[|>][+-]?$/.test(trimmed) || /^[[\]{},]+$/.test(trimmed)
              ? "punctuation"
              : "string",
    });
  tokens.push({ text: trail, kind: "plain" });
  if (comment !== null) tokens.push({ text: rest.slice(value.length), kind: "comment" });
  return merged(tokens);
}

function jsonLine(line: string): Line {
  const tokens: Token[] = [];
  let at = 0;
  while (at < line.length) {
    const rest = line.slice(at);
    if (rest.startsWith('"')) {
      const length = quoted(line, at);
      const key = /^\s*:/.test(line.slice(at + length));
      tokens.push({ text: line.slice(at, at + length), kind: key ? "name" : "string" });
      at += length;
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number !== null) {
      tokens.push({ text: number[0], kind: "number" });
      at += number[0].length;
      continue;
    }
    const literal = /^(?:true|false|null)\b/.exec(rest);
    if (literal !== null) {
      tokens.push({ text: literal[0], kind: "keyword" });
      at += literal[0].length;
      continue;
    }
    const char = rest[0] ?? "";
    tokens.push({ text: char, kind: "{}[]:,".includes(char) ? "punctuation" : "plain" });
    at += 1;
  }
  return merged(tokens);
}

// -------------------------------------------------------------------------------------------------

/** Every line of a listing as coloured tokens. Lines are coloured whole, then sliced to show. */
export function highlight(language: CodeLanguage, lines: readonly string[]): readonly Line[] {
  switch (language) {
    case "plain":
      return lines.map((line) => whole(line, "plain"));
    case "plan":
      return lines.map(planLine);
    case "console":
      return lines.map(consoleLine);
    case "diff":
      return lines.map(diffLine);
    case "shell":
      return lines.map(shellLine);
    case "yaml":
      return lines.map(yamlLine);
    case "json":
      return lines.map(jsonLine);
    case "hcl": {
      let state: HclState = { comment: false, heredoc: null };
      return lines.map((line) => {
        const read = hclLine(line, state);
        state = read.state;
        return read.line;
      });
    }
  }
}
